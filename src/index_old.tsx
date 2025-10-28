import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

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
    
    // In production, you would:
    // 1. Validate the data
    // 2. Save to Cloudflare D1 database
    // 3. Send confirmation email
    // 4. Trigger any necessary workflows
    
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
      <main class="container">
        <header class="hero">
          <div class="hero-icons">
            <span class="icon">📊</span>
            <h1>Objective metrics tracking for measurable outcomes</h1>
          </div>
          <div class="hero-sub">
            <p class="secure"><span class="icon">🔒</span> All information is confidential and HIPAA-compliant</p>
            <p class="autosave"><span class="icon">💾</span> Your responses are automatically saved as you progress</p>
            <p class="monitor"><span class="icon">📈</span> Monitor your recovery and treatment adherence</p>
          </div>
        </header>

        <form id="intakeForm" class="form" novalidate>
          <section class="personal">
            <label>
              Full Name *
              <input type="text" name="fullName" id="fullName" required />
            </label>

            <label>
              Email Address *
              <input type="email" name="email" id="email" required />
            </label>

            <label>
              Phone Number
              <input type="tel" name="phone" id="phone" />
            </label>

            <label>
              Date of Birth
              <input type="date" name="dob" id="dob" />
            </label>
          </section>

          <section class="body-map">
            <h2>Selected Pain Areas:</h2>
            <div id="selectedAreas" class="selected-areas">No areas selected yet</div>

            <div class="areas-grid" role="group" aria-label="Body pain areas">
              <button type="button" class="area-btn" data-area="Head">Head</button>
              <button type="button" class="area-btn" data-area="Neck">Neck</button>
              <button type="button" class="area-btn" data-area="L.Shoulder">L.Shoulder</button>
              <button type="button" class="area-btn" data-area="R.Shoulder">R.Shoulder</button>
              <button type="button" class="area-btn" data-area="Upper Back">Upper Back</button>
              <button type="button" class="area-btn" data-area="Lower Back">Lower Back</button>
              <button type="button" class="area-btn" data-area="L.Arm">L.Arm</button>
              <button type="button" class="area-btn" data-area="R.Arm">R.Arm</button>
              <button type="button" class="area-btn" data-area="L.Hip">L.Hip</button>
              <button type="button" class="area-btn" data-area="R.Hip">R.Hip</button>
              <button type="button" class="area-btn" data-area="L.Leg">L.Leg</button>
              <button type="button" class="area-btn" data-area="R.Leg">R.Leg</button>
              <button type="button" class="area-btn" data-area="L.Knee">L.Knee</button>
              <button type="button" class="area-btn" data-area="R.Knee">R.Knee</button>
              <button type="button" class="area-btn" data-area="L.Foot">L.Foot</button>
              <button type="button" class="area-btn" data-area="R.Foot">R.Foot</button>
            </div>
          </section>

          <section class="pain-details">
            <label>
              How long have you had this pain? *
              <select name="painDuration" id="painDuration" required>
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
            </label>

            <label>
              Pain Intensity (0-10)
              <div class="slider-row">
                <span class="slider-label">No Pain</span>
                <input type="range" min="0" max="10" value="5" id="painIntensity" name="painIntensity" />
                <span class="slider-label">Worst Pain</span>
              </div>
              <div class="slider-value" id="sliderValue">5</div>
            </label>
          </section>

          <section class="red-flags">
            <h3>⚠️ Important: If you're experiencing any of these red flag symptoms, please seek immediate medical attention.</h3>
            <div class="checkbox-grid">
              <label><input type="checkbox" name="redFlags" value="Recent trauma or injury" /> Recent trauma or injury</label>
              <label><input type="checkbox" name="redFlags" value="Loss of bowel/bladder control" /> Loss of bowel/bladder control</label>
              <label><input type="checkbox" name="redFlags" value="Fever or unexplained weight loss" /> Fever or unexplained weight loss</label>
              <label><input type="checkbox" name="redFlags" value="Severe night pain" /> Severe night pain</label>
              <label><input type="checkbox" name="redFlags" value="Pain getting progressively worse" /> Pain getting progressively worse</label>
              <label><input type="checkbox" name="redFlags" value="Numbness or tingling" /> Numbness or tingling</label>
              <label><input type="checkbox" name="redFlags" value="Muscle weakness" /> Muscle weakness</label>
            </div>
          </section>

          <section class="history">
            <label>
              How did your pain/injury start?
              <select name="painStart" required>
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
            </label>

            <label>
              Previous orthopaedic conditions or surgeries (select all that apply):
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
            </label>

            <label>
              Current treatments you're receiving (select all that apply):
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
            </label>

            <label>
              Current medications (select all that apply):
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
            </label>

            <label>
              Do you use any mobility aids? (select all that apply)
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
            </label>

            <label>
              How does your condition affect daily activities? (select all that apply)
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
            </label>

            <label>
              Additional medical history (select all that apply):
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
            </label>
          </section>

          <section class="goals">
            <h3>What would you like to achieve? (Select your top priorities)</h3>
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

            <label>
              What is your expected timeline for recovery/improvement?
              <select name="timeline">
                <option value="">Select timeline...</option>
                <option value="1-2 weeks">1-2 weeks</option>
                <option value="3-4 weeks">3-4 weeks</option>
                <option value="1-2 months">1-2 months</option>
                <option value="3-6 months">3-6 months</option>
                <option value="6-12 months">6-12 months</option>
                <option value="More than 1 year">More than 1 year</option>
                <option value="Uncertain">Uncertain</option>
              </select>
            </label>

            <label>
              Specific activities or milestones you want to achieve (select all that apply):
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
            </label>

            <label>
              Primary concerns about treatment (select all that apply):
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
            </label>
          </section>

          <section class="consent">
            <label><input type="checkbox" id="consent" name="consent" required /> I consent to the collection and use of my health information for assessment and treatment purposes.</label>
          </section>

          <footer class="form-footer">
            <div id="saveStatus" class="save-status">Autosave: Not saved</div>
            <button type="submit" id="submitBtn">Submit Assessment</button>
          </footer>
        </form>
      </main>

      <!-- Modal for red-flag alert -->
      <div id="redFlagModal" class="modal" aria-hidden="true">
        <div class="modal-content" role="dialog" aria-modal="true">
          <h2>⚠️ Important Medical Alert</h2>
          <p>One or more red flag symptoms were selected. If you are experiencing any red flag symptoms, please seek immediate medical attention or call emergency services.</p>
          <button id="closeModal">I Understand</button>
        </div>
      </div>

      <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
