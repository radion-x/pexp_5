// PEXP Wizard - Patient Experience Assessment Platform
(function() {
  'use strict';

  // State
  let currentStep = 1;
  const totalSteps = 5;
  const selectedPainAreas = new Set();
  const STORAGE_KEY = 'pexp_wizard_autosave_v2';
  let autosaveTimer = null;

  // Elements
  const form = document.getElementById('intakeForm');
  const wizardSteps = document.querySelectorAll('.wizard-step');
  const headerSteps = document.querySelectorAll('.wizard-header .step');
  const sidebarSteps = document.querySelectorAll('.sidebar-step');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');
  const saveStatus = document.getElementById('saveStatus');
  const progressCircle = document.getElementById('progressCircle');
  const progressText = document.getElementById('progressText');
  const selectedAreasEl = document.getElementById('selectedAreas');
  const painSlider = document.getElementById('painIntensity');
  const sliderValue = document.getElementById('sliderValue');
  const redFlagModal = document.getElementById('redFlagModal');
  const closeModalBtn = document.getElementById('closeModal');

  // Body map elements
  const viewBtns = document.querySelectorAll('.view-btn');
  const bodyDiagrams = document.querySelectorAll('.body-diagram');
  const bodyParts = document.querySelectorAll('.body-part');

  // Initialize
  function init() {
    setupEventListeners();
    restoreProgress();
    updateProgress();
    updateNavigation();
  }

  // Event Listeners
  function setupEventListeners() {
    // Navigation buttons
    prevBtn.addEventListener('click', previousStep);
    nextBtn.addEventListener('click', nextStep);
    form.addEventListener('submit', handleSubmit);

    // Pain slider
    if (painSlider) {
      painSlider.addEventListener('input', () => {
        sliderValue.textContent = painSlider.value;
        scheduleAutosave();
      });
    }

    // View toggle buttons
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        bodyDiagrams.forEach(diagram => {
          diagram.classList.toggle('active', diagram.dataset.view === view);
        });
      });
    });

    // Body parts selection
    bodyParts.forEach(part => {
      part.addEventListener('click', () => {
        const area = part.dataset.area;
        if (selectedPainAreas.has(area)) {
          selectedPainAreas.delete(area);
          part.classList.remove('selected');
        } else {
          selectedPainAreas.add(area);
          part.classList.add('selected');
        }
        updateSelectedAreas();
        scheduleAutosave();
      });
    });

    // Red flag checkboxes
    const redFlagInputs = document.querySelectorAll('input[name="redFlags"]');
    redFlagInputs.forEach(input => {
      input.addEventListener('change', () => {
        checkRedFlags();
        scheduleAutosave();
      });
    });

    // Modal close
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        redFlagModal.setAttribute('aria-hidden', 'true');
      });
    }

    if (redFlagModal) {
      redFlagModal.addEventListener('click', (e) => {
        if (e.target === redFlagModal) {
          redFlagModal.setAttribute('aria-hidden', 'true');
        }
      });
    }

    // Form inputs autosave
    form.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', scheduleAutosave);
      el.addEventListener('change', scheduleAutosave);
    });

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && redFlagModal.getAttribute('aria-hidden') === 'false') {
        redFlagModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Navigation
  function showStep(step) {
    // Hide all steps
    wizardSteps.forEach(s => s.classList.remove('active'));
    
    // Show current step
    const stepElement = document.querySelector(`.wizard-step[data-step="${step}"]`);
    if (stepElement) {
      stepElement.classList.add('active');
    }

    // Update header steps
    headerSteps.forEach((s, index) => {
      s.classList.remove('active', 'completed');
      if (index + 1 < step) {
        s.classList.add('completed');
      } else if (index + 1 === step) {
        s.classList.add('active');
      }
    });

    // Update sidebar steps
    sidebarSteps.forEach((s, index) => {
      s.classList.remove('active', 'completed');
      if (index + 1 < step) {
        s.classList.add('completed');
      } else if (index + 1 === step) {
        s.classList.add('active');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    currentStep = step;
    updateProgress();
    updateNavigation();

    // Generate review if on last step
    if (step === totalSteps) {
      generateReview();
    }
  }

  function nextStep() {
    // Validate current step
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep < totalSteps) {
      showStep(currentStep + 1);
    }
  }

  function previousStep() {
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  }

  function updateNavigation() {
    // Previous button
    prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';

    // Next/Submit buttons
    if (currentStep === totalSteps) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display = 'inline-flex';
      submitBtn.style.display = 'none';
    }
  }

  function validateStep(step) {
    const stepElement = document.querySelector(`.wizard-step[data-step="${step}"]`);
    if (!stepElement) return true;

    const inputs = stepElement.querySelectorAll('input[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
      if (!input.checkValidity()) {
        input.reportValidity();
        isValid = false;
      }
    });

    return isValid;
  }

  // Progress
  function updateProgress() {
    const percentage = Math.round((currentStep / totalSteps) * 100);
    const circumference = 283; // 2 * Math.PI * 45
    const offset = circumference - (percentage / 100) * circumference;

    if (progressCircle) {
      progressCircle.style.strokeDashoffset = offset;
    }

    if (progressText) {
      progressText.textContent = percentage + '%';
    }
  }

  // Pain Areas
  function updateSelectedAreas() {
    if (selectedAreasEl) {
      if (selectedPainAreas.size === 0) {
        selectedAreasEl.textContent = 'No areas selected yet';
      } else {
        selectedAreasEl.textContent = Array.from(selectedPainAreas).join(', ');
      }
    }
  }

  // Red Flags
  function checkRedFlags() {
    const checked = Array.from(document.querySelectorAll('input[name="redFlags"]:checked'));
    if (checked.length > 0 && redFlagModal) {
      redFlagModal.setAttribute('aria-hidden', 'false');
    }
  }

  // Review Summary
  function generateReview() {
    const reviewSummary = document.getElementById('reviewSummary');
    if (!reviewSummary) return;

    const formData = serializeForm();
    let html = '';

    // Personal Information
    html += '<div class="review-section">';
    html += '<h3>Personal Information</h3>';
    if (formData.fullName) html += `<div class="review-item"><span class="review-label">Name:</span><span class="review-value">${formData.fullName}</span></div>`;
    if (formData.email) html += `<div class="review-item"><span class="review-label">Email:</span><span class="review-value">${formData.email}</span></div>`;
    if (formData.phone) html += `<div class="review-item"><span class="review-label">Phone:</span><span class="review-value">${formData.phone}</span></div>`;
    if (formData.dob) html += `<div class="review-item"><span class="review-label">Date of Birth:</span><span class="review-value">${formData.dob}</span></div>`;
    html += '</div>';

    // Pain Information
    html += '<div class="review-section">';
    html += '<h3>Pain Information</h3>';
    if (selectedPainAreas.size > 0) {
      html += `<div class="review-item"><span class="review-label">Pain Areas:</span><span class="review-value">${Array.from(selectedPainAreas).join(', ')}</span></div>`;
    }
    if (formData.painDuration) html += `<div class="review-item"><span class="review-label">Duration:</span><span class="review-value">${formData.painDuration}</span></div>`;
    if (formData.painIntensity) html += `<div class="review-item"><span class="review-label">Intensity:</span><span class="review-value">${formData.painIntensity}/10</span></div>`;
    html += '</div>';

    // Medical History
    if (formData.painStart || (formData.redFlags && formData.redFlags.length > 0)) {
      html += '<div class="review-section">';
      html += '<h3>Medical History</h3>';
      if (formData.painStart) html += `<div class="review-item"><span class="review-label">How it started:</span><span class="review-value">${formData.painStart}</span></div>`;
      if (formData.redFlags && formData.redFlags.length > 0) {
        html += `<div class="review-item"><span class="review-label">Red Flags:</span><span class="review-value">${Array.isArray(formData.redFlags) ? formData.redFlags.join(', ') : formData.redFlags}</span></div>`;
      }
      html += '</div>';
    }

    // Goals
    if (formData.goals && formData.goals.length > 0) {
      html += '<div class="review-section">';
      html += '<h3>Treatment Goals</h3>';
      html += `<div class="review-item"><span class="review-label">Goals:</span><span class="review-value">${Array.isArray(formData.goals) ? formData.goals.join(', ') : formData.goals}</span></div>`;
      if (formData.timeline) html += `<div class="review-item"><span class="review-label">Timeline:</span><span class="review-value">${formData.timeline}</span></div>`;
      html += '</div>';
    }

    reviewSummary.innerHTML = html || '<p>No information entered yet.</p>';
  }

  // Form Serialization
  function serializeForm() {
    const data = {};
    const fd = new FormData(form);

    for (const [k, v] of fd.entries()) {
      if (data[k]) {
        if (Array.isArray(data[k])) {
          data[k].push(v);
        } else {
          data[k] = [data[k], v];
        }
      } else {
        data[k] = v;
      }
    }

    data.selectedAreas = Array.from(selectedPainAreas);
    data.currentStep = currentStep;
    data._savedAt = new Date().toISOString();

    return data;
  }

  // Autosave
  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveToLocal, 800);
    if (saveStatus) {
      saveStatus.textContent = 'Saving...';
      saveStatus.style.color = '#6b7280';
    }
  }

  function saveToLocal() {
    const data = serializeForm();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (saveStatus) {
        const time = new Date().toLocaleTimeString();
        saveStatus.textContent = `Saved: ${time}`;
        saveStatus.style.color = '#16a34a';
      }
    } catch (e) {
      console.error('Autosave failed', e);
      if (saveStatus) {
        saveStatus.textContent = 'Save failed';
        saveStatus.style.color = '#e53935';
      }
    }
  }

  function restoreProgress() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const obj = JSON.parse(raw);

      // Restore form fields
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'selectedAreas' || k === 'currentStep' || k === '_savedAt') continue;

        const el = form.elements[k];
        if (!el) continue;

        if (el instanceof NodeList || el.length > 1) {
          if (Array.isArray(v)) {
            Array.from(el).forEach(opt => {
              if (opt.type === 'checkbox' || opt.type === 'radio') {
                opt.checked = v.includes(opt.value);
              } else {
                opt.selected = v.includes(opt.value);
              }
            });
          } else {
            Array.from(el).forEach(opt => {
              if (opt.value === v) opt.selected = true;
              if (opt.type === 'checkbox') opt.checked = (opt.value === v);
            });
          }
        } else {
          el.value = v;
        }
      }

      // Restore pain areas
      if (Array.isArray(obj.selectedAreas)) {
        obj.selectedAreas.forEach(area => {
          selectedPainAreas.add(area);
          const part = document.querySelector(`.body-part[data-area="${area}"]`);
          if (part) part.classList.add('selected');
        });
        updateSelectedAreas();
      }

      // Restore step
      if (obj.currentStep) {
        showStep(obj.currentStep);
      }

      if (saveStatus) {
        const savedTime = new Date(obj._savedAt).toLocaleString();
        saveStatus.textContent = `Restored from ${savedTime}`;
        saveStatus.style.color = '#16a34a';
      }
    } catch (e) {
      console.warn('Restore failed', e);
    }
  }

  // Form Submission
  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const payload = serializeForm();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    if (saveStatus) {
      saveStatus.textContent = 'Submitting...';
      saveStatus.style.color = '#0b84ff';
    }

    try {
      const resp = await fetch('/api/submit-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        if (saveStatus) {
          saveStatus.textContent = 'Submitted successfully! ✓';
          saveStatus.style.color = '#16a34a';
        }
        localStorage.removeItem(STORAGE_KEY);
        setTimeout(() => {
          alert('Thank you! Your assessment has been submitted successfully.');
          form.reset();
          selectedPainAreas.clear();
          bodyParts.forEach(part => part.classList.remove('selected'));
          updateSelectedAreas();
          showStep(1);
        }, 500);
      } else {
        throw new Error('Submission failed');
      }
    } catch (err) {
      console.error('Submit error:', err);
      if (saveStatus) {
        saveStatus.textContent = 'Submission failed';
        saveStatus.style.color = '#e53935';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Assessment';
    }
  }

  // Periodic autosave
  setInterval(saveToLocal, 30000);

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('PEXP Wizard initialized');
})();
