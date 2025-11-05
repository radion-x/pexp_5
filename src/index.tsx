import 'dotenv/config'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { join } from 'node:path'
import { Anthropic } from '@anthropic-ai/sdk'
import { streamSSE } from 'hono/streaming'

import { generateComprehensivePrompt } from './prompt-builder.js'
import { sendSubmissionEmails } from './email-service.js'
import { BUILD_VERSION } from './version.js'

const app = new Hono()

const claudeApiKey = process.env.CLAUDE_API_KEY
const claudeModel = process.env.CLAUDE_SUMMARY_MODEL ?? process.env.CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022'
const anthropic = claudeApiKey ? new Anthropic({ apiKey: claudeApiKey }) : null

if (!claudeApiKey) {
  console.warn('CLAUDE_API_KEY is not set. AI summary endpoint will be disabled.')
}

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static assets when running under Node
app.use('/static/*', serveStatic({ root: join(process.cwd(), 'public') }))

app.post('/api/generate-summary/stream', async (c) => {
  let formData: unknown

  try {
    formData = await c.req.json()
  } catch (error) {
    console.error('Invalid JSON payload for summary streaming:', error)
    return c.json({ error: 'Invalid JSON payload.' }, 400)
  }

  const prompt = generateComprehensivePrompt(formData as any)

  if (!prompt.trim()) {
    return c.json({ error: 'Unable to build AI prompt from the provided data.' }, 400)
  }

  if (!anthropic) {
    return c.json({ error: 'AI summary service is not configured. Please contact support.' }, 503)
  }

  return streamSSE(c, async (stream) => {
    let aborted = false
    stream.onAbort(() => {
      aborted = true
    })

    const sendEvent = async (event: string, payload: Record<string, unknown>) => {
      if (aborted) return
      await stream.writeSSE({ event, data: JSON.stringify({ event, ...payload }) })
    }

    await sendEvent('status', { message: 'Connecting to AI...' })

    let summaryHtml = ''

    try {
      const messageStream: any = await anthropic.messages.create({
        model: claudeModel,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      })

      for await (const event of messageStream) {
        if (aborted) {
          messageStream?.controller?.abort?.()
          break
        }

        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const chunk = event.delta.text ?? ''
          if (chunk) {
            summaryHtml += chunk
            await sendEvent('delta', { html: chunk })
          }
        } else if (event.type === 'message_stop') {
          break
        }
      }

      if (!aborted) {
        try {
          const finalMessage = await messageStream.finalMessage()
          if (!summaryHtml && finalMessage?.content) {
            for (const part of finalMessage.content as any[]) {
              if (part?.type === 'text' && part.text) {
                summaryHtml += part.text
              }
            }
          }
        } catch (finalError) {
          console.warn('Failed to fetch final message from stream:', finalError)
        }
      }
    } catch (error) {
      console.error('AI streaming error:', error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'An unexpected error occurred while streaming the AI summary.'
      await sendEvent('error', { message })
      return
    }

    if (aborted) {
      return
    }

    if (!summaryHtml.trim()) {
      await sendEvent('error', { message: 'AI summary was empty.' })
      return
    }

    await sendEvent('complete', { html: summaryHtml })
  })
})

app.post('/api/generate-summary', async (c) => {
  const client = anthropic
  if (!client) {
    return c.json({
      error: 'AI summary service is not configured. Please contact support.'
    }, 503)
  }

  let formData: unknown

  try {
    formData = await c.req.json()
  } catch (error) {
    console.error('Invalid JSON payload for summary generation:', error)
    return c.json({ error: 'Invalid JSON payload.' }, 400)
  }

  const prompt = generateComprehensivePrompt(formData as any)

  if (!prompt.trim()) {
    return c.json({ error: 'Unable to build AI prompt from the provided data.' }, 400)
  }

  try {
    const response = await client.messages.create({
      model: claudeModel,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })

    const summary = response.content
      ?.map((part: any) => (part?.type === 'text' ? part.text : ''))
      .join('')
      .trim()

    if (!summary) {
      return c.json({ error: 'AI summary was empty.' }, 502)
    }

    return c.json({ summary })
  } catch (error) {
    console.error('Failed to generate AI summary:', error)
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'An unexpected error occurred while generating the AI summary.'
    return c.json({ error: message }, 502)
  }
})

