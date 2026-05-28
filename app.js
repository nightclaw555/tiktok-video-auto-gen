// Dashboard Application Logic - Javis AI

// Global Application State (persisted in localStorage)
let appState = {
  activeTab: 'tab-generate',
  generate: {
    status: 'idle', // 'idle', 'uploading', 'waiting_ai', 'completed', 'error'
    error: null,
    productId: null,
    soundPrompt: null,
    progressStep: 0,
    imageData: null,
    fileName: null,
    videoStyleSelect: 'default',
    videoStyleText: 'เน้นประโยชน์ ใช้งานของสินค้า ไม่ต้องเน้นไปที่ นายแบบ-นางแบบ ไม่ต้องเห็นส่วนหัว'
  },
  merge: {
    status: 'idle', // 'idle', 'uploading', 'ffmpeg', 'completed', 'error'
    error: null,
    videoUrl: null,
    progressStep: 0,
    productId: null,
    productIdInput: '',
    audioData: null,
    audioName: null,
    audioSize: null,
    soundPrompt: null
  }
};

// Interval timers
let generatePollInterval = null;
let mergePollInterval = null;
let connectionCheckInterval = null;

// Video Style Templates
const videoStyleTemplates = {
  default: "เน้นประโยชน์ ใช้งานของสินค้า ไม่ต้องเน้นไปที่ นายแบบ-นางแบบ ไม่ต้องเห็นส่วนหัว",
  cute: "ให้ออกแนวน่ารัก สดใส มีพลังบวก ดึงดูดความสนใจ สไตล์วัยรุ่น",
  product_focus: "เน้นโฟกัสที่ตัวผลิตภัณฑ์ในมุมมองต่างๆ จัดแสงเงาให้โดดเด่นสะดุดตา ซูมรายละเอียดเนื้อสัมผัส",
  product_with_model: "เน้นตัวสินค้าพร้อมกับการมีแบบหรือพรีเซนเตอร์ทดลองใช้งานจริง แสดงความรู้สึกประทับใจขณะใช้",
  luxury: "เน้นภาพลักษณ์ระดับพรีเมียม หรูหรา แสงโทนอุ่นหรือแสงสตูดิโอระดับสูง ดูแพงและมีระดับ"
};

// DOM Elements
// Sidebar
const navButtons = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const connectionDot = document.getElementById('connection-dot');
const connectionText = document.getElementById('connection-text');

// Settings
const settingN8nUrl = document.getElementById('setting-n8n-url');
const settingN8nUser = document.getElementById('setting-n8n-user');
const settingN8nPass = document.getElementById('setting-n8n-pass');
const btnSaveSettings = document.getElementById('btn-save-settings');

