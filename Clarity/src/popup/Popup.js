import tokens from '../tokens.js';

// State management
let appState = {
  numExplains: 0,
  firstUse: null,
  lastUse: null,
  hasApiKey: false,
  isLoading: true,
  currentTab: 'home', // 'home' or 'settings'
  isInitialLoad: true, // Track if this is the first render
  // Settings
  geminiKey: '',
  detailLevel: 'brief',
  theme: 'dark'
};

/**
 * Initialize the popup when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  render();
});

/**
 * Load data from chrome storage
 */
async function loadData() {
  try {
    const result = await chrome.storage.local.get([
      'numExplains',
      'firstUse', 
      'lastUse',
      'GEMINI_KEY',
      'detailLevel',
      'theme'
    ]);

    appState = {
      numExplains: result.numExplains || 0,
      firstUse: result.firstUse,
      lastUse: result.lastUse,
      hasApiKey: !!(result.GEMINI_KEY && result.GEMINI_KEY.trim()),
      geminiKey: result.GEMINI_KEY || '',
      detailLevel: result.detailLevel || 'brief',
      theme: result.theme || 'dark',
      isLoading: false,
      currentTab: 'home',
      isInitialLoad: true
    };
  } catch (error) {
    console.error('Error loading popup data:', error);
    appState.isLoading = false;
  }
}

/**
 * Render the popup UI
 */
function render() {
  const root = document.getElementById('root');
  if (!root) return;

  // Apply theme to body
  document.body.setAttribute('data-theme', appState.theme);

  root.innerHTML = `
    <div class="popup-container">
      ${renderHeader()}
      <div class="content-area">
        <div class="tab-content ${appState.currentTab === 'home' ? 'active' : ''}" id="home-tab">
          ${renderStats()}
          ${renderStatus()}
        </div>
        <div class="tab-content ${appState.currentTab === 'settings' ? 'active' : ''}" id="settings-tab">
          ${renderSettings()}
        </div>
      </div>
      ${renderNavbar()}
    </div>
  `;

  // Add event listeners
  addEventListeners();
}

/**
 * Render the header section
 */
function renderHeader() {
  return `
    <div class="header">
      <div class="logo">
        <div class="logo-icon">
          <img src="/public/icons/128.png" alt="Clarity Logo" />
        </div>
        <h1 class="logo-text">Clarity</h1>
      </div>
    </div>
  `;
}

/**
 * Render the stats section
 */