// API route for form submission
app.post('/api/submit-intake', async (c) => {
  try {
    const body = await c.req.json()

    // Log the submission (in production, save to database)
    console.log('Form submission received:', {
      timestamp: new Date().toISOString(),
      email: body.email,
      selectedAreas: body.selectedAreas,
      painIntensity: body.painIntensity
    })

    // Send confirmation and notification emails
    const emailConfig = {
      smtpServer: process.env.MAILGUN_SMTP_SERVER || 'smtp.mailgun.org',
      smtpPort: Number(process.env.MAILGUN_SMTP_PORT) || 587,
      smtpLogin: process.env.MAILGUN_SMTP_LOGIN || '',
      smtpPassword: process.env.MAILGUN_SMTP_PASSWORD || '',
      senderAddress: process.env.EMAIL_SENDER_ADDRESS || '',
      recipientAddress: process.env.EMAIL_RECIPIENT_ADDRESS || '',
      bccAddress: process.env.BCC_EMAIL_RECIPIENT_ADDRESS || '',
    }

    // Send emails (don't block submission if emails fail)
    sendSubmissionEmails(body, emailConfig).catch((error) => {
      console.error('Email sending failed (non-blocking):', error)
    })

    return c.json({
      success: true,
      message: 'Assessment submitted successfully',
      id: Math.random().toString(36).substring(7)
    })
  } catch (error) {
    console.error('Submission error:', error)
    return c.json({
      success: false,
      message: 'Failed to submit assessment'
    }, 500)
  }
})