// Tab 1 (Generate)
const imageDropzone = document.getElementById('image-dropzone');
const imageInput = document.getElementById('image-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const btnRemoveImage = document.getElementById('btn-remove-image');
const selectVideoStyle = document.getElementById('generate-video-style-select');
const txtVideoStyle = document.getElementById('generate-video-style-text');
const btnResetVideoStyle = document.getElementById('btn-reset-video-style');
const btnGenerate = document.getElementById('btn-generate');
const generateIdlePlaceholder = document.getElementById('generate-idle-placeholder');
const generateStatusContainer = document.getElementById('generate-status-container');
const btnCancelGenerate = document.getElementById('btn-cancel-generate');
const generateResults = document.getElementById('generate-results');
const resultProductId = document.getElementById('result-product-id');
const resultSoundPrompt = document.getElementById('result-sound-prompt');
const btnCopyPid = document.getElementById('btn-copy-pid');
const btnCopyPrompt = document.getElementById('btn-copy-prompt');
const btnGoToMerge = document.getElementById('btn-go-to-merge');

// Tab 2 (Merge)
const recentJobsList = document.getElementById('recent-jobs-list');
const btnRefreshJobs = document.getElementById('btn-refresh-jobs');
const mergeProductId = document.getElementById('merge-product-id');
const mergeScriptContainer = document.getElementById('merge-script-container');
const mergeSoundPrompt = document.getElementById('merge-sound-prompt');
const btnCopyMergePrompt = document.getElementById('btn-copy-merge-prompt');
const audioDropzone = document.getElementById('audio-dropzone');
const audioInput = document.getElementById('audio-input');
const audioPreviewContainer = document.getElementById('audio-preview-container');
const audioFileName = document.getElementById('audio-file-name');
const audioFileSize = document.getElementById('audio-file-size');
const btnRemoveAudio = document.getElementById('btn-remove-audio');
const btnMerge = document.getElementById('btn-merge');
const mergeIdlePlaceholder = document.getElementById('merge-idle-placeholder');
const mergeStatusContainer = document.getElementById('merge-status-container');
const btnCancelMerge = document.getElementById('btn-cancel-merge');
const mergeResults = document.getElementById('merge-results');
const btnDownloadVideo = document.getElementById('btn-download-video');

// Tab 3 (History)
const btnRefreshHistory = document.getElementById('btn-refresh-history');
const historySearch = document.getElementById('history-search');
const historyFilterStatus = document.getElementById('history-filter-status');
const historyTableBody = document.getElementById('history-table-body');

// Toast
const toastSuccess = document.getElementById('toast-success');
let allHistoryData = []; // Cached history for search/filter

// Unicode Base64 Helper (cross-origin compatibility)
function btoaUnicode(str) {
  const binary = Array.from(new TextEncoder().encode(str), byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

// Convert base64 dataURI to Blob
function dataURItoBlob(dataURI) {
  const parts = dataURI.split(',');
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

// Show Toast Alert
function showToast(message) {
  toastSuccess.textContent = message;
  toastSuccess.classList.remove('hidden');
  setTimeout(() => toastSuccess.classList.add('hidden'), 2500);
}

// Get Auth Headers for n8n API
function getAuthHeaders() {
  const n8nUrl = (localStorage.getItem('n8nUrl') || 'http://localhost:5678').replace(/\/$/, '');
  const n8nUser = localStorage.getItem('n8nUser') || '';
  const n8nPass = localStorage.getItem('n8nPass') || '';

  const headers = {};
  if (n8nUser && n8nPass) {
    const auth = btoaUnicode(n8nUser + ':' + n8nPass);
    headers['Authorization'] = 'Basic ' + auth;
  }
  return { headers, n8nUrl };
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Setup navigation FIRST so tabs always work regardless of other errors
  setupNavigation();

  try { loadConfigSettings(); } catch(e) { console.error('loadConfigSettings error:', e); }
  try { loadSavedState(); } catch(e) { console.error('loadSavedState error:', e); }
  try { setupFileDropzones(); } catch(e) { console.error('setupFileDropzones error:', e); }
  try { setupFormListeners(); } catch(e) { console.error('setupFormListeners error:', e); }

  testConnection();

  // Poll connection health every 15 seconds
  connectionCheckInterval = setInterval(testConnection, 15000);

  // Resume active processes if they were running
  try { resumeProcesses(); } catch(e) { console.error('resumeProcesses error:', e); }
});

// Load connection settings from localStorage
function loadConfigSettings() {
  settingN8nUrl.value = localStorage.getItem('n8nUrl') || 'http://localhost:5678';
  settingN8nUser.value = localStorage.getItem('n8nUser') || '';
  settingN8nPass.value = localStorage.getItem('n8nPass') || '';
}

// Save connection settings
btnSaveSettings.addEventListener('click', () => {
  localStorage.setItem('n8nUrl', settingN8nUrl.value.trim());
  localStorage.setItem('n8nUser', settingN8nUser.value.trim());
  localStorage.setItem('n8nPass', settingN8nPass.value.trim());
  showToast('บันทึกการตั้งค่าการเชื่อมต่อเรียบร้อยแล้ว!');
  testConnection();
});

// Load saved UI states
function loadSavedState() {
  const savedState = localStorage.getItem('appState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      appState = { ...appState, ...state };
    } catch (e) {
      console.error("Failed to parse saved state", e);
    }
  }

  // Restore active tab
  const activeTabId = appState.activeTab || 'tab-generate';
  navButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === activeTabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  tabPanes.forEach(pane => {
    if (pane.id === activeTabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  // Restore Tab 1 (Generate Video)
  if (appState.generate.imageData) {
    imagePreview.src = appState.generate.imageData;
    imagePreviewContainer.classList.remove('hidden');
  }
  selectVideoStyle.value = appState.generate.videoStyleSelect || 'default';
  txtVideoStyle.value = appState.generate.videoStyleText || videoStyleTemplates.default;

  // Restore Tab 2 (Merge Audio)
  mergeProductId.value = appState.merge.productIdInput || '';
  if (appState.merge.audioData) {
    audioFileName.textContent = appState.merge.audioName || 'sound_voice.mp3';
    audioFileSize.textContent = appState.merge.audioSize || '';
    audioPreviewContainer.classList.remove('hidden');
  }
  if (appState.merge.soundPrompt) {
    mergeSoundPrompt.value = appState.merge.soundPrompt;
    mergeScriptContainer.classList.remove('hidden');
  }

  // Update UI Elements
  updateGenerateUI();
  updateMergeUI();
  
  // If active tab is history, fetch history
  if (activeTabId === 'tab-history') {
    fetchHistoryData();
  } else if (activeTabId === 'tab-merge') {
    fetchRecentJobs();
  }
}

// Save app state
function saveAppState() {
  localStorage.setItem('appState', JSON.stringify(appState));
}

// Navigation handling
function setupNavigation() {
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      navButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      
      appState.activeTab = tabId;
      saveAppState();

      if (tabId === 'tab-merge') {
        fetchRecentJobs();
      } else if (tabId === 'tab-history') {
        fetchHistoryData();
      }
    });
  });
}

// Connection check with n8n host
async function testConnection() {
  const { n8nUrl } = getAuthHeaders();

  try {
    // Simple GET, no custom headers = no CORS preflight needed
    const response = await fetch(`${n8nUrl}/webhook/check-video-status?product_id=0`);

    if (response.status === 200 || response.status === 404 || response.status === 401 || response.status === 400) {
      connectionDot.className = 'status-dot online';
      connectionText.textContent = `เชื่อมต่อ n8n: ออนไลน์ ✓ (${n8nUrl.replace(/^https?:\/\//, '')})`;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (e) {
    connectionDot.className = 'status-dot offline';
    connectionText.textContent = `เชื่อมต่อ n8n: ออฟไลน์ (${e.message})`;
  }
}

// Dropzones handling
function setupFileDropzones() {
  // Image Dropzone
  setupFileHandlers(
    imageDropzone,
    imageInput,
    (file) => {
      appState.generate.fileName = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        appState.generate.imageData = e.target.result;
        imagePreview.src = appState.generate.imageData;
        imagePreviewContainer.classList.remove('hidden');
        btnGenerate.disabled = false;
        saveAppState();
      };
      reader.readAsDataURL(file);
    },
    () => {
      appState.generate.imageData = null;
      appState.generate.fileName = null;
      imagePreview.src = '';
      imagePreviewContainer.classList.add('hidden');
      btnGenerate.disabled = true;
      saveAppState();
    },
    btnRemoveImage
  );

  // Audio Dropzone (.mp3 and .wav)
  setupFileHandlers(
    audioDropzone,
    audioInput,
    (file) => {
      // Validate audio file type
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'];
      const validExts = ['.mp3', '.wav'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const isValid = validTypes.includes(file.type) || validExts.includes(ext);
      if (!isValid) {
        alert('กรุณาเลือกไฟล์เสียงพากย์ที่รองรับเท่านั้น (.mp3 หรือ .wav)');
        audioInput.value = '';
        return;
      }

      appState.merge.audioName = file.name;
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      appState.merge.audioSize = `${sizeMB} MB`;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        appState.merge.audioData = e.target.result;
        audioFileName.textContent = file.name;
        audioFileSize.textContent = `${sizeMB} MB`;
        audioPreviewContainer.classList.remove('hidden');
        checkMergeButtonState();
        saveAppState();
      };
      reader.readAsDataURL(file);
    },
    () => {
      appState.merge.audioData = null;
      appState.merge.audioName = null;
      appState.merge.audioSize = null;
      audioFileName.textContent = '';
      audioFileSize.textContent = '';
      audioPreviewContainer.classList.add('hidden');
      checkMergeButtonState();
      saveAppState();
    },
    btnRemoveAudio
  );
}

// Dropzone file propagation and listener setup helper
function setupFileHandlers(zone, input, onSelect, onClear, removeBtn) {
  // Prevent double trigger when clicking directly on absolute positioned input
  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  zone.addEventListener('click', (e) => {
    if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
      input.click();
    }
  });

  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      onSelect(input.files[0]);
    }
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      onSelect(e.dataTransfer.files[0]);
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    input.value = '';
    onClear();
  });
}

