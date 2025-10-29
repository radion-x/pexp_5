// PEXP Wizard - Patient Experience Assessment Platform
(function() {
  'use strict';

  // State
  let currentStep = 1;
  const totalSteps = 5;
  const selectedPainAreas = new Set();
  const STORAGE_KEY = 'pexp_wizard_autosave_v2';
  let autosaveTimer = null;
  const painPointState = new Map();
  const painMarkerRefs = new Map();
  let isRestoring = false;
  let aiSummaryContent = '';
  let aiSummaryErrorMessage = '';
  let aiSummaryInFlight = false;
  let aiSummaryPayloadHash = '';
  let aiSummaryController = null;
  const defaultSummaryMessage = 'Check the consent box below, then select "Generate Summary" when you\'re ready.';
  const generateButtonDefaultLabel = 'Generate Summary';
  const generateButtonRepeatLabel = 'Generate Again';
  let hasRestoredDraft = false;

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
  const aiSummarySection = document.getElementById('aiSummarySection');
  const aiSummaryStatusEl = document.getElementById('aiSummaryStatus');
  const aiSummaryTextEl = document.getElementById('aiSummaryText');
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');
  const startOverBtn = document.getElementById('startOverBtn');
  const resumeBanner = document.getElementById('resumeBanner');
  const resumeContinueBtn = document.getElementById('resumeContinueBtn');
  const resumeStartOverBtn = document.getElementById('resumeStartOverBtn');

  function cancelAiSummaryRequest() {
    if (aiSummaryController) {
      aiSummaryController.abort();
      aiSummaryController = null;
    }
  }

  function hasSavedDraft() {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to access saved draft:', error);
      return false;
    }
  }

  function showResumeBanner() {
    if (resumeBanner) {
      resumeBanner.classList.remove('hidden');
    }
  }

  function hideResumeBanner() {
    if (resumeBanner) {
      resumeBanner.classList.add('hidden');
    }
  }

  // Body map elements
  const viewBtns = document.querySelectorAll('.view-btn');
  const bodyDiagrams = document.querySelectorAll('.body-diagram');
  const bodyMaps = Array.from(bodyDiagrams).map(diagram => {
    const view = diagram.dataset.view || 'front';
    const image = diagram.querySelector('.body-map-image');
    const layer = diagram.querySelector('.hotspot-layer');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return { view, diagram, image, layer, canvas, ctx };
  });

  // Initialize
  function init() {
    resetAiSummaryUI();
    setupEventListeners();
    if (hasSavedDraft()) {
      showResumeBanner();
      restoreProgress();
    } else {
      restoreProgress();
    }
    updateProgress();
    updateNavigation();
  }

  function getHotspotsForView(view) {
    const data = window.PAIN_MAP_DATA || {};
    if (view === 'back') {
      return Array.isArray(data.backHotspots) ? data.backHotspots : [];
    }
    return Array.isArray(data.frontHotspots) ? data.frontHotspots : [];
  }

  function correctAnatomicalLabel(name, view) {
    if (view !== 'front') return name;
    if (name.includes('Left')) {
      return name.replace('Left', 'Right');
    }
    if (name.includes('Right')) {
      return name.replace('Right', 'Left');
    }
    return name;
  }

  function intensityCategory(value) {
    if (value <= 3) return 'low';
    if (value <= 7) return 'medium';
    return 'high';
  }

  function updateAiSummaryStatus(message, state) {
    if (!aiSummaryStatusEl) return;
    aiSummaryStatusEl.textContent = message;
    if (state) {
      aiSummaryStatusEl.setAttribute('data-state', state);
    } else {
      aiSummaryStatusEl.removeAttribute('data-state');
    }
  }

  function renderAiSummaryContent() {
    if (!aiSummaryTextEl) return;
    aiSummaryTextEl.innerHTML = aiSummaryContent || '';
  }

  function resetAiSummaryUI() {
    cancelAiSummaryRequest();
    aiSummaryContent = '';
    aiSummaryErrorMessage = '';
    aiSummaryPayloadHash = '';
    aiSummaryInFlight = false;
    renderAiSummaryContent();
    updateAiSummaryStatus(defaultSummaryMessage);
    if (generateSummaryBtn) {
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.textContent = generateButtonDefaultLabel;
    }
  }

  async function generateAiSummary(force = false) {
    if (!aiSummarySection || !aiSummaryStatusEl) return;

    if (aiSummaryInFlight) {
      if (!force) return;
      cancelAiSummaryRequest();
    }

    const payload = serializeForm();

    if (!payload.consent) {
      cancelAiSummaryRequest();
      aiSummaryErrorMessage = 'Consent is required to generate an AI summary.';
      aiSummaryContent = '';
      aiSummaryPayloadHash = '';
      renderAiSummaryContent();
      updateAiSummaryStatus('Please confirm consent to enable AI summary.', 'error');
      scheduleAutosave();
      return;
    }

    const summaryInput = { ...payload };
    delete summaryInput.aiSummary;
    delete summaryInput.aiSummaryError;
    delete summaryInput.currentStep;
    delete summaryInput._savedAt;

    const payloadHash = JSON.stringify(summaryInput);

    if (!force && aiSummaryPayloadHash === payloadHash && aiSummaryContent) {
      return;
    }

    cancelAiSummaryRequest();
    aiSummaryInFlight = true;
    aiSummaryErrorMessage = '';
    aiSummaryContent = '';
    renderAiSummaryContent();
    updateAiSummaryStatus('Connecting to AI...', 'loading');
    if (generateSummaryBtn) {
      generateSummaryBtn.disabled = true;
      generateSummaryBtn.textContent = 'Generating...';
    }

    const controller = new AbortController();
    aiSummaryController = controller;

    try {
      const response = await fetch('/api/generate-summary/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summaryInput),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const message = `AI summary failed (Status: ${response.status})`;
        throw new Error(message);
      }

      aiSummaryPayloadHash = payloadHash;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedAnyChunk = false;

      const processBuffer = async () => {
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) {
            continue;
          }

          const payloadText = line.slice(5).trim();
          if (!payloadText) continue;

          let event;
          try {
            event = JSON.parse(payloadText);
          } catch {
            continue;
          }

          const eventType = event.event || 'delta';

          if (eventType === 'status') {
            updateAiSummaryStatus(event.message || 'Generating clinical summary...', 'loading');
          } else if (eventType === 'delta') {
            const htmlChunk = event.html || event.text || '';
            if (htmlChunk) {
              receivedAnyChunk = true;
              aiSummaryContent += htmlChunk;
              renderAiSummaryContent();
              updateAiSummaryStatus('Generating clinical summary...', 'loading');
            }
          } else if (eventType === 'complete') {
            if (typeof event.html === 'string' && event.html.trim()) {
              aiSummaryContent = event.html;
              renderAiSummaryContent();
            }
            updateAiSummaryStatus(`Summary generated at ${new Date().toLocaleTimeString()}.`, 'success');
            scheduleAutosave();
          } else if (eventType === 'error') {
            const message = event.message || 'AI summary could not be generated.';
            throw new Error(message);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          await processBuffer();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        await processBuffer();
      }

      if (!aiSummaryContent && !receivedAnyChunk) {
        throw new Error('AI summary was empty.');
      }

      if (!aiSummaryStatusEl.getAttribute('data-state') || aiSummaryStatusEl.getAttribute('data-state') === 'loading') {
        updateAiSummaryStatus(`Summary generated at ${new Date().toLocaleTimeString()}.`, 'success');
      }
      scheduleAutosave();
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error generating AI summary.';
      aiSummaryContent = '';
      aiSummaryPayloadHash = '';
      aiSummaryErrorMessage = message;
      renderAiSummaryContent();
      updateAiSummaryStatus(message, 'error');
      scheduleAutosave();
    } finally {
      aiSummaryInFlight = false;
      cancelAiSummaryRequest();
      if (generateSummaryBtn) {
        generateSummaryBtn.disabled = false;
        generateSummaryBtn.textContent = aiSummaryContent ? generateButtonRepeatLabel : generateButtonDefaultLabel;
      }
    }
  }

  function handleBodyMapClick(map, event) {
    const { image, layer, view, canvas, ctx } = map;
    if (!image || !layer) return;

    const rect = image.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
      return;
    }

    if (canvas.width && canvas.height && ctx) {
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = Math.round(clickX * scaleX);
      const py = Math.round(clickY * scaleY);
      if (px >= 0 && py >= 0 && px < canvas.width && py < canvas.height) {
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        if (pixel[3] < 10) {
          return;
        }
      }
    }

    const hotspots = getHotspotsForView(view);
    if (!hotspots.length) {
      console.warn('No hotspot data available for body map view:', view);
      return;
    }

    const imageWidth = rect.width;
    const imageHeight = rect.height;
    let closest = null;
    let minDistance = Infinity;

    for (const hotspot of hotspots) {
      const centerX = (hotspot.x + hotspot.width / 2) * imageWidth;
      const centerY = (hotspot.y + hotspot.height / 2) * imageHeight;
      const distance = Math.hypot(clickX - centerX, clickY - centerY);
      if (distance < minDistance) {
        minDistance = distance;
        closest = hotspot;
      }
    }

    if (!closest) return;

    const correctedName = correctAnatomicalLabel(closest.name, view);
    const labelPrefix = view === 'front' ? 'Front' : 'Back';
    const displayName = `${labelPrefix}: ${correctedName}`;
    const key = `${view}:${closest.id}:${correctedName}`;

    if (painPointState.has(key)) {
      removePainPoint(key);
      return;
    }

    const leftPercent = (clickX / imageWidth) * 100;
    const topPercent = (clickY / imageHeight) * 100;
    const intensityValue = painSlider ? Number(painSlider.value) : 5;
    const category = intensityCategory(intensityValue);

    const point = {
      key,
      view,
      region: correctedName,
      originalName: closest.name,
      displayName,
      xPercent: Number(leftPercent.toFixed(4)),
      yPercent: Number(topPercent.toFixed(4)),
      intensity: intensityValue,
      intensityLevel: category
    };

    painPointState.set(key, point);
    addPainMarker(point, layer);
    refreshSelectedAreasCache();
    if (!isRestoring) {
      scheduleAutosave();
    }
  }

  function addPainMarker(point, layer) {
    if (!layer) return;
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'pain-marker';
    marker.style.left = `${point.xPercent}%`;
    marker.style.top = `${point.yPercent}%`;
    marker.dataset.id = point.key;
    marker.dataset.intensity = point.intensityLevel;
    marker.title = `${point.displayName} • Intensity ${point.intensity}/10`;
    marker.addEventListener('click', (event) => {
      event.stopPropagation();
      removePainPoint(point.key);
    });
    layer.appendChild(marker);
    painMarkerRefs.set(point.key, marker);
  }

  function removePainPoint(key) {
    const point = painPointState.get(key);
    if (!point) return;

    painPointState.delete(key);
    const marker = painMarkerRefs.get(key);
    if (marker && marker.parentElement) {
      marker.parentElement.removeChild(marker);
    }
    painMarkerRefs.delete(key);
    refreshSelectedAreasCache();
    if (!isRestoring) {
      scheduleAutosave();
    }
  }

  function refreshSelectedAreasCache() {
    selectedPainAreas.clear();
    painPointState.forEach(point => {
      selectedPainAreas.add(point.displayName);
    });
    updateSelectedAreas();
  }

  function clearPainSelections() {
    painPointState.clear();
    painMarkerRefs.forEach(marker => {
      if (marker && marker.parentElement) {
        marker.parentElement.removeChild(marker);
      }
    });
    painMarkerRefs.clear();
    refreshSelectedAreasCache();
  }

  function startOverWizard() {
    cancelAiSummaryRequest();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to clear saved draft:', error);
    }
    form.reset();
    clearPainSelections();
    resetAiSummaryUI();
    hideResumeBanner();
    currentStep = 1;
    viewBtns.forEach(btn => {
      const isFront = btn.dataset.view === 'front';
      btn.classList.toggle('active', isFront);
    });
    bodyDiagrams.forEach(diagram => {
      diagram.classList.toggle('active', diagram.dataset.view === 'front');
    });
    if (sliderValue && painSlider) {
      sliderValue.textContent = painSlider.value;
    }
    if (saveStatus) {
      saveStatus.textContent = 'Autosave: Not saved';
      saveStatus.style.color = '#6b7280';
    }
    showStep(1);
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
        if (sliderValue) {
          sliderValue.textContent = painSlider.value;
        }
        scheduleAutosave();
      });
    }

    if (generateSummaryBtn) {
      generateSummaryBtn.addEventListener('click', () => {
        generateAiSummary(true);
      });
    }

    if (startOverBtn) {
      startOverBtn.addEventListener('click', () => {
        if (window.confirm('Start over? This will clear your saved answers.')) {
          startOverWizard();
        }
      });
    }

    if (resumeContinueBtn) {
      resumeContinueBtn.addEventListener('click', () => {
        hideResumeBanner();
        if (!hasRestoredDraft) {
          restoreProgress();
        }
      });
    }

    if (resumeStartOverBtn) {
      resumeStartOverBtn.addEventListener('click', () => {
        startOverWizard();
      });
    }

    const consentInput = form.querySelector('input[name="consent"]');
    if (consentInput instanceof HTMLInputElement) {
      consentInput.addEventListener('change', () => {
        if (!consentInput.checked) {
          resetAiSummaryUI();
        } else {
          generateAiSummary(true);
        }
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

    // Body map selection
    bodyMaps.forEach(map => {
      if (!map.image || !map.ctx) return;

      const syncCanvas = () => {
        if (!map.image.naturalWidth || !map.image.naturalHeight) return;
        map.canvas.width = map.image.naturalWidth;
        map.canvas.height = map.image.naturalHeight;
        map.ctx.clearRect(0, 0, map.canvas.width, map.canvas.height);
        map.ctx.drawImage(map.image, 0, 0, map.canvas.width, map.canvas.height);
      };

      map.image.addEventListener('load', syncCanvas);
      if (map.image.complete && map.image.naturalWidth) {
        syncCanvas();
      }

      map.image.addEventListener('click', (event) => {
        handleBodyMapClick(map, event);
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
      if (!isRestoring) {
        generateAiSummary();
      }
    } else {
      cancelAiSummaryRequest();
      aiSummaryInFlight = false;
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

    if (startOverBtn) {
      startOverBtn.style.display = currentStep === totalSteps ? 'inline-flex' : 'none';
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
    data.painPoints = Array.from(painPointState.values());
    data.aiSummary = aiSummaryContent;
    data.aiSummaryError = aiSummaryErrorMessage;
    data.currentStep = currentStep;
    data._savedAt = new Date().toISOString();

    return data;
  }

  // Autosave
  function scheduleAutosave() {
    if (isRestoring) return;
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
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Accessing saved draft failed:', error);
      return;
    }

    if (!raw) return;

    try {
      isRestoring = true;
      const obj = JSON.parse(raw);

      // Restore form fields
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'selectedAreas' || k === 'currentStep' || k === '_savedAt') continue;
        if (k === 'painPoints' || k === 'aiSummary' || k === 'aiSummaryError') continue;

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

      clearPainSelections();

      if (Array.isArray(obj.painPoints) && obj.painPoints.length > 0) {
        obj.painPoints.forEach(rawPoint => {
          if (!rawPoint) return;
          const view = rawPoint.view === 'back' ? 'back' : 'front';
          const displayName = rawPoint.displayName ||
            `${view === 'front' ? 'Front' : 'Back'}: ${rawPoint.region || rawPoint.originalName || 'Region'}`;
          const key = rawPoint.key || `${view}:${rawPoint.id || rawPoint.region || displayName}`;
          const map = bodyMaps.find(m => m.view === view);
          if (!map || !map.layer) return;

          const point = {
            key,
            view,
            region: rawPoint.region || rawPoint.originalName || displayName,
            originalName: rawPoint.originalName || rawPoint.region || displayName,
            displayName,
            xPercent: typeof rawPoint.xPercent === 'number' ? rawPoint.xPercent : Number(rawPoint.xPercent) || 0,
            yPercent: typeof rawPoint.yPercent === 'number' ? rawPoint.yPercent : Number(rawPoint.yPercent) || 0,
            intensity: typeof rawPoint.intensity === 'number' ? rawPoint.intensity : Number(rawPoint.intensity) || 5,
            intensityLevel: rawPoint.intensityLevel || intensityCategory(Number(rawPoint.intensity) || 5)
          };

          painPointState.set(point.key, point);
          addPainMarker(point, map.layer);
        });
        refreshSelectedAreasCache();
      } else if (Array.isArray(obj.selectedAreas)) {
        selectedPainAreas.clear();
        obj.selectedAreas.forEach(area => selectedPainAreas.add(area));
        updateSelectedAreas();
      }

      if (typeof obj.aiSummary === 'string' && obj.aiSummary.trim()) {
        aiSummaryContent = obj.aiSummary;
        aiSummaryPayloadHash = '';
        renderAiSummaryContent();
        updateAiSummaryStatus('Summary restored from previous session.', 'success');
      } else {
        resetAiSummaryUI();
      }

      if (typeof obj.aiSummaryError === 'string' && obj.aiSummaryError) {
        aiSummaryErrorMessage = obj.aiSummaryError;
        if (!aiSummaryContent) {
          updateAiSummaryStatus(aiSummaryErrorMessage, 'error');
        }
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
      hasRestoredDraft = true;
      isRestoring = false;
    } catch (e) {
      console.warn('Restore failed', e);
      isRestoring = false;
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
          clearPainSelections();
          resetAiSummaryUI();
          if (painSlider && sliderValue) {
            sliderValue.textContent = painSlider.value;
          }
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