function renderStats() {
  if (appState.isLoading) {
    return `
      <div class="stats-section">
        <div class="loading">Loading stats...</div>
      </div>
    `;
  }

  const todayExplains = getTodayExplains();
  const firstUseFormatted = formatDate(appState.firstUse);
  const lastUseFormatted = formatDate(appState.lastUse);

  const statsLoadedClass = appState.isInitialLoad ? 'stats-loaded' : '';
  
  return `
    <div class="stats-section ${statsLoadedClass}">
      <h2 class="section-title">Usage Statistics</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${todayExplains}</div>
          <div class="stat-label">Today</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${appState.numExplains}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${firstUseFormatted}</div>
          <div class="stat-label">First Used</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${lastUseFormatted}</div>
          <div class="stat-label">Last Used</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the connection status section
 */
function renderStatus() {
  const statusText = appState.hasApiKey ? 'Connected' : 'No API key';
  const statusIcon = appState.hasApiKey ? 
    '<i class="fas fa-check-circle"></i>' : 
    '<i class="fas fa-exclamation-triangle"></i>';
  const statusClass = appState.hasApiKey ? 'connected' : 'disconnected';

  return `
    <div class="status-section">
      <div class="status-pill ${statusClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-text">${statusText}</span>
      </div>
    </div>
  `;
}

/**
 * Render the settings section
 */
function renderSettings() {
  return `
    <div class="settings-content">
      <form id="settings-form" class="settings-form">
        <div class="form-group">
          <label for="gemini-key" class="form-label">
            <i class="fas fa-key"></i>
            Gemini API Key
            <span class="tooltip" data-tooltip="Get your free API key from ai.google.dev">
              <i class="fas fa-info-circle" style="font-size: 12px; color: var(--color-text-muted); margin-left: 4px;"></i>
            </span>
          </label>
          <div class="input-group">
            <input 
              type="password" 
              id="gemini-key" 
              class="form-input" 
              placeholder="Enter your Gemini API key"
              value="${appState.geminiKey}"
              autocomplete="off"
              spellcheck="false"
            />
            <button type="button" id="toggle-key-visibility" class="toggle-btn" aria-label="Toggle key visibility">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <div class="security-notice">
            <i class="fas fa-shield-alt icon"></i>
            <span>Your API key is stored locally and securely in your browser. It is never transmitted to any servers except Google's Gemini API.</span>
          </div>
          <div id="key-error" class="error-message" style="display: none;"></div>
        </div>
        
        
        <div class="form-group">
          <label for="detail-level" class="form-label">
            <i class="fas fa-sliders-h"></i>
            Explanation Detail Level
            <span class="tooltip" data-tooltip="Choose how detailed AI explanations should be">
              <i class="fas fa-info-circle" style="font-size: 12px; color: var(--color-text-muted); margin-left: 4px;"></i>
            </span>
          </label>
          <select id="detail-level" class="form-select">
            <option value="simple" ${appState.detailLevel === 'simple' ? 'selected' : ''}>Simple (12-year-old level)</option>
            <option value="brief" ${appState.detailLevel === 'brief' ? 'selected' : ''}>Brief (1-2 sentences)</option>
            <option value="detailed" ${appState.detailLevel === 'detailed' ? 'selected' : ''}>Detailed (comprehensive)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="theme" class="form-label">
            <i class="fas fa-palette"></i>
            Theme
            <span class="tooltip" data-tooltip="Choose between light and dark theme">
              <i class="fas fa-info-circle" style="font-size: 12px; color: var(--color-text-muted); margin-left: 4px;"></i>
            </span>
          </label>
          <select id="theme" class="form-select">
            <option value="dark" ${appState.theme === 'dark' ? 'selected' : ''}>Dark Mode</option>
            <option value="light" ${appState.theme === 'light' ? 'selected' : ''}>Light Mode</option>
          </select>
        </div>
        
        <div class="form-actions">
          <button type="submit" id="save-settings" class="save-button">
            <i class="fas fa-save"></i>
            Save Settings
          </button>
        </div>
      </form>
    </div>
  `;
}

/**
 * Render the bottom navigation bar
 */
function renderNavbar() {
  return `
    <div class="navbar">
      <div class="nav-indicator" style="transform: translateX(${appState.currentTab === 'home' ? '0' : '100%'})"></div>
      <button class="nav-item ${appState.currentTab === 'home' ? 'active' : ''}" data-tab="home">
        <i class="fas fa-home"></i>
        <span>Home</span>
      </button>
      <button class="nav-item ${appState.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
        <i class="fas fa-cog"></i>
        <span>Settings</span>
      </button>
    </div>
  `;
}

/**
 * Add event listeners to interactive elements
 */
function addEventListeners() {
  // Navigation tabs
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Key visibility toggle
  const toggleKeyBtn = document.getElementById('toggle-key-visibility');
  if (toggleKeyBtn) {
    toggleKeyBtn.addEventListener('click', toggleKeyVisibility);
  }

  // Form submission
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', handleSettingsSave);
  }

  // Real-time validation
  const geminiKeyInput = document.getElementById('gemini-key');
  if (geminiKeyInput) {
    geminiKeyInput.addEventListener('input', validateGeminiKey);
  }
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  if (tabName === appState.currentTab) return;
  
  appState.currentTab = tabName;
  appState.isInitialLoad = false; // Mark that this is no longer initial load
  
  // Update tab content visibility
  const homeTab = document.getElementById('home-tab');
  const settingsTab = document.getElementById('settings-tab');
  const navIndicator = document.querySelector('.nav-indicator');
  const navItems = document.querySelectorAll('.nav-item');
  
  if (homeTab && settingsTab && navIndicator) {
    // Remove active classes
    homeTab.classList.remove('active');
    settingsTab.classList.remove('active');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Add active class to current tab
    if (tabName === 'home') {
      homeTab.classList.add('active');
      navIndicator.style.transform = 'translateX(0)';
    } else {
      settingsTab.classList.add('active');
      navIndicator.style.transform = 'translateX(100%)';
    }
    
    // Update nav item active state
    const activeNavItem = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeNavItem) {
      activeNavItem.classList.add('active');
    }
  }
}

/**
 * Toggle API key visibility
 */
function toggleKeyVisibility() {
  const keyInput = document.getElementById('gemini-key');
  const toggleBtn = document.getElementById('toggle-key-visibility');
  const icon = toggleBtn.querySelector('i');
  
  if (keyInput.type === 'password') {
    keyInput.type = 'text';
    icon.className = 'fas fa-eye-slash';
    toggleBtn.setAttribute('aria-label', 'Hide key');
  } else {
    keyInput.type = 'password';
    icon.className = 'fas fa-eye';
    toggleBtn.setAttribute('aria-label', 'Show key');
  }
}

/**
 * Validate Gemini API key
 */
function validateGeminiKey() {
  const keyInput = document.getElementById('gemini-key');
  const errorDiv = document.getElementById('key-error');
  const key = keyInput.value.trim();
  
  if (key.length > 0 && key.length < 25) {
    errorDiv.textContent = 'API key must be at least 25 characters long';
    errorDiv.style.display = 'block';
    keyInput.classList.add('error');
    return false;
  } else {
    errorDiv.style.display = 'none';
    keyInput.classList.remove('error');
    return true;
  }
}

/**
 * Handle settings form submission
 */
async function handleSettingsSave(event) {
  event.preventDefault();
  
  const keyInput = document.getElementById('gemini-key');
  const detailLevelInput = document.getElementById('detail-level');
  const themeInput = document.getElementById('theme');
  const saveButton = document.getElementById('save-settings');
  const errorDiv = document.getElementById('key-error');
  
  const key = keyInput.value.trim();
  
  // Validate key
  if (key.length > 0 && key.length < 25) {
    errorDiv.textContent = 'API key must be at least 25 characters long';
    errorDiv.style.display = 'block';
    keyInput.classList.add('error');
    return;
  }
  
  if (key.length === 0) {
    errorDiv.textContent = 'Please enter your Gemini API key';
    errorDiv.style.display = 'block';
    keyInput.classList.add('error');
    return;
  }
  
  // Show loading state
  const originalText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  saveButton.disabled = true;
  
  try {
    // Save to storage
    await chrome.storage.local.set({
      GEMINI_KEY: key,
      detailLevel: detailLevelInput.value,
      theme: themeInput.value
    });
    
    // Update app state
    appState.geminiKey = key;
    appState.hasApiKey = true;
    appState.detailLevel = detailLevelInput.value;
    appState.theme = themeInput.value;
    
    // Apply theme change immediately
    document.body.setAttribute('data-theme', appState.theme);
    
    // Show success feedback with animation
    saveButton.innerHTML = '<i class="fas fa-check"></i> Saved!';
    saveButton.classList.add('success');
    
    // Update status section
    updateStatusDisplay();
    
    // Reset button after delay
    setTimeout(() => {
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
      saveButton.classList.remove('success');
    }, 2000);
    
  } catch (error) {
    console.error('Error saving settings:', error);
    errorDiv.textContent = 'Failed to save settings. Please try again.';
    errorDiv.style.display = 'block';
    
    // Reset button
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}

/**
 * Update the status display after settings change
 */
function updateStatusDisplay() {
  const statusSection = document.querySelector('.status-section');
  if (statusSection) {
    // Add a small animation when status changes
    statusSection.style.transform = 'scale(0.95)';
    statusSection.style.opacity = '0.7';
    
    setTimeout(() => {
      statusSection.innerHTML = renderStatus().replace('<div class="status-section">', '').replace('</div>', '');
      statusSection.style.transform = 'scale(1)';
      statusSection.style.opacity = '1';
      statusSection.style.transition = 'all 0.3s ease-out';
    }, 150);
  }
}

/**
 * Get number of explains for today
 */
function getTodayExplains() {
  if (!appState.lastUse) return 0;
  
  const today = new Date();
  const lastUse = new Date(appState.lastUse);
  
  // Check if last use was today
  if (
    today.getDate() === lastUse.getDate() &&
    today.getMonth() === lastUse.getMonth() &&
    today.getFullYear() === lastUse.getFullYear()
  ) {
    return appState.numExplains;
  }
  
  return 0;
}

/**
 * Format a date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'Never';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch (error) {
    return 'Unknown';
  }
}