// Form listeners
function setupFormListeners() {
  // Reset style template
  btnResetVideoStyle.addEventListener('click', () => {
    selectVideoStyle.value = 'default';
    txtVideoStyle.value = videoStyleTemplates.default;
    appState.generate.videoStyleSelect = 'default';
    appState.generate.videoStyleText = videoStyleTemplates.default;
    saveAppState();
  });

  // Select video style dropdown
  selectVideoStyle.addEventListener('change', () => {
    const val = selectVideoStyle.value;
    if (val !== 'custom') {
      txtVideoStyle.value = videoStyleTemplates[val];
    }
    appState.generate.videoStyleSelect = val;
    appState.generate.videoStyleText = txtVideoStyle.value;
    saveAppState();
  });

  // Type custom guidelines
  txtVideoStyle.addEventListener('input', () => {
    selectVideoStyle.value = 'custom';
    appState.generate.videoStyleSelect = 'custom';
    appState.generate.videoStyleText = txtVideoStyle.value;
    saveAppState();
  });

  // Toggle merge button state
  mergeProductId.addEventListener('input', () => {
    const val = mergeProductId.value.trim();
    appState.merge.productIdInput = val;
    checkMergeButtonState();
    saveAppState();

    // Auto-fetch sound prompt debounced
    if (this.fetchTimer) clearTimeout(this.fetchTimer);
    this.fetchTimer = setTimeout(() => {
      fetchSoundPromptForMerge(val);
    }, 500);
  });

  // Copy Buttons
  btnCopyPid.addEventListener('click', () => {
    navigator.clipboard.writeText(resultProductId.value);
    btnCopyPid.textContent = 'คัดลอกแล้ว!';
    setTimeout(() => btnCopyPid.textContent = 'คัดลอก', 1500);
  });

  btnCopyPrompt.addEventListener('click', () => {
    navigator.clipboard.writeText(resultSoundPrompt.value);
    btnCopyPrompt.textContent = 'คัดลอกแล้ว!';
    setTimeout(() => btnCopyPrompt.textContent = 'คัดลอกบทพากย์', 1500);
  });

  btnCopyMergePrompt.addEventListener('click', () => {
    navigator.clipboard.writeText(mergeSoundPrompt.value);
    btnCopyMergePrompt.textContent = 'คัดลอกแล้ว!';
    setTimeout(() => btnCopyMergePrompt.textContent = 'คัดลอกบทพากย์', 1500);
  });

  // Go to step 2 click handler
  btnGoToMerge.addEventListener('click', () => {
    const pid = resultProductId.value;
    mergeProductId.value = pid;
    appState.merge.productIdInput = pid;
    fetchSoundPromptForMerge(pid);
    checkMergeButtonState();
    
    // Switch Tab
    const tabBtn = document.querySelector('[data-tab="tab-merge"]');
    if (tabBtn) tabBtn.click();
  });

  // Start Generate (Workflow 1)
  btnGenerate.addEventListener('click', () => {
    if (!appState.generate.imageData) return;
    startGeneratePipeline();
  });

  // Start Merge (Workflow 2)
  btnMerge.addEventListener('click', () => {
    const pid = mergeProductId.value.trim();
    if (!pid || !appState.merge.audioData) return;
    startMergePipeline(pid);
  });

  // Cancel buttons
  btnCancelGenerate.addEventListener('click', () => {
    resetState('generate');
  });

  btnCancelMerge.addEventListener('click', () => {
    resetState('merge');
  });

  // Refresh recent jobs
  btnRefreshJobs.addEventListener('click', () => {
    fetchRecentJobs();
  });

  // Refresh History
  btnRefreshHistory.addEventListener('click', () => {
    fetchHistoryData();
  });

  // Filter & Search History
  historySearch.addEventListener('input', applyHistoryFilters);
  historyFilterStatus.addEventListener('change', applyHistoryFilters);
}

// Enable/Disable Merge Button
function checkMergeButtonState() {
  const hasId = mergeProductId.value.trim().length > 0;
  const hasAudio = !!appState.merge.audioData;
  btnMerge.disabled = !(hasId && hasAudio);
}

// Auto-fetch sound prompt for merge
async function fetchSoundPromptForMerge(productId) {
  const cleanId = productId.trim();
  if (!cleanId) {
    mergeScriptContainer.classList.add('hidden');
    appState.merge.soundPrompt = null;
    saveAppState();
    return;
  }

  try {
    const { headers, n8nUrl } = getAuthHeaders();
    console.log(`Auto-fetching sound prompt from n8n for Product ID: ${cleanId}`);
    
    const response = await fetch(`${n8nUrl}/webhook/check-video-status?product_id=${cleanId}`, {
      method: 'GET',
      headers: headers
    });

    if (response.ok) {
      const text = await response.text();
      if (text.trim()) {
        try {
          const data = JSON.parse(text);
          if (data.sound_prompt && data.sound_prompt !== 'wait') {
            mergeSoundPrompt.value = data.sound_prompt;
            mergeScriptContainer.classList.remove('hidden');
            appState.merge.soundPrompt = data.sound_prompt;
            saveAppState();
            console.log("Successfully retrieved sound prompt for Merge Tab.");
          } else {
            mergeScriptContainer.classList.add('hidden');
          }
        } catch(e) {
          console.warn("Sound prompt response is not valid JSON:", e);
          mergeScriptContainer.classList.add('hidden');
        }
      } else {
        mergeScriptContainer.classList.add('hidden');
      }
    } else {
      mergeScriptContainer.classList.add('hidden');
    }
  } catch (err) {
    console.error("Error fetching sound prompt:", err);
    mergeScriptContainer.classList.add('hidden');
  }
}

// Reset status panel
function resetState(panel) {
  if (panel === 'generate') {
    if (generatePollInterval) {
      clearInterval(generatePollInterval);
      generatePollInterval = null;
    }
    appState.generate.status = 'idle';
    appState.generate.error = null;
    appState.generate.productId = null;
    appState.generate.soundPrompt = null;
    appState.generate.progressStep = 0;
    updateGenerateUI();
  } else if (panel === 'merge') {
    if (mergePollInterval) {
      clearInterval(mergePollInterval);
      mergePollInterval = null;
    }
    appState.merge.status = 'idle';
    appState.merge.error = null;
    appState.merge.productId = null;
    appState.merge.videoUrl = null;
    appState.merge.progressStep = 0;
    updateMergeUI();
  }
  saveAppState();
}

