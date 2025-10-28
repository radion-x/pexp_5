// PEXP - Patient Experience Assessment Platform
// Frontend JavaScript

(function() {
  'use strict';

  const form = document.getElementById('intakeForm');
  const areaButtons = document.querySelectorAll('.area-btn');
  const selectedAreasEl = document.getElementById('selectedAreas');
  const slider = document.getElementById('painIntensity');
  const sliderValue = document.getElementById('sliderValue');
  const redFlagModal = document.getElementById('redFlagModal');
  const closeModalBtn = document.getElementById('closeModal');
  const saveStatus = document.getElementById('saveStatus');
  const submitBtn = document.getElementById('submitBtn');
  
  const RED_FLAG_NAME = 'redFlags';
  const STORAGE_KEY = 'pexp_intake_autosave_v1';
  let autosaveTimer = null;

  // Initialize slider feedback
  sliderValue.textContent = slider.value;
  slider.addEventListener('input', () => {
    sliderValue.textContent = slider.value;
    scheduleAutosave();
  });

  // Body area toggles
  function updateSelectedAreasUI() {
    const selected = [];
    areaButtons.forEach(btn => {
      if (btn.classList.contains('active')) {
        selected.push(btn.dataset.area);
      }
    });
    selectedAreasEl.textContent = selected.length 
      ? selected.join(', ') 
      : 'No areas selected yet';
  }

  areaButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      updateSelectedAreasUI();
      scheduleAutosave();
    });
  });

  // Red flag handling: show modal whenever any red-flag checked
  function checkRedFlags() {
    const checked = Array.from(
      form.querySelectorAll(`input[name="${RED_FLAG_NAME}"]:checked`)
    );
    if (checked.length > 0) {
      redFlagModal.setAttribute('aria-hidden', 'false');
    }
  }

  document.querySelectorAll(`input[name="${RED_FLAG_NAME}"]`).forEach(cb => {
    cb.addEventListener('change', () => {
      checkRedFlags();
      scheduleAutosave();
    });
  });

  closeModalBtn.addEventListener('click', () => {
    redFlagModal.setAttribute('aria-hidden', 'true');
  });

  // Close modal on backdrop click
  redFlagModal.addEventListener('click', (e) => {
    if (e.target === redFlagModal) {
      redFlagModal.setAttribute('aria-hidden', 'true');
    }
  });

  // Serialize form to object
  function serializeForm() {
    const data = {};
    const fd = new FormData(form);
    
    // Handle multi-selects and multiple checkboxes
    for (const [k, v] of fd.entries()) {
      if (data[k]) {
        // Convert to array if multiple values
        if (Array.isArray(data[k])) {
          data[k].push(v);
        } else {
          data[k] = [data[k], v];
        }
      } else {
        data[k] = v;
      }
    }
    
    // Include selected body areas (from buttons)
    data.selectedAreas = Array.from(
      document.querySelectorAll('.area-btn.active')
    ).map(b => b.dataset.area);
    
    data._savedAt = new Date().toISOString();
    return data;
  }

  // Autosave - localStorage (client-side)
  // In production, POST to secure server
  function saveToLocal() {
    const data = serializeForm();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const time = new Date().toLocaleTimeString();
      saveStatus.textContent = `Autosave: ${time}`;
      saveStatus.style.color = '#16a34a';
    } catch (e) {
      console.error('Autosave failed', e);
      saveStatus.textContent = 'Autosave: failed';
      saveStatus.style.color = '#e53935';
    }
  }

  // Schedule autosave (debounced)
  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveToLocal, 800);
    saveStatus.textContent = 'Autosave: saving...';
    saveStatus.style.color = '#6b7280';
  }

  // Restore if present
  function restoreFromLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    
    try {
      const obj = JSON.parse(raw);
      
      // Restore common inputs
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'selectedAreas' || k === '_savedAt') continue;
        
        const el = form.elements[k];
        if (!el) continue;
        
        if (el instanceof NodeList || el.length > 1) {
          // Multiple selects/checkboxes
          if (Array.isArray(v)) {
            Array.from(el).forEach(opt => {
              if (opt.type === 'checkbox' || opt.type === 'radio') {
                opt.checked = v.includes(opt.value);
              } else {
                // Multi-select
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
      
      // Restore selected areas
      if (Array.isArray(obj.selectedAreas)) {
        areaButtons.forEach(btn => {
          btn.classList.toggle(
            'active', 
            obj.selectedAreas.includes(btn.dataset.area)
          );
        });
      }
      
      updateSelectedAreasUI();
      
      const savedTime = new Date(obj._savedAt).toLocaleString();
      saveStatus.textContent = `Restored from ${savedTime}`;
      saveStatus.style.color = '#16a34a';
    } catch (e) {
      console.warn('Restore failed', e);
    }
  }

  // Attach input listeners for autosave
  form.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('input', scheduleAutosave);
    el.addEventListener('change', scheduleAutosave);
  });

  // Form submit handler
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    
    // Basic client validation
    if (!form.checkValidity()) {
      saveStatus.textContent = 'Please complete required fields';
      saveStatus.style.color = '#e53935';
      form.reportValidity();
      return;
    }

    // Serialize and send
    const payload = serializeForm();

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    saveStatus.textContent = 'Submitting assessment...';
    saveStatus.style.color = '#0b84ff';

    try {
      const resp = await fetch('/api/submit-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (resp.ok) {
        const result = await resp.json();
        saveStatus.textContent = 'Assessment submitted successfully! ✓';
        saveStatus.style.color = '#16a34a';
        
        // Clear autosave
        localStorage.removeItem(STORAGE_KEY);
        
        // Show success message
        setTimeout(() => {
          alert('Thank you! Your assessment has been submitted successfully. A healthcare provider will review your information shortly.');
          form.reset();
          areaButtons.forEach(btn => btn.classList.remove('active'));
          updateSelectedAreasUI();
          sliderValue.textContent = '5';
        }, 500);
      } else {
        const error = await resp.text();
        saveStatus.textContent = 'Submission failed. Please try again.';
        saveStatus.style.color = '#e53935';
        console.error('Server error:', error);
      }
    } catch (err) {
      console.error('Submit error:', err);
      saveStatus.textContent = 'Network error. Please check your connection.';
      saveStatus.style.color = '#e53935';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Assessment';
    }
  });

  // Periodic autosave (in addition to input-driven)
  setInterval(saveToLocal, 30000); // every 30 seconds

  // Restore on load
  restoreFromLocal();

  // Initial red-flag check if restoring
  checkRedFlags();

  // Keyboard accessibility for modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && redFlagModal.getAttribute('aria-hidden') === 'false') {
      redFlagModal.setAttribute('aria-hidden', 'true');
    }
  });

  console.log('PEXP Assessment Platform initialized');
})();
