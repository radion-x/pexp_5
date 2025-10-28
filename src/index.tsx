import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { join } from 'node:path'

const app = new Hono()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static assets when running under Node
app.use('/static/*', serveStatic({ root: join(process.cwd(), 'public') }))

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
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>PEXP - Patient Experience Assessment Platform</title>
      <link rel="stylesheet" href="/static/styles.css" />
    </head>
    <body>
      <!-- Progress Steps -->
      <div class="wizard-header">
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
                  <span class="hero-icon">📊</span>
                  <h1>Welcome to PEXP</h1>
                  <p class="subtitle">Objective metrics tracking for measurable outcomes</p>
                </div>
                
                <div class="info-cards">
                  <div class="info-card">
                    <span class="info-icon">🔒</span>
                    <p>All information is confidential and HIPAA-compliant</p>
                  </div>
                  <div class="info-card">
                    <span class="info-icon">💾</span>
                    <p>Your responses are automatically saved as you progress</p>
                  </div>
                  <div class="info-card">
                    <span class="info-icon">📈</span>
                    <p>Monitor your recovery and treatment adherence</p>
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
                    <label>Date of Birth</label>
                    <input type="date" name="dob" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2: Pain Map -->
            <div class="wizard-step" data-step="2">
              <div class="step-content">
                <h2>Pain Location & Duration</h2>
                <p class="step-description">Click on the areas of your body where you experience pain. You can select multiple locations.</p>
                
                <div class="pain-map-section">
                  <div class="body-map-container">
                    <div class="view-toggle">
                      <button type="button" class="view-btn active" data-view="front">Front View</button>
                      <button type="button" class="view-btn" data-view="back">Back View</button>
                    </div>
                    
                    <div class="selected-areas-display">
                      <strong>Selected Pain Areas:</strong>
                      <span id="selectedAreas">No areas selected yet</span>
                    </div>

                    <!-- Front View -->
                    <div class="body-diagram active" data-view="front">
                      <svg viewBox="0 0 300 500" class="body-svg">
                        <!-- Head -->
                        <ellipse cx="150" cy="40" rx="25" ry="30" class="body-part" data-area="Head" />
                        <text x="150" y="45" text-anchor="middle" class="body-label">Head</text>
                        
                        <!-- Neck -->
                        <rect x="140" y="65" width="20" height="20" class="body-part" data-area="Neck" />
                        <text x="150" y="78" text-anchor="middle" class="body-label">Neck</text>
                        
                        <!-- Shoulders -->
                        <circle cx="110" cy="95" r="18" class="body-part" data-area="L.Shoulder" />
                        <text x="110" y="100" text-anchor="middle" class="body-label">L.Shoulder</text>
                        
                        <circle cx="190" cy="95" r="18" class="body-part" data-area="R.Shoulder" />
                        <text x="190" y="100" text-anchor="middle" class="body-label">R.Shoulder</text>
                        
                        <!-- Chest/Upper Back -->
                        <rect x="125" y="90" width="50" height="40" class="body-part" data-area="Chest" />
                        <text x="150" y="115" text-anchor="middle" class="body-label">Chest</text>
                        
                        <!-- Arms -->
                        <rect x="85" y="115" width="20" height="80" class="body-part" data-area="L.Arm" />
                        <text x="95" y="155" text-anchor="middle" class="body-label">L.Arm</text>
                        
                        <rect x="195" y="115" width="20" height="80" class="body-part" data-area="R.Arm" />
                        <text x="205" y="155" text-anchor="middle" class="body-label">R.Arm</text>
                        
                        <!-- Abdomen -->
                        <rect x="125" y="135" width="50" height="40" class="body-part" data-area="Abdomen" />
                        <text x="150" y="158" text-anchor="middle" class="body-label">Abdomen</text>
                        
                        <!-- Hips -->
                        <circle cx="130" cy="195" r="18" class="body-part" data-area="L.Hip" />
                        <text x="130" y="200" text-anchor="middle" class="body-label">L.Hip</text>
                        
                        <circle cx="170" cy="195" r="18" class="body-part" data-area="R.Hip" />
                        <text x="170" y="200" text-anchor="middle" class="body-label">R.Hip</text>
                        
                        <!-- Thighs -->
                        <rect x="120" y="220" width="25" height="80" class="body-part" data-area="L.Thigh" />
                        <text x="132" y="260" text-anchor="middle" class="body-label">L.Thigh</text>
                        
                        <rect x="155" y="220" width="25" height="80" class="body-part" data-area="R.Thigh" />
                        <text x="167" y="260" text-anchor="middle" class="body-label">R.Thigh</text>
                        
                        <!-- Knees -->
                        <circle cx="132" cy="315" r="18" class="body-part" data-area="L.Knee" />
                        <text x="132" y="320" text-anchor="middle" class="body-label">L.Knee</text>
                        
                        <circle cx="167" cy="315" r="18" class="body-part" data-area="R.Knee" />
                        <text x="167" y="320" text-anchor="middle" class="body-label">R.Knee</text>
                        
                        <!-- Lower Legs -->
                        <rect x="120" y="340" width="25" height="80" class="body-part" data-area="L.Leg" />
                        <text x="132" y="380" text-anchor="middle" class="body-label">L.Leg</text>
                        
                        <rect x="155" y="340" width="25" height="80" class="body-part" data-area="R.Leg" />
                        <text x="167" y="380" text-anchor="middle" class="body-label">R.Leg</text>
                        
                        <!-- Feet -->
                        <ellipse cx="132" cy="440" rx="18" ry="25" class="body-part" data-area="L.Foot" />
                        <text x="132" y="445" text-anchor="middle" class="body-label">L.Foot</text>
                        
                        <ellipse cx="167" cy="440" rx="18" ry="25" class="body-part" data-area="R.Foot" />
                        <text x="167" y="445" text-anchor="middle" class="body-label">R.Foot</text>
                      </svg>
                    </div>

                    <!-- Back View -->
                    <div class="body-diagram" data-view="back">
                      <svg viewBox="0 0 300 500" class="body-svg">
                        <!-- Head Back -->
                        <ellipse cx="150" cy="40" rx="25" ry="30" class="body-part" data-area="Head (Back)" />
                        <text x="150" y="45" text-anchor="middle" class="body-label">Head</text>
                        
                        <!-- Neck Back -->
                        <rect x="140" y="65" width="20" height="20" class="body-part" data-area="Neck (Back)" />
                        <text x="150" y="78" text-anchor="middle" class="body-label">Neck</text>
                        
                        <!-- Shoulders Back -->
                        <circle cx="110" cy="95" r="18" class="body-part" data-area="L.Shoulder (Back)" />
                        <text x="110" y="100" text-anchor="middle" class="body-label">L.Shoulder</text>
                        
                        <circle cx="190" cy="95" r="18" class="body-part" data-area="R.Shoulder (Back)" />
                        <text x="190" y="100" text-anchor="middle" class="body-label">R.Shoulder</text>
                        
                        <!-- Upper Back -->
                        <rect x="125" y="90" width="50" height="40" class="body-part" data-area="Upper Back" />
                        <text x="150" y="115" text-anchor="middle" class="body-label">Upper Back</text>
                        
                        <!-- Arms Back -->
                        <rect x="85" y="115" width="20" height="80" class="body-part" data-area="L.Arm (Back)" />
                        <text x="95" y="155" text-anchor="middle" class="body-label">L.Arm</text>
                        
                        <rect x="195" y="115" width="20" height="80" class="body-part" data-area="R.Arm (Back)" />
                        <text x="205" y="155" text-anchor="middle" class="body-label">R.Arm</text>
                        
                        <!-- Lower Back -->
                        <rect x="125" y="135" width="50" height="40" class="body-part" data-area="Lower Back" />
                        <text x="150" y="158" text-anchor="middle" class="body-label">Lower Back</text>
                        
                        <!-- Glutes -->
                        <circle cx="130" cy="195" r="18" class="body-part" data-area="L.Glute" />
                        <text x="130" y="200" text-anchor="middle" class="body-label">L.Glute</text>
                        
                        <circle cx="170" cy="195" r="18" class="body-part" data-area="R.Glute" />
                        <text x="170" y="200" text-anchor="middle" class="body-label">R.Glute</text>
                        
                        <!-- Hamstrings -->
                        <rect x="120" y="220" width="25" height="80" class="body-part" data-area="L.Hamstring" />
                        <text x="132" y="260" text-anchor="middle" class="body-label">L.Hamstring</text>
                        
                        <rect x="155" y="220" width="25" height="80" class="body-part" data-area="R.Hamstring" />
                        <text x="167" y="260" text-anchor="middle" class="body-label">R.Hamstring</text>
                        
                        <!-- Knees Back -->
                        <circle cx="132" cy="315" r="18" class="body-part" data-area="L.Knee (Back)" />
                        <text x="132" y="320" text-anchor="middle" class="body-label">L.Knee</text>
                        
                        <circle cx="167" cy="315" r="18" class="body-part" data-area="R.Knee (Back)" />
                        <text x="167" y="320" text-anchor="middle" class="body-label">R.Knee</text>
                        
                        <!-- Calves -->
                        <rect x="120" y="340" width="25" height="80" class="body-part" data-area="L.Calf" />
                        <text x="132" y="380" text-anchor="middle" class="body-label">L.Calf</text>
                        
                        <rect x="155" y="340" width="25" height="80" class="body-part" data-area="R.Calf" />
                        <text x="167" y="380" text-anchor="middle" class="body-label">R.Calf</text>
                        
                        <!-- Feet Back -->
                        <ellipse cx="132" cy="440" rx="18" ry="25" class="body-part" data-area="L.Foot (Back)" />
                        <text x="132" y="445" text-anchor="middle" class="body-label">L.Foot</text>
                        
                        <ellipse cx="167" cy="440" rx="18" ry="25" class="body-part" data-area="R.Foot (Back)" />
                        <text x="167" y="445" text-anchor="middle" class="body-label">R.Foot</text>
                      </svg>
                    </div>
                  </div>

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

                    <div class="form-group">
                      <label>Pain Intensity (0-10)</label>
                      <div class="slider-container">
                        <span class="slider-label">No Pain</span>
                        <input type="range" min="0" max="10" value="5" name="painIntensity" id="painIntensity" />
                        <span class="slider-label">Worst Pain</span>
                      </div>
                      <div class="slider-value" id="sliderValue">5</div>
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

                <div class="consent-section">
                  <label class="consent-label">
                    <input type="checkbox" name="consent" required />
                    <span>I consent to the collection and use of my health information for assessment and treatment purposes in accordance with HIPAA regulations.</span>
                  </label>
                </div>

                <div class="privacy-notice">
                  <p>🔒 Your information is protected and will be handled in accordance with HIPAA regulations. All data is encrypted and secure.</p>
                </div>
              </div>
            </div>

            <!-- Navigation Buttons -->
            <div class="wizard-nav">
              <button type="button" class="btn btn-secondary" id="prevBtn" style="display:none;">← Previous</button>
              <div class="nav-spacer"></div>
              <div id="saveStatus" class="save-status">Autosave: Not saved</div>
              <button type="button" class="btn btn-primary" id="nextBtn">Continue →</button>
              <button type="submit" class="btn btn-success" id="submitBtn" style="display:none;">Submit Assessment</button>
            </div>
          </form>
        </div>
      </main>

      <!-- Modal for red-flag alert -->
      <div id="redFlagModal" class="modal" aria-hidden="true">
        <div class="modal-content" role="dialog" aria-modal="true">
          <h2>⚠️ Important Medical Alert</h2>
          <p>One or more red flag symptoms were selected. If you are experiencing any red flag symptoms, please seek immediate medical attention or call emergency services.</p>
          <button id="closeModal" class="btn btn-danger">I Understand</button>
        </div>
      </div>

      <script src="/static/wizard.js"></script>
    </body>
    </html>
  `)
})

export default app