// Resume polling processes if active on page reload
function resumeProcesses() {
  const { headers, n8nUrl } = getAuthHeaders();
  
  if (appState.generate.status === 'waiting_ai' && appState.generate.productId) {
    console.log("Resuming generate polling for Product ID:", appState.generate.productId);
    startGeneratePolling(n8nUrl, headers, appState.generate.productId);
  }

  if (appState.merge.status === 'ffmpeg' && appState.merge.productId) {
    console.log("Resuming merge polling for Product ID:", appState.merge.productId);
    startMergePolling(n8nUrl, headers, appState.merge.productId);
  }
}

// Generate Video Pipeline (Workflow 1)
async function startGeneratePipeline() {
  try {
    resetState('generate');
    appState.generate.status = 'uploading';
    appState.generate.progressStep = 1;
    updateGenerateUI();
    saveAppState();

    const { headers, n8nUrl } = getAuthHeaders();
    
    // Create multipart form
    const imageBlob = dataURItoBlob(appState.generate.imageData);
    const formData = new FormData();
    formData.append('data', imageBlob, appState.generate.fileName);

    if (appState.generate.videoStyleText) {
      formData.append('video_style', appState.generate.videoStyleText);
    }

    console.log("Submitting image to n8n Webhook...");
    const response = await fetch(`${n8nUrl}/webhook/generate-video-ext`, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    // Check if user clicked cancel during upload
    if (appState.generate.status !== 'uploading') {
      console.log("Generate process canceled during upload. Aborting.");
      return;
    }

    if (!response.ok) {
      throw new Error(`n8n Webhook returned status ${response.status}`);
    }

    const result = await response.json();
    if (!result.product_id) {
      throw new Error("No product_id returned from n8n.");
    }

    // Set waiting state and start polling
    appState.generate.status = 'waiting';
    appState.generate.productId = result.product_id;
    appState.generate.progress = 0;
    
    saveAppState();
    updateGenerateUI();
    startGeneratePolling(n8nUrl, headers, result.product_id);
  } catch (err) {
    appState.generate.status = 'error';
    appState.generate.error = err.message;
    updateGenerateUI();
    saveAppState();
    alert(`เกิดข้อผิดพลาดในการส่งข้อมูล: ${err.message}`);
  }
}

function startGeneratePolling(n8nUrl, headers, productId) {
  if (generatePollInterval) clearInterval(generatePollInterval);

  generatePollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${n8nUrl}/webhook/check-video-status?product_id=${productId}`, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) throw new Error("Status check failed");
      const data = await response.json();
      console.log("Generate Poll Status Data:", data);

      if (data.status === 'done' || data.status === 'success') {
        clearInterval(generatePollInterval);
        generatePollInterval = null;
        appState.generate.status = 'completed';
        appState.generate.videoUrl = data.video || '';
      } else if (data.status === 'fail' || data.status === 'error') {
        clearInterval(generatePollInterval);
        generatePollInterval = null;
        appState.generate.status = 'error';
        appState.generate.error = data.message || 'Error occurred';
      } else {
        appState.generate.progress = data.progress || 0;
        appState.generate.status = data.status || 'waiting';
      }

      updateGenerateUI();
      saveAppState();
    } catch (err) {
      if (appState.generate.status === 'idle') {
        clearInterval(generatePollInterval);
        generatePollInterval = null;
        return;
      }

      clearInterval(generatePollInterval);
      generatePollInterval = null;

      appState.generate.status = 'error';
      appState.generate.error = err.message;
      updateGenerateUI();
      saveAppState();
      alert(`เกิดข้อผิดพลาดในการตรวจสอบสถานะ: ${err.message}`);
    }
  }, 5000);
}

// Merge Audio/Video Pipeline (Workflow 2)
async function startMergePipeline(productId) {
  try {
    resetState('merge');
    appState.merge.status = 'uploading';
    appState.merge.productId = productId;
    appState.merge.progressStep = 1;
    updateMergeUI();
    saveAppState();

    const { headers, n8nUrl } = getAuthHeaders();
    
    // Create multipart form
    const audioBlob = dataURItoBlob(appState.merge.audioData);
    const formData = new FormData();
    formData.append('field-0', audioBlob, appState.merge.audioName);
    formData.append('field-1', productId);

    const formUrl = `${n8nUrl}/webhook/9cf2a53a-cd51-4dcb-b2bc-21b76863b4bf`;
    console.log("Submitting voiceover file to n8n Form Webhook...");
    
    const response = await fetch(formUrl, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    // Check if user canceled while uploading
    if (appState.merge.status !== 'uploading') {
      console.log("Merge process canceled during upload. Aborting.");
      return;
    }

    if (!response.ok) {
      throw new Error(`n8n Form Webhook returned status ${response.status}`);
    }

    console.log("Voiceover uploaded successfully. Starting merge tracking...");
    appState.merge.status = 'ffmpeg';
    appState.merge.progressStep = 2;
    updateMergeUI();
    saveAppState();

    startMergePolling(n8nUrl, headers, productId);

  } catch (err) {
    if (appState.merge.status === 'idle') return;

    console.error("Merge error:", err);
    appState.merge.status = 'error';
    appState.merge.error = err.message;
    updateMergeUI();
    saveAppState();
    alert(`เกิดข้อผิดพลาดในการรวมเสียง: ${err.message}`);
  }
}

// Polling status of Workflow 2
function startMergePolling(n8nUrl, headers, productId) {
  if (mergePollInterval) clearInterval(mergePollInterval);
  
  const pollUrl = `${n8nUrl}/webhook/check-video-status?product_id=${productId}`;
  let attempts = 0;
  const maxAttempts = 30; // 2.5 minutes max

  mergePollInterval = setInterval(async () => {
    // Race check: if canceled
    if (appState.merge.status !== 'ffmpeg') {
      clearInterval(mergePollInterval);
      mergePollInterval = null;
      return;
    }

    try {
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error("หมดเวลาการเชื่อมต่อ (Timeout) ในการรวมไฟล์วิดีโอ");
      }

      console.log(`Polling merge status (attempt ${attempts}): ${pollUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      let response;
      try {
        response = await fetch(pollUrl, {
          method: 'GET',
          headers: headers,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Check if user canceled while fetch was in-flight
      if (appState.merge.status !== 'ffmpeg') {
        clearInterval(mergePollInterval);
        mergePollInterval = null;
        return;
      }

      if (!response.ok) {
        if (response.status === 401) throw new Error("สิทธิ์การเข้าถึงไม่ถูกต้อง (401 Unauthorized)");
        if (response.status === 404) throw new Error("ไม่พบข้อมูล Product ID (404 Not Found)");
        console.warn(`Poll returned status ${response.status}`);
        return; // retry
      }

      const data = await response.json();
      console.log("Merge Poll Status Data:", data);

      if (data.final_video && data.final_video !== 'wait' && data.final_video.startsWith('http')) {
        clearInterval(mergePollInterval);
        mergePollInterval = null;

        appState.merge.status = 'completed';
        appState.merge.videoUrl = data.final_video;
        appState.merge.progressStep = 4;
        updateMergeUI();
        saveAppState();
        showToast('รวมเสียงเข้ากับวิดีโอเรียบร้อยสมบูรณ์แล้ว!');
      } else {
        // Still merging
        if (attempts > 3 && appState.merge.progressStep === 1) {
          appState.merge.progressStep = 2;
          updateMergeUI();
          saveAppState();
        }
      }

    } catch (err) {
      if (appState.merge.status === 'idle') {
        clearInterval(mergePollInterval);
        mergePollInterval = null;
        return;
      }

      clearInterval(mergePollInterval);
      mergePollInterval = null;

      appState.merge.status = 'error';
      appState.merge.error = err.message;
      updateMergeUI();
      saveAppState();
      alert(`เกิดข้อผิดพลาดในการรวมเสียงพากย์: ${err.message}`);
    }
  }, 5000);
}

// Update UI elements for Tab 1 (Generate Video)
function updateGenerateUI() {
  const genState = appState.generate;
  
  if (genState.status === 'idle') {
    generateIdlePlaceholder.classList.remove('hidden');
    generateStatusContainer.classList.add('hidden');
    btnGenerate.disabled = !genState.imageData;
    btnGenerate.querySelector('span').textContent = 'เริ่มสร้างวิดีโอ (Run Workflow 1)';
    return;
  }

  generateIdlePlaceholder.classList.add('hidden');
  generateStatusContainer.classList.remove('hidden');
  
  if (genState.status === 'completed' || genState.status === 'error') {
    btnCancelGenerate.classList.add('hidden');
  } else {
    btnCancelGenerate.classList.remove('hidden');
  }

  if (genState.status === 'uploading' || genState.status === 'waiting_ai') {
    btnGenerate.disabled = true;
    btnGenerate.querySelector('span').textContent = 'กำลังประมวลผลวิดีโอ...';
  } else {
    btnGenerate.disabled = false;
    btnGenerate.querySelector('span').textContent = 'เจนวิดีโอใหม่อีกครั้ง';
  }

  // Update stepper circles
  const steps = [
    { id: 'step-g-1', label: 'อัปโหลดภาพเข้า Google Drive' },
    { id: 'step-g-2', label: 'รอวิเคราะห์ภาพและเขียนบทพากย์' },
    { id: 'step-g-3', label: 'เจนวิดีโอด้วย AI (Kling AI)' }
  ];

  steps.forEach((s, idx) => {
    const el = document.getElementById(s.id);
    if (!el) return;
    el.className = 'step';
    
    const circle = el.querySelector('.step-circle');
    circle.textContent = idx + 1;
    circle.style.background = '';
    circle.style.borderColor = '';
    el.querySelector('.step-label').textContent = s.label;

    if (genState.progressStep > idx + 1) {
      el.classList.add('completed');
    } else if (genState.progressStep === idx + 1) {
      if (genState.status === 'error') {
        circle.textContent = '!';
        circle.style.background = '#ef4444';
        circle.style.borderColor = '#ef4444';
        el.querySelector('.step-label').textContent = `${s.label} (ล้มเหลว: ${genState.error})`;
        el.classList.add('active');
        el.className += ' error-step'; // helper class
      } else {
        el.classList.add('active');
      }
    }
  });

  // Display results panel
  if (genState.status === 'completed') {
    generateResults.classList.remove('hidden');
    resultProductId.value = genState.productId || '';
    resultSoundPrompt.value = genState.soundPrompt || '';
  } else {
    generateResults.classList.add('hidden');
  }
}

// Update UI elements for Tab 2 (Merge Audio)
function updateMergeUI() {
  const mergeState = appState.merge;
  
  if (mergeState.status === 'idle') {
    mergeIdlePlaceholder.classList.remove('hidden');
    mergeStatusContainer.classList.add('hidden');
    checkMergeButtonState();
    btnMerge.querySelector('span').textContent = 'เริ่มรวมเสียงพากย์ (Run Workflow 2)';
    return;
  }

  mergeIdlePlaceholder.classList.add('hidden');
  mergeStatusContainer.classList.remove('hidden');

  if (mergeState.status === 'completed' || mergeState.status === 'error') {
    btnCancelMerge.classList.add('hidden');
  } else {
    btnCancelMerge.classList.remove('hidden');
  }

  if (mergeState.status === 'uploading' || mergeState.status === 'ffmpeg') {
    btnMerge.disabled = true;
    btnMerge.querySelector('span').textContent = 'กำลังประมวลผลไฟล์...';
  } else {
    btnMerge.disabled = false;
    btnMerge.querySelector('span').textContent = 'เริ่มรวมเสียงอีกครั้ง';
  }

  // Update Stepper
  const steps = [
    { id: 'step-m-1', label: 'อัปโหลดเสียงพากย์เข้าระบบ' },
    { id: 'step-m-2', label: 'กำลังค้นหาวิดีโอต้นแบบ' },
    { id: 'step-m-3', label: 'กำลังประมวลผลรวมไฟล์ (FFmpeg)' }
  ];

  steps.forEach((s, idx) => {
    const el = document.getElementById(s.id);
    if (!el) return;
    el.className = 'step';
    
    const circle = el.querySelector('.step-circle');
    circle.textContent = idx + 1;
    circle.style.background = '';
    circle.style.borderColor = '';
    el.querySelector('.step-label').textContent = s.label;

    if (mergeState.progressStep > idx + 1) {
      el.classList.add('completed');
    } else if (mergeState.progressStep === idx + 1) {
      if (mergeState.status === 'error') {
        circle.textContent = '!';
        circle.style.background = '#ef4444';
        circle.style.borderColor = '#ef4444';
        el.querySelector('.step-label').textContent = `${s.label} (ล้มเหลว: ${mergeState.error})`;
        el.classList.add('active');
      } else {
        el.classList.add('active');
      }
    }
  });

  // Display results
  if (mergeState.status === 'completed') {
    mergeResults.classList.remove('hidden');
    btnDownloadVideo.onclick = () => {
      window.open(mergeState.videoUrl, '_blank');
    };
  } else {
    mergeResults.classList.add('hidden');
  }
}

// Fetch the 10 most recent unmerged jobs from n8n (CORS enabled)
async function fetchRecentJobs() {
  if (!recentJobsList) return;

  recentJobsList.innerHTML = '<div class="recent-jobs-loading">กำลังโหลดรายการงานล่าสุด...</div>';

  try {
    const { n8nUrl } = getAuthHeaders();
    console.log("Fetching 10 recent unmerged jobs from n8n...");
    
    const response = await fetch(`${n8nUrl}/webhook/check-video-status?t=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`เซิร์ฟเวอร์ส่งกลับสถานะ Error ${response.status} (กรุณาเช็คว่าเวิร์กโฟลว์ check-video-status เปิดใช้งานอยู่)`);
    }

    const text = await response.text();
    if (!text.trim()) {
      throw new Error("ไม่พบข้อมูลตอบกลับจากเวิร์กโฟลว์ (กรุณาเช็คว่าเวิร์กโฟลว์ check-video-status เป็น Active)");
    }

    let jobs;
    try {
      const rawJobs = JSON.parse(text);
      jobs = Array.isArray(rawJobs) ? rawJobs.map(item => item.json || item) : [];
    } catch(e) {
      throw new Error("ข้อมูลตอบกลับไม่ใช่รูปแบบ JSON (กรุณาเช็คว่าเปิดใช้งานเวิร์กโฟลว์ check-video-status แล้ว)");
    }
    console.log("Retrieved jobs:", jobs);

    if (!Array.isArray(jobs) || jobs.length === 0) {
      recentJobsList.innerHTML = '<div class="recent-jobs-empty">ไม่มีงานดิบค้างรอรวมเสียง</div>';
      return;
    }

    recentJobsList.innerHTML = '';
    
    // Render each job
    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'recent-job-card';
      if (mergeProductId.value.trim() === String(job.id)) {
        card.classList.add('active');
      }

      // Format date/time
      let displayDate = '';
      if (job.createdAt) {
        try {
          const date = new Date(job.createdAt);
          displayDate = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        } catch(e) {
          displayDate = job.createdAt;
        }
      }

      // Thumbnail check
      const thumbnailSrc = job.image_url2 || job.picture_url || 'icons/icon128.png';
      // Description / product_description
      const desc = job.prouduct_description || job.product_description || 'ไม่มีรายละเอียดสินค้า';

      card.innerHTML = `
        <img class="recent-job-thumb" src="${thumbnailSrc}" onerror="this.src='https://rgstbcbyrofqniswyemi.supabase.co/storage/v1/object/public/n8n/tiktok/2026-05-26T05:50:53.768Z.jpg'" alt="thumbnail">
        <div class="recent-job-info">
          <div class="recent-job-meta">
            <span class="recent-job-pid">ID: ${job.id}</span>
            <span class="recent-job-date">${displayDate}</span>
          </div>
          <div class="recent-job-desc" title="${desc}">${desc}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        // Remove active class from all other cards
        document.querySelectorAll('.recent-job-card').forEach(c => c.classList.remove('active'));
        // Add active class to this card
        card.classList.add('active');

        // Recall job: set input value
        mergeProductId.value = job.id;
        appState.merge.productIdInput = String(job.id);
        checkMergeButtonState();

        // Pre-fill sound prompt
        if (job.sound_prompt) {
          mergeSoundPrompt.value = job.sound_prompt;
          mergeScriptContainer.classList.remove('hidden');
          appState.merge.soundPrompt = job.sound_prompt;
        } else {
          mergeScriptContainer.classList.add('hidden');
          appState.merge.soundPrompt = null;
        }
        saveAppState();
      });

      recentJobsList.appendChild(card);
    });

  } catch (err) {
    console.error("Error fetching recent jobs:", err);
    recentJobsList.innerHTML = `<div class="recent-jobs-empty" style="color: #f87171;">เกิดข้อผิดพลาด: ${err.message}</div>`;
  }
}