// Main page route
app.get('/', (c) => {
  return c.html(`
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      <meta name="theme-color" content="#10b981" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="PEXP" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="format-detection" content="telephone=no" />
      <link rel="manifest" href="/static/manifest.json" />
      <link rel="apple-touch-icon" href="/static/icon-192.png" />
      <title>PEXP - Patient Experience Assessment Platform</title>
      <link rel="stylesheet" href="/static/styles.css?v=${BUILD_VERSION}" />
    </head>
    <body>
      <!-- Progress Steps -->
      <div class="wizard-header step-1-active" id="wizardHeader">
        <div class="wizard-steps">
          <div class="step active" data-step="1">
            <div class="step-circle">1</div>
            <div class="step-label">Welcome</div>
          </div>
          <div class="step" data-step="2">
            <div class="step-circle">2</div>
            <div class="step-label">Pain Map</div>
          </div>
          <div class="step" data-step="3">
            <div class="step-circle">3</div>
            <div class="step-label">Medical History</div>
          </div>
          <div class="step" data-step="4">
            <div class="step-circle">4</div>
            <div class="step-label">Goals</div>
          </div>
          <div class="step" data-step="5">
            <div class="step-circle">5</div>
            <div class="step-label">Review</div>
          </div>
        </div>
      </div>

      <main class="wizard-container">
        <div id="resumeBanner" class="resume-banner hidden" role="status" aria-live="polite">
          <div class="resume-banner__content">
            <div>
              <strong>Welcome back!</strong> We found an unfinished assessment.
            </div>
            <div class="resume-banner__actions">
              <button type="button" class="btn btn-primary" id="resumeContinueBtn">Continue where I left off</button>
              <button type="button" class="btn btn-secondary" id="resumeStartOverBtn">Start over</button>
            </div>
          </div>
        </div>
        <!-- Progress Sidebar -->
        <aside class="progress-sidebar">
          <div class="progress-circle">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="progress-bg"></circle>
              <circle cx="50" cy="50" r="45" class="progress-bar" id="progressCircle"></circle>
            </svg>
            <div class="progress-text" id="progressText">0%</div>
          </div>
          <div class="sidebar-steps">
            <div class="sidebar-step active" data-step="1">Welcome</div>
            <div class="sidebar-step" data-step="2">Pain Map</div>
            <div class="sidebar-step" data-step="3">Medical History</div>
            <div class="sidebar-step" data-step="4">Goals</div>
            <div class="sidebar-step" data-step="5">Review</div>
          </div>
        </aside>

        <div class="wizard-content">
          <form id="intakeForm" class="wizard-form" novalidate>
            
            <!-- Step 1: Welcome -->
            <div class="wizard-step active" data-step="1">
              <div class="step-content">
                <div class="hero-section">
                  <svg class="hero-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <h1>Welcome to QIVR</h1>
                  <p class="subtitle">Turning signals into insights</p>
                </div>
                
                <div class="info-footer">
                  <div class="info-item">
                    <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="5" y="11" width="14" height="10" rx="2" stroke-width="2"/>
                      <path d="M12 17V17.01M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>HIPAA-compliant & confidential</span>
                  </div>
                  <div class="info-item">
                    <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16L21 8V19C21 20.1046 20.1046 21 19 21Z" stroke-width="2"/>
                      <path d="M17 21V13H7V21M7 3V8H15" stroke-width="2"/>
                    </svg>
                    <span>Auto-saved progress</span>
                  </div>
                  <div class="info-item">
                    <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Track recovery metrics</span>
                  </div>
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" name="fullName" required />
                  </div>
                  <div class="form-group">
                    <label>Email Address *</label>
                    <input type="email" name="email" required />
                  </div>
                  <div class="form-group">
                    <label>Phone Number</label>
                    <input type="tel" name="phone" />
                  </div>
                  <div class="form-group">
                    <label>Age Range</label>
                    <select name="ageRange" class="full-width">
                      <option value="">Select age range...</option>
                      <option value="Under 18">Under 18</option>
                      <option value="18-29">18-29</option>
                      <option value="30-44">30-44</option>
                      <option value="45-59">45-59</option>
                      <option value="60-74">60-74</option>
                      <option value="75 and over">75 and over</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2: Pain Map -->
            <div class="wizard-step" data-step="2">
              <div class="step-content">
                <h2>Pain Location & Duration</h2>
                <p class="step-description">Click on the areas of your body where you experience pain. You can select multiple locations.</p>

                <div class="pain-details-section">
                  <div class="form-group">
                    <label>How long have you had this pain? *</label>
                    <select name="painDuration" required>
                      <option value="">Select duration...</option>
                      <option value="Less than 1 week">Less than 1 week</option>
                      <option value="1-2 weeks">1-2 weeks</option>
                      <option value="2-4 weeks">2-4 weeks</option>
                      <option value="1-3 months">1-3 months</option>
                      <option value="3-6 months">3-6 months</option>
                      <option value="6-12 months">6-12 months</option>
                      <option value="1-2 years">1-2 years</option>
                      <option value="More than 2 years">More than 2 years</option>
                    </select>
                  </div>
                </div>

                <div class="pain-map-section">
                  <div class="body-map-container">
                    <div class="view-toggle">
                      <button type="button" class="view-btn active" data-view="front">Front View</button>
                      <button type="button" class="view-btn" data-view="back">Back View</button>
                    </div>

                    <!-- Front View -->
                    <div class="body-diagram active" data-view="front">
                      <div class="body-map-wrapper">
                        <img src="/static/images/body-front.png" alt="Front view body map" class="body-map-image" />
                        <div class="hotspot-layer" data-view="front" aria-hidden="true"></div>
                      </div>
                    </div>

                    <!-- Back View -->
                    <div class="body-diagram" data-view="back">
                      <div class="body-map-wrapper">
                        <img src="/static/images/body-back.png" alt="Back view body map" class="body-map-image" />
                        <div class="hotspot-layer" data-view="back" aria-hidden="true"></div>
                      </div>
                    </div>

                    <div class="selected-areas-display">
                      <strong>Selected Pain Areas:</strong>
                      <ul id="selectedAreas" class="pain-points-list">
                        <li class="no-pain-points">No areas selected yet</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- Pain Intensity Selection Modal -->
                <div class="pain-intensity-modal" id="painIntensityModal" aria-hidden="true" role="dialog" aria-labelledby="painModalTitle">
                  <div class="pain-modal-backdrop"></div>
                  <div class="pain-modal-content">
                    <div class="pain-modal-header">
                      <h3 id="painModalTitle">Rate Your Pain Level</h3>
                      <p class="pain-modal-location" id="painModalLocation">Front: Left Shoulder</p>
                    </div>

                    <div class="pain-modal-body">
                      <!-- Quick Select Buttons -->
                      <div class="pain-quick-select">
                        <div class="quick-select-grid">
                          <button type="button" class="quick-select-btn" data-intensity="0" data-label="None">
                            <span class="quick-btn-number">0</span>
                            <span class="quick-btn-label">None</span>
                          </button>
                          <button type="button" class="quick-select-btn" data-intensity="2" data-label="Mild">
                            <span class="quick-btn-number">2</span>
                            <span class="quick-btn-label">Mild</span>
                          </button>
                          <button type="button" class="quick-select-btn" data-intensity="4" data-label="Moderate">
                            <span class="quick-btn-number">4</span>
                            <span class="quick-btn-label">Moderate</span>
                          </button>
                          <button type="button" class="quick-select-btn" data-intensity="6" data-label="Moderate+">
                            <span class="quick-btn-number">6</span>
                            <span class="quick-btn-label">Moderate+</span>
                          </button>
                          <button type="button" class="quick-select-btn" data-intensity="8" data-label="Severe">
                            <span class="quick-btn-number">8</span>
                            <span class="quick-btn-label">Severe</span>
                          </button>
                          <button type="button" class="quick-select-btn" data-intensity="10" data-label="Worst">
                            <span class="quick-btn-number">10</span>
                            <span class="quick-btn-label">Worst</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div class="pain-modal-footer">
                      <button type="button" class="pain-modal-btn pain-modal-cancel" id="painModalCancel">
                        Cancel
                      </button>
                      <button type="button" class="pain-modal-btn pain-modal-confirm" id="painModalConfirm">
                        <span class="confirm-icon">✓</span> Confirm
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3: Medical History -->
            <div class="wizard-step" data-step="3">
              <div class="step-content">
                <h2>Medical History</h2>
                <p class="step-description">Help us understand your medical background and current condition.</p>
                
                <div class="form-section">
                  <h3>How did your pain/injury start?</h3>
                  <select name="painStart" class="full-width">
                    <option value="">Select how it started...</option>
                    <option value="Sudden injury or trauma">Sudden injury or trauma</option>
                    <option value="Gradual onset over time">Gradual onset over time</option>
                    <option value="After specific activity or sport">After specific activity or sport</option>
                    <option value="Work-related incident">Work-related incident</option>
                    <option value="Motor vehicle accident">Motor vehicle accident</option>
                    <option value="Fall or slip">Fall or slip</option>
                    <option value="Post-surgery complication">Post-surgery complication</option>
                    <option value="Unknown/Can't remember">Unknown/Can't remember</option>
                  </select>
                </div>

                <div class="form-section">
                  <h3>Previous orthopaedic conditions or surgeries</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="prevOrtho" value="Fracture/Broken bone" /> Fracture/Broken bone</label>
                    <label><input type="checkbox" name="prevOrtho" value="ACL/MCL injury" /> ACL/MCL injury</label>
                    <label><input type="checkbox" name="prevOrtho" value="Rotator cuff injury" /> Rotator cuff injury</label>
                    <label><input type="checkbox" name="prevOrtho" value="Hip replacement" /> Hip replacement</label>
                    <label><input type="checkbox" name="prevOrtho" value="Knee replacement" /> Knee replacement</label>
                    <label><input type="checkbox" name="prevOrtho" value="Spinal surgery" /> Spinal surgery</label>
                    <label><input type="checkbox" name="prevOrtho" value="Arthroscopy" /> Arthroscopy</label>
                    <label><input type="checkbox" name="prevOrtho" value="Tendon repair" /> Tendon repair</label>
                    <label><input type="checkbox" name="prevOrtho" value="None" /> None</label>
                  </div>
                </div>

                <div class="form-section">
                  <h3>Current treatments you're receiving</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="currentTreatments" value="Physical therapy" /> Physical therapy</label>
                    <label><input type="checkbox" name="currentTreatments" value="Chiropractic care" /> Chiropractic care</label>
                    <label><input type="checkbox" name="currentTreatments" value="Massage therapy" /> Massage therapy</label>
                    <label><input type="checkbox" name="currentTreatments" value="Acupuncture" /> Acupuncture</label>
                    <label><input type="checkbox" name="currentTreatments" value="Injections (cortisone, etc.)" /> Injections (cortisone, etc.)</label>
                    <label><input type="checkbox" name="currentTreatments" value="Prescription medication" /> Prescription medication</label>
                    <label><input type="checkbox" name="currentTreatments" value="Over-the-counter medication" /> Over-the-counter medication</label>
                    <label><input type="checkbox" name="currentTreatments" value="Heat/Ice therapy" /> Heat/Ice therapy</label>
                    <label><input type="checkbox" name="currentTreatments" value="Bracing/Support devices" /> Bracing/Support devices</label>
                    <label><input type="checkbox" name="currentTreatments" value="None" /> None</label>
                  </div>
                </div>

                <div class="form-section">
                  <h3>Current medications</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="medications" value="Ibuprofen (Advil, Motrin)" /> Ibuprofen (Advil, Motrin)</label>
                    <label><input type="checkbox" name="medications" value="Acetaminophen (Tylenol)" /> Acetaminophen (Tylenol)</label>
                    <label><input type="checkbox" name="medications" value="Naproxen (Aleve)" /> Naproxen (Aleve)</label>
                    <label><input type="checkbox" name="medications" value="Prescription pain medication" /> Prescription pain medication</label>
                    <label><input type="checkbox" name="medications" value="Muscle relaxants" /> Muscle relaxants</label>
                    <label><input type="checkbox" name="medications" value="Anti-inflammatory prescription" /> Anti-inflammatory prescription</label>
                    <label><input type="checkbox" name="medications" value="Topical pain relief" /> Topical pain relief</label>
                    <label><input type="checkbox" name="medications" value="Supplements (glucosamine, etc.)" /> Supplements (glucosamine, etc.)</label>
                    <label><input type="checkbox" name="medications" value="None" /> None</label>
                  </div>
                </div>

                <div class="form-section">
                  <h3>Mobility aids</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="mobilityAids" value="Cane" /> Cane</label>
                    <label><input type="checkbox" name="mobilityAids" value="Walker" /> Walker</label>
                    <label><input type="checkbox" name="mobilityAids" value="Crutches" /> Crutches</label>
                    <label><input type="checkbox" name="mobilityAids" value="Wheelchair" /> Wheelchair</label>
                    <label><input type="checkbox" name="mobilityAids" value="Knee scooter" /> Knee scooter</label>
                    <label><input type="checkbox" name="mobilityAids" value="Brace or support" /> Brace or support</label>
                    <label><input type="checkbox" name="mobilityAids" value="Orthotic inserts" /> Orthotic inserts</label>
                    <label><input type="checkbox" name="mobilityAids" value="None" /> None</label>
                  </div>
                </div>

                <div class="form-section">
                  <h3>Daily activity impact</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="dailyImpact" value="Walking/Standing" /> Walking/Standing</label>
                    <label><input type="checkbox" name="dailyImpact" value="Climbing stairs" /> Climbing stairs</label>
                    <label><input type="checkbox" name="dailyImpact" value="Sitting for long periods" /> Sitting for long periods</label>
                    <label><input type="checkbox" name="dailyImpact" value="Sleeping/Lying down" /> Sleeping/Lying down</label>
                    <label><input type="checkbox" name="dailyImpact" value="Dressing/Grooming" /> Dressing/Grooming</label>
                    <label><input type="checkbox" name="dailyImpact" value="Bathing/Showering" /> Bathing/Showering</label>
                    <label><input type="checkbox" name="dailyImpact" value="Household chores" /> Household chores</label>
                    <label><input type="checkbox" name="dailyImpact" value="Work duties" /> Work duties</label>
                    <label><input type="checkbox" name="dailyImpact" value="Exercise/Recreation" /> Exercise/Recreation</label>
                    <label><input type="checkbox" name="dailyImpact" value="Driving" /> Driving</label>
                    <label><input type="checkbox" name="dailyImpact" value="Lifting/Carrying" /> Lifting/Carrying</label>
                    <label><input type="checkbox" name="dailyImpact" value="Minimal impact" /> Minimal impact</label>
                  </div>
                </div>

                <div class="form-section">
                  <h3>Additional medical history</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="additionalHistory" value="Diabetes" /> Diabetes</label>
                    <label><input type="checkbox" name="additionalHistory" value="Heart disease" /> Heart disease</label>
                    <label><input type="checkbox" name="additionalHistory" value="High blood pressure" /> High blood pressure</label>
                    <label><input type="checkbox" name="additionalHistory" value="Arthritis" /> Arthritis</label>
                    <label><input type="checkbox" name="additionalHistory" value="Osteoporosis" /> Osteoporosis</label>
                    <label><input type="checkbox" name="additionalHistory" value="Autoimmune condition" /> Autoimmune condition</label>
                    <label><input type="checkbox" name="additionalHistory" value="Cancer (current/past)" /> Cancer (current/past)</label>
                    <label><input type="checkbox" name="additionalHistory" value="Blood clotting disorder" /> Blood clotting disorder</label>
                    <label><input type="checkbox" name="additionalHistory" value="Smoking (current/former)" /> Smoking (current/former)</label>
                    <label><input type="checkbox" name="additionalHistory" value="None" /> None</label>
                  </div>
                </div>

                <div class="form-section">
                  <h3>⚠️ Red Flag Symptoms</h3>
                  <p class="warning-text">If you're experiencing any of these symptoms, please seek immediate medical attention.</p>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="redFlags" value="Recent trauma or injury" /> Recent trauma or injury</label>
                    <label><input type="checkbox" name="redFlags" value="Loss of bowel/bladder control" /> Loss of bowel/bladder control</label>
                    <label><input type="checkbox" name="redFlags" value="Fever or unexplained weight loss" /> Fever or unexplained weight loss</label>
                    <label><input type="checkbox" name="redFlags" value="Severe night pain" /> Severe night pain</label>
                    <label><input type="checkbox" name="redFlags" value="Pain getting progressively worse" /> Pain getting progressively worse</label>
                    <label><input type="checkbox" name="redFlags" value="Numbness or tingling" /> Numbness or tingling</label>
                    <label><input type="checkbox" name="redFlags" value="Muscle weakness" /> Muscle weakness</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 4: Goals -->
            <div class="wizard-step" data-step="4">
              <div class="step-content">
                <h2>Treatment Goals & Expectations</h2>
                <p class="step-description">What are you hoping to achieve through treatment?</p>
                
                <div class="form-section">
                  <h3>Primary treatment goals</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="goals" value="Reduce pain intensity"/> Reduce pain intensity</label>
                    <label><input type="checkbox" name="goals" value="Improve mobility and flexibility"/> Improve mobility and flexibility</label>
                    <label><input type="checkbox" name="goals" value="Increase strength and stability"/> Increase strength and stability</label>
                    <label><input type="checkbox" name="goals" value="Sleep better without pain"/> Sleep better without pain</label>
                    <label><input type="checkbox" name="goals" value="Return to normal daily activities"/> Return to normal daily activities</label>
                    <label><input type="checkbox" name="goals" value="Return to sports/recreational activities"/> Return to sports/recreational activities</label>
                    <label><input type="checkbox" name="goals" value="Return to work or improve work function"/> Return to work or improve work function</label>
                    <label><input type="checkbox" name="goals" value="Avoid surgery if possible"/> Avoid surgery if possible</label>
                    <label><input type="checkbox" name="goals" value="Prepare for upcoming surgery"/> Prepare for upcoming surgery</label>
                    <label><input type="checkbox" name="goals" value="Recover from recent surgery"/> Recover from recent surgery</label>
                    <label><input type="checkbox" name="goals" value="Reduce medication use"/> Reduce medication use</label>
                    <label><input type="checkbox" name="goals" value="Improve posture and alignment"/> Improve posture and alignment</label>
                    <label><input type="checkbox" name="goals" value="Prevent condition from worsening"/> Prevent condition from worsening</label>
                    <label><input type="checkbox" name="goals" value="Maintain independent living"/> Maintain independent living</label>
                  </div>
                </div>

                <div class="form-section">
                  <h3>Expected recovery timeline</h3>
                  <select name="timeline" class="full-width">
                    <option value="">Select timeline...</option>
                    <option value="1-2 weeks">1-2 weeks</option>
                    <option value="3-4 weeks">3-4 weeks</option>
                    <option value="1-2 months">1-2 months</option>
                    <option value="3-6 months">3-6 months</option>
                    <option value="6-12 months">6-12 months</option>
                    <option value="More than 1 year">More than 1 year</option>
                    <option value="Uncertain">Uncertain</option>
                  </select>
                </div>

                <div class="form-section">
                  <h3>Specific activities or milestones</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="milestones" value="Walk without pain" /> Walk without pain</label>
                    <label><input type="checkbox" name="milestones" value="Run or jog again" /> Run or jog again</label>
                    <label><input type="checkbox" name="milestones" value="Play sports" /> Play sports</label>
                    <label><input type="checkbox" name="milestones" value="Climb stairs easily" /> Climb stairs easily</label>
                    <label><input type="checkbox" name="milestones" value="Lift weights/strength train" /> Lift weights/strength train</label>
                    <label><input type="checkbox" name="milestones" value="Sleep through the night" /> Sleep through the night</label>
                    <label><input type="checkbox" name="milestones" value="Return to work full-time" /> Return to work full-time</label>
                    <label><input type="checkbox" name="milestones" value="Play with kids/grandkids" /> Play with kids/grandkids</label>
                    <label><input type="checkbox" name="milestones" value="Travel comfortably" /> Travel comfortably</label>
                    <label><input type="checkbox" name="milestones" value="Garden or yard work" /> Garden or yard work</label>
                    <label><input type="checkbox" name="milestones" value="Stand for extended periods" /> Stand for extended periods</label>
                    <label><input type="checkbox" name="milestones" value="Sit comfortably at desk" /> Sit comfortably at desk</label>
                  </div>
                </div>

                <div class="form-section">
                  <h3>Treatment concerns</h3>
                  <div class="checkbox-grid">
                    <label><input type="checkbox" name="concerns" value="Cost of treatment" /> Cost of treatment</label>
                    <label><input type="checkbox" name="concerns" value="Time commitment required" /> Time commitment required</label>
                    <label><input type="checkbox" name="concerns" value="Effectiveness of treatment" /> Effectiveness of treatment</label>
                    <label><input type="checkbox" name="concerns" value="Potential side effects" /> Potential side effects</label>
                    <label><input type="checkbox" name="concerns" value="Recovery time" /> Recovery time</label>
                    <label><input type="checkbox" name="concerns" value="Risk of surgery" /> Risk of surgery</label>
                    <label><input type="checkbox" name="concerns" value="Pain during treatment" /> Pain during treatment</label>
                    <label><input type="checkbox" name="concerns" value="Work/School disruption" /> Work/School disruption</label>
                    <label><input type="checkbox" name="concerns" value="Limited treatment options" /> Limited treatment options</label>
                    <label><input type="checkbox" name="concerns" value="Long-term outcomes" /> Long-term outcomes</label>
                    <label><input type="checkbox" name="concerns" value="No specific concerns" /> No specific concerns</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 5: Review -->
            <div class="wizard-step" data-step="5">
              <div class="step-content">
                <h2>Review Your Assessment</h2>
                <p class="step-description">Please review your information before submitting.</p>
                
                <div id="reviewSummary" class="review-summary">
                  <!-- Summary will be populated by JavaScript -->
                </div>

                <div class="ai-summary-section" id="aiSummarySection">
                  <div class="ai-summary-header">
                    <h3>AI Clinical Summary</h3>
                  </div>
                  <div class="ai-summary-controls">
                    <label class="consent-label ai-summary-consent">
                      <input type="checkbox" name="consent" required />
                      <span>I consent to the collection and use of my health information for assessment and treatment purposes in accordance with HIPAA regulations.</span>
                    </label>
                    <button type="button" class="btn btn-secondary btn-compact" id="generateSummaryBtn">
                      Generate Summary
                    </button>
                  </div>
                  <p class="ai-summary-status" id="aiSummaryStatus">
                    Select the consent checkbox, then choose "Generate Summary" when you're ready.
                  </p>
                  <div class="ai-summary-text" id="aiSummaryText" aria-live="polite"></div>
                </div>

                <div class="recovery-trajectory-section" id="recoveryTrajectorySection" style="display: none;">
                  <div class="trajectory-header">
                    <h3>Recovery Timeline Analysis</h3>
                    <p class="trajectory-description" id="trajectoryDescription"></p>
                  </div>
                  <div class="trajectory-canvas-container">
                    <canvas id="recoveryTrajectoryChart"></canvas>
                  </div>
                  <div class="trajectory-legend" id="trajectoryLegend"></div>
                </div>

                <div class="privacy-footer">
                  <svg class="privacy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke-width="2"/>
                    <path d="M12 17V17.01M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span>Your information is protected and encrypted in accordance with HIPAA regulations</span>
                </div>
              </div>
            </div>

            <!-- Navigation Buttons -->
            <div class="wizard-nav">
              <button type="button" class="btn btn-secondary" id="prevBtn" style="display:none;">← Previous</button>
              <div class="nav-spacer"></div>
              <div id="saveStatus" class="save-status">Autosave: Not saved</div>
              <button type="button" class="btn btn-tertiary" id="startOverBtn" style="display:none;">Start over</button>
              <button type="button" class="btn btn-primary" id="nextBtn">Continue →</button>
              <button type="submit" class="btn btn-success" id="submitBtn" style="display:none;">Submit Assessment</button>
            </div>
          </form>
        </div>
      </main>

      <!-- Mobile Bottom Navigation -->
      <div class="mobile-bottom-nav">
        <button type="button" class="mobile-nav-btn btn-back" id="mobileBackBtn" style="display:none;">
          <span class="nav-icon">←</span>
          <span class="nav-label">Back</span>
        </button>
        <div class="mobile-step-indicator">
          <span id="mobileStepNum">1</span> of 5
        </div>
        <button type="button" class="mobile-nav-btn" id="mobileNextBtn">
          <span class="nav-label">Next</span>
          <span class="nav-icon">→</span>
        </button>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      <script src="/static/recovery-benchmarks.js?v=${BUILD_VERSION}"></script>
      <script src="/static/pain-map-data.js?v=${BUILD_VERSION}"></script>
      <script src="/static/wizard.js?v=${BUILD_VERSION}"></script>
    </body>
    </html>
  `)
})

export default app