// Fetch all database rows for history grid (CORS enabled)
async function fetchHistoryData() {
  if (!historyTableBody) return;

  historyTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="table-loading-msg">กำลังดึงข้อมูลประวัติงานจาก n8n...</td>
    </tr>
  `;

  try {
    const { n8nUrl } = getAuthHeaders();
    console.log("Fetching all database rows for History tab...");
    
    const response = await fetch(`${n8nUrl}/webhook/check-video-status?all=true&t=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`เซิร์ฟเวอร์ส่งกลับสถานะ Error ${response.status} (กรุณาเช็คว่าเวิร์กโฟลว์ check-video-status เปิดใช้งานอยู่)`);
    }

    const text = await response.text();
    if (!text.trim()) {
      throw new Error("ไม่พบข้อมูลตอบกลับจากเวิร์กโฟลว์ (กรุณาเช็คว่าเวิร์กโฟลว์ check-video-status เป็น Active)");
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      throw new Error("ข้อมูลตอบกลับไม่ใช่รูปแบบ JSON (กรุณาเช็คว่าเปิดใช้งานเวิร์กโฟลว์ check-video-status แล้ว)");
    }
    console.log("Retrieved history data:", data);

    if (!Array.isArray(data) || data.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty-msg">ไม่พบประวัติข้อมูลวิดีโอในระบบ</td>
        </tr>
      `;
      allHistoryData = [];
      return;
    }

    allHistoryData = data.map(item => item.json || item);
    applyHistoryFilters();

  } catch (err) {
    console.error("Error fetching history:", err);
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty-msg" style="color: #f87171;">เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}</td>
      </tr>
    `;
  }
}

// Filter and render history rows
function applyHistoryFilters() {
  if (!historyTableBody || allHistoryData.length === 0) return;

  const searchQuery = historySearch.value.trim().toLowerCase();
  const filterStatus = historyFilterStatus.value;

  // Filter the rows
  const filtered = allHistoryData.filter(row => {
    // Search match (checks ID, description, prompt)
    const idStr = String(row.id || '');
    const desc = (row.prouduct_description || row.product_description || '').toLowerCase();
    const prompt = (row.sound_prompt || '').toLowerCase();
    const searchMatch = searchQuery === '' || 
                        idStr.includes(searchQuery) || 
                        desc.includes(searchQuery) || 
                        prompt.includes(searchQuery);

    // Status match
    let statusMatch = true;
    if (filterStatus === 'done') {
      statusMatch = row.status === 'done' || row.status === 'success';
    } else if (filterStatus === 'fail') {
      statusMatch = row.status === 'fail' || (row.status && row.status.includes('fail'));
    } else if (filterStatus === 'pending') {
      statusMatch = row.status === 'pending' || row.status === 'uploading' || !row.status;
    } else if (filterStatus === 'unmerged') {
      statusMatch = (row.status === 'done' || row.status === 'success') && (!row.final_video || row.final_video === 'wait');
    } else if (filterStatus === 'merged') {
      statusMatch = row.final_video && row.final_video !== 'wait' && row.final_video.startsWith('http');
    }

    return searchMatch && statusMatch;
  });

  if (filtered.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty-msg">ไม่พบข้อมูลที่ค้นหาหรือตรงกับฟิลเตอร์</td>
      </tr>
    `;
    return;
  }

  historyTableBody.innerHTML = '';

  // Render rows
  filtered.forEach(row => {
    const tr = document.createElement('tr');
    
    // Thumbnail URL fallback
    const thumbUrl = row.image_url2 || row.picture_url || 'https://rgstbcbyrofqniswyemi.supabase.co/storage/v1/object/public/n8n/tiktok/2026-05-26T05:50:53.768Z.jpg';
    // Description text
    const desc = row.prouduct_description || row.product_description || 'ไม่มีรายละเอียดสินค้า';
    // Sound Prompt
    const soundPrompt = row.sound_prompt || 'ไม่มีบทพากย์';
    // Caption text
    const caption = row.caption || '';
    
    // Status Badge
    let statusBadge = '<span class="badge pending">Pending</span>';
    if (row.status === 'done' || row.status === 'success') {
      statusBadge = '<span class="badge done">Done</span>';
    } else if (row.status === 'fail' || (row.status && row.status.includes('fail'))) {
      statusBadge = '<span class="badge fail">Fail</span>';
    }

    // Date
    let displayDate = '';
    if (row.createdAt) {
      try {
        const date = new Date(row.createdAt);
        displayDate = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + '<br>' + date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      } catch(e) {
        displayDate = row.createdAt;
      }
    }

    // Escape values for data attributes
    const safeDesc = (desc || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/"/g, '&quot;');
    const safeCaption = (caption || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/"/g, '&quot;');
    const safePicUrl = (row.picture_url || '').replace(/"/g, '&quot;');
    const safeAudioUrl = (row.audio_url || '').replace(/"/g, '&quot;');
    const safeFinalVideo = (row.final_video || '').replace(/"/g, '&quot;');

    // Action buttons (video URLs)
    let actionButtons = '';
    if (row.video && row.video.startsWith('http')) {
      actionButtons += `<a href="${row.video}" target="_blank" class="btn-table-action">ดาวน์โหลดวิดีโอดิบ</a>`;
    } else {
      actionButtons += `<span style="color: var(--text-muted); font-size: 0.75rem;">วิดีโอดิบ: ไม่มี</span>`;
    }

    if (row.final_video && row.final_video !== 'wait' && row.final_video.startsWith('http')) {
        actionButtons += `<a href="${row.final_video}" target="_blank" class="btn-table-action btn-table-action-success" style="margin-top: 6px;">ดาวน์โหลดวิดีโอเต็ม</a>`;
        actionButtons += `<button class="btn-table-action" style="margin-top: 6px; border-color: #25F4EE; color: #000; background: #25F4EE;" onclick="openTikTokModal(${row.id}, \`${safeFinalVideo}\`, \`${safeDesc}\`, \`${safeCaption}\`, \`${row.tiktok_link || ''}\`, \`${row.tiktok_status || 'pending'}\`)">🎵 เตรียม TikTok</button>`;
      } else if (row.status === 'done' || row.status === 'success') {
      actionButtons += `<button class="btn-table-action" style="margin-top: 6px; border-color: var(--accent-orange); color: var(--accent-orange);" onclick="recallJobForMerge(${row.id}, \`${soundPrompt.replace(/'/g, "\\'")}\`)">กดรวมเสียงพากย์</button>`;
    }

    tr.innerHTML = `
      <td class="history-pid">${row.id}</td>
      <td><img src="${thumbUrl}" class="history-thumb" onerror="this.src='https://rgstbcbyrofqniswyemi.supabase.co/storage/v1/object/public/n8n/tiktok/2026-05-26T05:50:53.768Z.jpg'"></td>
      <td class="history-desc-cell" title="${desc}">${desc}</td>
      <td class="history-prompt-cell" title="${soundPrompt}">${soundPrompt}</td>
      <td>${statusBadge}</td>
      <td><div class="table-actions">${actionButtons}</div></td>
      <td class="history-date">${displayDate}</td>
      <td>
        <button class="btn-table-delete" onclick="openDeleteModal(${row.id}, '${safeDesc}', '${safePicUrl}', '${safeAudioUrl}', '${safeFinalVideo}')"
          title="ลบรายการนี้ออกจากระบบ">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
          </svg>
          ลบ
        </button>
      </td>
    `;
    
    historyTableBody.appendChild(tr);
  });
}

// Helper to recall job for merge directly from the history table
window.recallJobForMerge = function(id, soundPrompt) {
  mergeProductId.value = id;
  appState.merge.productIdInput = String(id);
  
  if (soundPrompt && soundPrompt !== 'wait' && soundPrompt !== 'undefined') {
    mergeSoundPrompt.value = soundPrompt;
    mergeScriptContainer.classList.remove('hidden');
    appState.merge.soundPrompt = soundPrompt;
  } else {
    mergeScriptContainer.classList.add('hidden');
    appState.merge.soundPrompt = null;
  }
  
  checkMergeButtonState();
  saveAppState();
  showToast(`Recall รหัสสินค้า ${id} เรียบร้อยแล้ว!`);

  // Switch tab
  const tabBtn = document.querySelector('[data-tab="tab-merge"]');
  if (tabBtn) tabBtn.click();
};

// ================================================================
// DELETE JOB MODAL LOGIC
// ================================================================

let deleteModalTarget = null; // { id, pictureUrl, audioUrl, finalVideo }

// Open modal with job data
window.openDeleteModal = function(id, desc, pictureUrl, audioUrl, finalVideo) {
  deleteModalTarget = { id, pictureUrl, audioUrl, finalVideo };

  const modal = document.getElementById('delete-modal');
  const label = document.getElementById('modal-item-label');
  label.textContent = `สินค้า ID: ${id} — ${desc || ''}`.substring(0, 60);

  // Reset checkboxes to all checked
  document.getElementById('chk-delete-db').checked = true;
  document.getElementById('chk-delete-image').checked = true;
  // Disable audio checkbox if no audio URL stored yet
  const audioChk = document.getElementById('chk-delete-audio');
  audioChk.checked = !!audioUrl;
  audioChk.disabled = !audioUrl;
  // Disable gdrive checkbox if no final_video URL
  const gdriveChk = document.getElementById('chk-delete-gdrive');
  const hasFinalVideo = finalVideo && finalVideo !== 'wait' && finalVideo.startsWith('http');
  gdriveChk.checked = hasFinalVideo;
  gdriveChk.disabled = !hasFinalVideo;

  modal.classList.remove('hidden');
};

// Modal cancel button
document.getElementById('modal-cancel-btn').addEventListener('click', () => {
  document.getElementById('delete-modal').classList.add('hidden');
  deleteModalTarget = null;
});

// Close modal on backdrop click
document.getElementById('delete-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.add('hidden');
    deleteModalTarget = null;
  }
});

// Modal confirm delete button
document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
  if (!deleteModalTarget) return;

  const confirmBtn = document.getElementById('modal-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> กำลังลบ...`;

  const payload = {
    product_id: deleteModalTarget.id,
    delete_db: document.getElementById('chk-delete-db').checked,
    delete_image: document.getElementById('chk-delete-image').checked,
    delete_audio: document.getElementById('chk-delete-audio').checked,
    delete_gdrive: document.getElementById('chk-delete-gdrive').checked,
    picture_url: deleteModalTarget.pictureUrl || '',
    audio_url: deleteModalTarget.audioUrl || '',
    final_video: deleteModalTarget.finalVideo || ''
  };

  try {
    const { headers, n8nUrl } = getAuthHeaders();
    const response = await fetch(`${n8nUrl}/webhook/delete-video-item-v5`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`เซิร์ฟเวอร์ตอบกลับ ${response.status}: ${errText.substring(0, 120)}`);
    }

    // Since n8n Webhook responds immediately, we just assume success if HTTP is 200 OK
    showToast(`ลบข้อมูลสินค้า ID: ${deleteModalTarget.id} ออกจากระบบเรียบร้อยแล้ว!`);
    document.getElementById('delete-modal').classList.add('hidden');
    deleteModalTarget = null;
    fetchHistoryData();
    fetchRecentJobs();
  } catch (err) {
    console.error('Delete error:', err);
    alert(`เกิดข้อผิดพลาดในการลบข้อมูล: ${err.message}`);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg> ยืนยัน ลบข้อมูล`;
  }
});


// ==========================================
// TIKTOK PREPARATION MODAL LOGIC
// ==========================================
const tiktokModal = document.getElementById('tiktok-modal');
const btnCancelTikTok = document.getElementById('btn-cancel-tiktok');
const btnSaveTikTok = document.getElementById('btn-save-tiktok');
const btnCopyCaption = document.getElementById('btn-tiktok-copy-caption');
const btnTikTokDownload = document.getElementById('btn-tiktok-download');

const tiktokVideoPreview = document.getElementById('tiktok-video-preview');
const tiktokCaption = document.getElementById('tiktok-caption');
const tiktokLink = document.getElementById('tiktok-link');
const tiktokStatus = document.getElementById('tiktok-status');

let currentTikTokId = null;

function openTikTokModal(id, videoUrl, description, caption, link, status) {
  currentTikTokId = id;
  
  // Set Video
  if (videoUrl && videoUrl.startsWith('http')) {
    // If it's a Google Drive link, we need to handle it or just use it if it's a direct link
    // Google Drive direct link format conversion (if it's using uc?id=)
    tiktokVideoPreview.src = videoUrl;
    btnTikTokDownload.onclick = () => window.open(videoUrl, '_blank');
  } else {
    tiktokVideoPreview.src = '';
    btnTikTokDownload.onclick = null;
  }
  
  // Set Description
  const tiktokDesc = document.getElementById('tiktok-desc');
  if (tiktokDesc) {
    tiktokDesc.value = description || '';
  }

  // Set Caption
  if (caption && caption.trim()) {
    tiktokCaption.value = caption;
  } else {
    const hashtags = "\n\n#tiktokshop #รีวิวสินค้า #ของดีบอกต่อ";
    tiktokCaption.value = description ? (description + hashtags) : hashtags;
  }
  
  // Set Link and Status
  tiktokLink.value = link || '';
  tiktokStatus.value = status || 'pending';
  
  // Show Modal
  tiktokModal.classList.remove('hidden');
}

if (btnCancelTikTok) {
  btnCancelTikTok.addEventListener('click', () => {
    tiktokModal.classList.add('hidden');
    tiktokVideoPreview.pause();
    currentTikTokId = null;
  });
}

const btnCopyDesc = document.getElementById('btn-tiktok-copy-desc');
if (btnCopyDesc) {
  btnCopyDesc.addEventListener('click', () => {
    const tiktokDesc = document.getElementById('tiktok-desc');
    if (tiktokDesc) {
      tiktokDesc.select();
      document.execCommand('copy');
      
      const originalText = btnCopyDesc.innerText;
      btnCopyDesc.innerText = '✅ คัดลอกแล้ว!';
      setTimeout(() => {
        btnCopyDesc.innerText = originalText;
      }, 2000);
    }
  });
}

if (btnCopyCaption) {
  btnCopyCaption.addEventListener('click', () => {
    tiktokCaption.select();
    document.execCommand('copy');
    
    const originalText = btnCopyCaption.innerText;
    btnCopyCaption.innerText = '✅ คัดลอกแล้ว!';
    setTimeout(() => {
      btnCopyCaption.innerText = originalText;
    }, 2000);
  });
}

if (btnSaveTikTok) {
  btnSaveTikTok.addEventListener('click', async () => {
    if (!currentTikTokId) return;
    
    const originalText = btnSaveTikTok.innerText;
    btnSaveTikTok.innerText = 'กำลังบันทึก...';
    btnSaveTikTok.disabled = true;
    
    try {
      const { headers, n8nUrl } = getAuthHeaders();
      const payload = {
        product_id: currentTikTokId,
        tiktok_link: tiktokLink.value.trim(),
        tiktok_status: tiktokStatus.value
      };
      
      const response = await fetch(`${n8nUrl}/webhook/update-tiktok-status`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      showToast('บันทึกข้อมูล TikTok เรียบร้อยแล้ว!');
      tiktokModal.classList.add('hidden');
      tiktokVideoPreview.pause();
      
      // Refresh the table to show the updated status
      fetchHistoryData();
      
    } catch (err) {
      console.error('Error saving TikTok info:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    } finally {
      btnSaveTikTok.innerText = originalText;
      btnSaveTikTok.disabled = false;
    }
  });
}
