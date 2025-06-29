// Design tokens (inlined to avoid import issues)
const tokens = {
  colors: {
    bg: '#262624',
    accent: '#c96442',
    secondary: '#8d8c85',
    text: '#ffffff',
  },
  radii: {
    card: '1rem',
    button: '9999px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
  duration: {
    fast: '150ms',
    normal: '250ms',
  },
};

// Overlay functionality (inlined from ui/Overlay.js)
let currentOverlay = null;

// Simple markdown parser for basic formatting
function parseMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML to prevent XSS
  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
  
  let html = escapeHtml(text);
  
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Code: `text`
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Line breaks: two newlines = paragraph, single newline = br
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = `<p>${html}</p>`;
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  
  return html;
}

async function createOverlay(text, anchorRect, variant = 'info') {
  console.log('🎨 createOverlay called with:', { text, anchorRect, variant }); // DEBUG
  
  // Remove any existing overlay
  removeOverlay();
  
  // Get theme setting
  let theme = 'dark';
  try {
    const result = await chrome.storage.local.get(['theme']);
    theme = result.theme || 'dark';
  } catch (error) {
    console.log('Could not get theme, using dark as default');
  }
  
  // Define theme-aware colors
  const themeColors = theme === 'light' ? {
    background: 'rgba(248, 249, 250, 0.95)',
    triangleColor: 'rgba(248, 249, 250, 0.95)',
    text: '#212529',
    border: 'rgba(0, 0, 0, 0.15)',
    headerBorder: 'rgba(0, 0, 0, 0.1)',
    scrollbar: 'rgba(0, 0, 0, 0.1)',
    code: 'rgba(0, 0, 0, 0.1)',
    secondary: '#6c757d'
  } : {
    background: 'rgba(38, 38, 36, 0.65)',
    triangleColor: 'rgba(38, 38, 36, 0.65)',
    text: '#ffffff',
    border: 'rgba(255, 255, 255, 0.1)',
    headerBorder: 'rgba(255, 255, 255, 0.1)',
    scrollbar: 'rgba(255, 255, 255, 0.1)',
    code: 'rgba(255, 255, 255, 0.1)',
    secondary: '#8d8c85'
  };

  // Create shadow host element
  const shadowHost = document.createElement('div');
  shadowHost.id = 'clarity-overlay-host';
  shadowHost.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;

  // Attach shadow DOM
  const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  // Load Font Awesome for icons
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
  shadowRoot.appendChild(fontAwesome);

  // Create styles
  const style = document.createElement('style');
  style.textContent = `
    .clarity-overlay {
      position: fixed;
      z-index: 2147483647;
      pointer-events: all;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      color: ${themeColors.text};
      border-radius: 18px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid ${themeColors.border};
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 350px;
      min-width: 250px;
      word-wrap: break-word;
      animation: fadeScaleIn ${tokens.duration.fast} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      transform-origin: center bottom;
      cursor: move;
      position: relative;
    }
    
    .clarity-overlay::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid ${themeColors.triangleColor};
      z-index: 2147483648;
    }
    
    .clarity-overlay.flipped::after {
      bottom: auto;
      top: -8px;
      border-top: none;
      border-bottom: 8px solid ${themeColors.triangleColor};
    }
    
    .overlay-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${tokens.spacing.sm} ${tokens.spacing.md};
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: move;
      font-weight: 600;
      font-size: 12px;
      color: ${tokens.colors.secondary};
    }
    
    .overlay-content {
      padding: ${tokens.spacing.md} ${tokens.spacing.lg};
      max-height: 250px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: ${tokens.colors.accent} rgba(255, 255, 255, 0.1);
    }
    
    .overlay-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .overlay-content::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
    
    .overlay-content::-webkit-scrollbar-thumb {
      background: ${tokens.colors.accent};
      border-radius: 3px;
    }
    
    .overlay-content::-webkit-scrollbar-thumb:hover {
      background: #d4704b;
    }
    
    .loading-content {
      display: flex;
      align-items: center;
      gap: ${tokens.spacing.sm};
      padding: ${tokens.spacing.lg};
    }
    
    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top: 2px solid ${tokens.colors.accent};
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    .loading-text {
      color: ${tokens.colors.secondary};
      font-size: 14px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .overlay-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .overlay-content::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
    
    .overlay-content::-webkit-scrollbar-thumb {
      background: ${tokens.colors.accent};
      border-radius: 3px;
    }
    
    .overlay-content::-webkit-scrollbar-thumb:hover {
      background: #d4704b;
    }
    
    .overlay-content p {
      margin: 0 0 ${tokens.spacing.sm} 0;
    }
    
    .overlay-content p:last-child {
      margin-bottom: 0;
    }
    
    .overlay-content strong {
      font-weight: 600;
      color: ${tokens.colors.text};
    }
    
    .overlay-content em {
      font-style: italic;
      color: ${tokens.colors.secondary};
    }
    
    .overlay-content code {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 0.9em;
      color: ${tokens.colors.accent};
    }
    
    .header-buttons {
      display: flex;
      gap: ${tokens.spacing.sm};
      align-items: center;
    }
    
    .header-button {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: ${tokens.colors.text};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      transition: all ${tokens.duration.fast};
      position: relative;
      flex-shrink: 0;
    }
    
    .header-button:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.1);
    }
    
    .copy-button {
      color: ${tokens.colors.accent};
    }
    
    .copy-button:hover {
      background: rgba(201, 100, 66, 0.2);
    }
    
    .copy-button.copied {
      color: #22c55e;
      background: rgba(34, 197, 94, 0.2);
    }
    
    .close-button {
      color: ${tokens.colors.secondary};
      font-size: 14px;
      font-weight: bold;
    }
    
    .close-button:hover {
      color: ${tokens.colors.text};
      background: rgba(255, 255, 255, 0.2);
    }
    
    .copy-button i {
      font-size: 11px;
    }

    .clarity-overlay.info {
      background: rgba(38, 38, 36, 0.65);
    }

    .clarity-overlay.error {
      background: rgba(201, 100, 66, 0.9);
    }
    
    .clarity-overlay.error::after {
      border-top-color: rgba(201, 100, 66, 0.9);
    }
    
    .clarity-overlay.error.flipped::after {
      border-bottom-color: rgba(201, 100, 66, 0.9);
    }

    .clarity-overlay.error::before {
      content: '⚠️ ';
      margin-right: ${tokens.spacing.sm};
    }

    @keyframes fadeScaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `;

  shadowRoot.appendChild(style);

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.className = `clarity-overlay ${variant}`;
  
  // Create header with title and buttons
  const header = document.createElement('div');
  header.className = 'overlay-header';
  
  const title = document.createElement('span');
  title.textContent = variant === 'error' ? 'Error' : 'Clarity Explanation';
  
  const headerButtons = document.createElement('div');
  headerButtons.className = 'header-buttons';
  
  // Copy button
  const copyButton = document.createElement('button');
  copyButton.className = 'header-button copy-button';
  copyButton.innerHTML = '<i class="fas fa-clipboard"></i>';
  copyButton.title = 'Copy explanation';
  copyButton.addEventListener('click', (e) => {
    e.stopPropagation();
    // Get the current full text from the overlay storage
    const textToCopy = currentOverlay?.fullText || text;
    copyToClipboard(textToCopy, copyButton);
  });
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.className = 'header-button close-button';
  closeButton.innerHTML = '×';
  closeButton.title = 'Close';
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    removeOverlay();
  });
  
  headerButtons.appendChild(copyButton);
  headerButtons.appendChild(closeButton);
  
  header.appendChild(title);
  header.appendChild(headerButtons);
  
  // Create content area
  const content = document.createElement('div');
  content.className = 'overlay-content';
  content.innerHTML = parseMarkdown(text);
  
  overlay.appendChild(header);
  overlay.appendChild(content);

  // Calculate position
  const position = calculateOverlayPosition(anchorRect);
  overlay.style.left = `${position.x}px`;
  overlay.style.top = `${position.y}px`;

  // Update transform origin and chat bubble triangle based on position
  if (position.flippedVertically) {
    overlay.style.transformOrigin = 'center top';
    overlay.classList.add('flipped');
  }

  shadowRoot.appendChild(overlay);
  document.body.appendChild(shadowHost);

  // Add drag functionality
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = overlay.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    overlay.style.cursor = 'grabbing';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep overlay within viewport bounds
      const maxX = window.innerWidth - overlay.offsetWidth;
      const maxY = window.innerHeight - overlay.offsetHeight;
      
      overlay.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
      overlay.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      overlay.style.cursor = 'move';
    }
  });

  // Store reference for cleanup
  currentOverlay = {
    host: shadowHost,
    overlay,
    shadowRoot,
    cleanup: null,
    fullText: text // Store the complete text for copying
  };

  // Add event listeners for dismissal
  addOverlayDismissalListeners();

  return overlay;
}

// Create streaming overlay that updates as chunks arrive
function createStreamingOverlay(text, anchorRect, variant = 'info') {
  console.log('🎨 createStreamingOverlay called with:', { text, anchorRect, variant }); // DEBUG
  
  // Create the overlay with loading animation instead of just text
  const overlay = createLoadingOverlay(anchorRect, variant);
  
  // Mark it as streaming overlay
  if (currentOverlay) {
    currentOverlay.isStreaming = true;
  }
  
  return overlay;
}

// Create overlay with loading animation
async function createLoadingOverlay(anchorRect, variant = 'info') {
  console.log('🎨 createLoadingOverlay called with:', { anchorRect, variant }); // DEBUG
  
  // Remove any existing overlay
  removeOverlay();
  
  // Get theme setting
  let theme = 'dark';
  try {
    const result = await chrome.storage.local.get(['theme']);
    theme = result.theme || 'dark';
  } catch (error) {
    console.log('Could not get theme, using dark as default');
  }
  
  // Define theme-aware colors
  const themeColors = theme === 'light' ? {
    background: 'rgba(248, 249, 250, 0.95)',
    triangleColor: 'rgba(248, 249, 250, 0.95)',
    text: '#212529',
    border: 'rgba(0, 0, 0, 0.15)',
    headerBorder: 'rgba(0, 0, 0, 0.1)',
    scrollbar: 'rgba(0, 0, 0, 0.1)',
    code: 'rgba(0, 0, 0, 0.1)',
    secondary: '#6c757d'
  } : {
    background: 'rgba(38, 38, 36, 0.65)',
    triangleColor: 'rgba(38, 38, 36, 0.65)',
    text: '#ffffff',
    border: 'rgba(255, 255, 255, 0.1)',
    headerBorder: 'rgba(255, 255, 255, 0.1)',
    scrollbar: 'rgba(255, 255, 255, 0.1)',
    code: 'rgba(255, 255, 255, 0.1)',
    secondary: '#8d8c85'
  };

  // Create shadow host element
  const shadowHost = document.createElement('div');
  shadowHost.id = 'clarity-overlay-host';
  shadowHost.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;

  // Attach shadow DOM
  const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  // Load Font Awesome for icons
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
  shadowRoot.appendChild(fontAwesome);

  // Create styles (reuse existing styles)
  const style = document.createElement('style');
  style.textContent = `
    .clarity-overlay {
      position: fixed;
      z-index: 2147483647;
      pointer-events: all;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      color: ${tokens.colors.text};
      border-radius: 18px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 350px;
      min-width: 250px;
      word-wrap: break-word;
      animation: fadeScaleIn ${tokens.duration.fast} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      transform-origin: center bottom;
      cursor: move;
      position: relative;
    }
    
    .clarity-overlay::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid rgba(38, 38, 36, 0.65);
      z-index: 2147483648;
    }
    
    .clarity-overlay.flipped::after {
      bottom: auto;
      top: -8px;
      border-top: none;
      border-bottom: 8px solid rgba(38, 38, 36, 0.65);
    }
    
    .overlay-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${tokens.spacing.sm} ${tokens.spacing.md};
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: move;
      font-weight: 600;
      font-size: 12px;
      color: ${tokens.colors.secondary};
    }
    
    .overlay-content {
      padding: ${tokens.spacing.md} ${tokens.spacing.lg};
      max-height: 250px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: ${tokens.colors.accent} rgba(255, 255, 255, 0.1);
    }
    
    .overlay-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .overlay-content::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
    
    .overlay-content::-webkit-scrollbar-thumb {
      background: ${tokens.colors.accent};
      border-radius: 3px;
    }
    
    .overlay-content::-webkit-scrollbar-thumb:hover {
      background: #d4704b;
    }
    
    .overlay-content p {
      margin: 0 0 ${tokens.spacing.sm} 0;
    }
    
    .overlay-content p:last-child {
      margin-bottom: 0;
    }
    
    .overlay-content strong {
      font-weight: 600;
      color: ${tokens.colors.text};
    }
    
    .overlay-content em {
      font-style: italic;
      color: ${tokens.colors.secondary};
    }
    
    .overlay-content code {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 0.9em;
      color: ${tokens.colors.accent};
    }
    
    .loading-content {
      display: flex;
      align-items: center;
      gap: ${tokens.spacing.sm};
      padding: ${tokens.spacing.lg};
    }
    
    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top: 2px solid ${tokens.colors.accent};
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    .loading-text {
      color: ${tokens.colors.secondary};
      font-size: 14px;
    }
    
    .header-buttons {
      display: flex;
      gap: ${tokens.spacing.sm};
      align-items: center;
    }
    
    .header-button {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: ${tokens.colors.text};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      transition: all ${tokens.duration.fast};
      position: relative;
      flex-shrink: 0;
    }
    
    .header-button:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.1);
    }
    
    .copy-button {
      color: ${tokens.colors.accent};
    }
    
    .copy-button:hover {
      background: rgba(201, 100, 66, 0.2);
    }
    
    .copy-button.copied {
      color: #22c55e;
      background: rgba(34, 197, 94, 0.2);
    }
    
    .close-button {
      color: ${tokens.colors.secondary};
      font-size: 14px;
      font-weight: bold;
    }
    
    .close-button:hover {
      color: ${tokens.colors.text};
      background: rgba(255, 255, 255, 0.2);
    }
    
    .copy-button i {
      font-size: 11px;
    }

    .clarity-overlay.info {
      background: rgba(38, 38, 36, 0.65);
    }

    .clarity-overlay.error {
      background: rgba(201, 100, 66, 0.9);
    }
    
    .clarity-overlay.error::after {
      border-top-color: rgba(201, 100, 66, 0.9);
    }
    
    .clarity-overlay.error.flipped::after {
      border-bottom-color: rgba(201, 100, 66, 0.9);
    }

    @keyframes fadeScaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  shadowRoot.appendChild(style);

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.className = `clarity-overlay ${variant}`;
  
  // Create header with title and buttons
  const header = document.createElement('div');
  header.className = 'overlay-header';
  
  const title = document.createElement('span');
  title.textContent = 'Clarity Explanation';
  
  const headerButtons = document.createElement('div');
  headerButtons.className = 'header-buttons';
  
  // Copy button (disabled during loading)
  const copyButton = document.createElement('button');
  copyButton.className = 'header-button copy-button';
  copyButton.innerHTML = '<i class="fas fa-clipboard"></i>';
  copyButton.title = 'Copy explanation';
  copyButton.disabled = true;
  copyButton.style.opacity = '0.5';
  copyButton.style.cursor = 'not-allowed';
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.className = 'header-button close-button';
  closeButton.innerHTML = '×';
  closeButton.title = 'Close';
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    removeOverlay();
  });
  
  headerButtons.appendChild(copyButton);
  headerButtons.appendChild(closeButton);
  
  header.appendChild(title);
  header.appendChild(headerButtons);
  
  // Create loading content area
  const loadingContent = document.createElement('div');
  loadingContent.className = 'loading-content';
  
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  
  const loadingText = document.createElement('span');
  loadingText.className = 'loading-text';
  loadingText.textContent = 'Loading explanation...';
  
  loadingContent.appendChild(spinner);
  loadingContent.appendChild(loadingText);
  
  overlay.appendChild(header);
  overlay.appendChild(loadingContent);

  // Calculate position
  const position = calculateOverlayPosition(anchorRect);
  console.log('🎯 Setting loading overlay position:', position); // DEBUG
  
  // Ensure position values are valid numbers
  const safeX = isNaN(position.x) ? 0 : Math.max(0, position.x);
  const safeY = isNaN(position.y) ? 0 : Math.max(0, position.y);
  
  overlay.style.left = `${safeX}px`;
  overlay.style.top = `${safeY}px`;
  
  console.log('📐 Applied loading overlay styles:', { // DEBUG
    left: overlay.style.left,
    top: overlay.style.top,
    computed: window.getComputedStyle(overlay).getPropertyValue('position')
  });

  // Update transform origin and chat bubble triangle based on position
  if (position.flippedVertically) {
    overlay.style.transformOrigin = 'center top';
    overlay.classList.add('flipped');
  }

  shadowRoot.appendChild(overlay);
  document.body.appendChild(shadowHost);

  // Add drag functionality
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = overlay.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    overlay.style.cursor = 'grabbing';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep overlay within viewport bounds
      const maxX = window.innerWidth - overlay.offsetWidth;
      const maxY = window.innerHeight - overlay.offsetHeight;
      
      overlay.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
      overlay.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      overlay.style.cursor = 'move';
    }
  });

  // Store reference for cleanup
  currentOverlay = {
    host: shadowHost,
    overlay,
    shadowRoot,
    cleanup: null,
    isStreaming: true
  };

  // Add event listeners for dismissal
  addOverlayDismissalListeners();

  // Debug: Check if overlay is visible
  setTimeout(() => {
    const rect = overlay.getBoundingClientRect();
    console.log('📍 Loading overlay final position check:', { // DEBUG
      boundingRect: rect,
      isVisible: rect.width > 0 && rect.height > 0,
      inViewport: rect.top >= 0 && rect.left >= 0 && 
                  rect.bottom <= window.innerHeight && 
                  rect.right <= window.innerWidth,
      scrollPosition: { x: window.scrollX, y: window.scrollY }
    });
  }, 100);

  return overlay;
}

// Copy text to clipboard
function copyToClipboard(text, buttonElement) {
  // Remove markdown formatting for plain text copy
  const plainText = text.replace(/\*\*(.*?)\*\*/g, '$1')
                       .replace(/\*(.*?)\*/g, '$1')
                       .replace(/`(.*?)`/g, '$1')
                       .replace(/<br>/g, '\n')
                       .replace(/<\/p><p>/g, '\n\n')
                       .replace(/<[^>]*>/g, '');
  
  navigator.clipboard.writeText(plainText).then(() => {
    // Show success feedback
    const originalIcon = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="fas fa-check"></i>';
    buttonElement.classList.add('copied');
    
    setTimeout(() => {
      buttonElement.innerHTML = originalIcon;
      buttonElement.classList.remove('copied');
    }, 2000);
  }).catch((err) => {
    console.error('Failed to copy text: ', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = plainText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Show success feedback
    const originalIcon = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="fas fa-check"></i>';
    buttonElement.classList.add('copied');
    
    setTimeout(() => {
      buttonElement.innerHTML = originalIcon;
      buttonElement.classList.remove('copied');
    }, 2000);
  });
}

// Update streaming overlay content
function updateStreamingOverlay(fullText) {
  if (currentOverlay && currentOverlay.isStreaming) {
    let content = currentOverlay.shadowRoot.querySelector('.overlay-content');
    
    // If we're still showing loading content, replace it with actual content
    if (!content) {
      const loadingContent = currentOverlay.shadowRoot.querySelector('.loading-content');
      if (loadingContent) {
        // Replace loading content with actual content area
        content = document.createElement('div');
        content.className = 'overlay-content';
        content.innerHTML = parseMarkdown(fullText);
        
        // Enable copy button and add event listener
        const copyButton = currentOverlay.shadowRoot.querySelector('.copy-button');
        if (copyButton) {
          copyButton.disabled = false;
          copyButton.style.opacity = '1';
          copyButton.style.cursor = 'pointer';
          copyButton.addEventListener('click', (e) => {
            e.stopPropagation();
            // Get the most current full text
            const textToCopy = currentOverlay?.fullText || fullText;
            copyToClipboard(textToCopy, copyButton);
          });
        }
        
        // Replace loading content with real content
        loadingContent.parentNode.replaceChild(content, loadingContent);
      }
    } else {
      // Update existing content
      content.innerHTML = parseMarkdown(fullText);
    }
    
    // Always update the stored full text for copying
    if (currentOverlay) {
      currentOverlay.fullText = fullText;
    }
  }
}

// Complete streaming overlay
function completeStreamingOverlay() {
  if (currentOverlay && currentOverlay.isStreaming) {
    currentOverlay.isStreaming = false;
  }
}

function calculateOverlayPosition(anchorRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  
  console.log('🧮 Position calculation:', { // DEBUG
    anchorRect,
    viewport: { width: viewportWidth, height: viewportHeight },
    scroll: { x: scrollX, y: scrollY }
  });
  
  // Determine if this is a button-based rect (height = 0) or selection-based rect
  const isButtonBased = anchorRect.height === 0;
  
  let x, y;
  
  if (isButtonBased) {
    // For button-based positioning, anchorRect is already viewport-relative
    // Position overlay near button without adding scroll offsets
    x = anchorRect.left + (anchorRect.width / 2) - 175; // 175 is half of max-width (350px)
    y = anchorRect.bottom + 8; // anchorRect.bottom is already button.bottom + 8
    
    console.log('📍 Using button-based positioning (viewport-relative)'); // DEBUG
  } else {
    // For selection-based positioning, convert viewport-relative to document coordinates
    const absoluteLeft = anchorRect.left + scrollX;
    const absoluteTop = anchorRect.top + scrollY;
    const absoluteBottom = anchorRect.bottom + scrollY;
    
    x = absoluteLeft + (anchorRect.width / 2) - 175;
    y = absoluteBottom + 8;
    
    console.log('📍 Using selection-based positioning (document coordinates)'); // DEBUG
  }
  
  let flippedVertically = false;
  let flippedHorizontally = false;

  // Check if overlay would go beyond right edge
  const overlayWidth = 350; // max-width from CSS
  const rightBoundary = isButtonBased ? viewportWidth : viewportWidth + scrollX;
  if (x + overlayWidth > rightBoundary) {
    x = rightBoundary - overlayWidth - 16; // 16px margin from edge
    flippedHorizontally = true;
  }

  // Check if overlay would go beyond left edge
  const leftBoundary = isButtonBased ? 0 : scrollX;
  if (x < leftBoundary + 16) {
    x = leftBoundary + 16;
    flippedHorizontally = true;
  }

  // Check if overlay would go beyond bottom edge (estimate 200px height)
  const estimatedHeight = 200;
  const bottomBoundary = isButtonBased ? viewportHeight : viewportHeight + scrollY;
  if (y + estimatedHeight > bottomBoundary) {
    const topReference = isButtonBased ? anchorRect.top : anchorRect.top + scrollY;
    y = topReference - 8 - estimatedHeight; // Position above the anchor
    flippedVertically = true;
  }

  // Ensure overlay doesn't go above viewport
  const topBoundary = isButtonBased ? 0 : scrollY;
  if (y < topBoundary + 16) {
    y = topBoundary + 16;
  }
  
  console.log('📍 Final position:', { x, y, flippedVertically, flippedHorizontally, isButtonBased }); // DEBUG

  return { x, y, flippedVertically, flippedHorizontally };
}

function addOverlayDismissalListeners() {
  if (!currentOverlay) return;

  const handleClickOutside = (event) => {
    if (!currentOverlay) return;
    
    // Check if click is outside the shadow DOM
    const path = event.composedPath();
    const isInsideOverlay = path.some(element => 
      element === currentOverlay.overlay || 
      element === currentOverlay.host
    );
    
    if (!isInsideOverlay) {
      removeOverlay();
    }
  };

  const handleEscapeKey = (event) => {
    if (event.key === 'Escape') {
      removeOverlay();
    }
  };

  // Add listeners with a slight delay to prevent immediate dismissal
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside, { capture: true });
    document.addEventListener('keydown', handleEscapeKey);
  }, 100);

  // Store cleanup functions
  currentOverlay.cleanup = () => {
    document.removeEventListener('click', handleClickOutside, { capture: true });
    document.removeEventListener('keydown', handleEscapeKey);
  };
}

function removeOverlay() {
  if (!currentOverlay) return;

  try {
    // Clean up event listeners
    if (currentOverlay.cleanup) {
      currentOverlay.cleanup();
    }

    // Remove from DOM
    if (currentOverlay.host && currentOverlay.host.parentNode) {
      currentOverlay.host.parentNode.removeChild(currentOverlay.host);
    }
  } catch (error) {
    console.warn('Error removing overlay:', error);
  }

  currentOverlay = null;
}

// ActionButton functionality (inlined)
function createActionButton(onClick, left = 0, top = 0) {
  console.log('🏗️ createActionButton called with position:', { left, top }); // DEBUG
  
  const button = document.createElement('div');
  button.id = 'clarity-action-button';
  console.log('🏗️ Button element created:', button); // DEBUG
  
  const shadow = button.attachShadow({ mode: 'closed' });
  console.log('🏗️ Shadow DOM attached'); // DEBUG
  
  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      z-index: 2147483647;
      pointer-events: none;
    }
    
    .button {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${tokens.spacing.sm} ${tokens.spacing.md};
      background: ${tokens.colors.accent};
      border-radius: 20px;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all ${tokens.duration.fast} cubic-bezier(0.25, 0.46, 0.45, 0.94);
      backdrop-filter: blur(8px);
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      color: ${tokens.colors.text};
      gap: ${tokens.spacing.xs};
    }
    
    .button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
      background: #d4704b;
    }
    
    .arrow {
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 6px solid ${tokens.colors.text};
      margin-left: ${tokens.spacing.xs};
    }
  `;
  
  const buttonEl = document.createElement('div');
  buttonEl.className = 'button';
  console.log('🏗️ Button inner element created:', buttonEl); // DEBUG
  
  // Add text content
  const textSpan = document.createElement('span');
  textSpan.textContent = 'Explain with Clarity';
  
  // Add arrow pointing down
  const arrow = document.createElement('div');
  arrow.className = 'arrow';
  
  buttonEl.appendChild(textSpan);
  buttonEl.appendChild(arrow);
  shadow.appendChild(style);
  shadow.appendChild(buttonEl);
  console.log('🏗️ Elements added to shadow DOM'); // DEBUG
  
  buttonEl.addEventListener('click', (e) => {
    console.log('🔘 Button clicked!'); // DEBUG
    e.preventDefault();
    e.stopPropagation();
    
    if (onClick) {
      console.log('🔘 Calling onClick handler'); // DEBUG
      onClick();
    }
  });
  console.log('🏗️ Click event listener added'); // DEBUG
  
  button.remove = function() {
    if (button.parentNode) {
      button.parentNode.removeChild(button);
    }
  };
  
  console.log('🏗️ Button created and ready to return:', button); // DEBUG
  return button;
}

// Main content script functionality
let currentButton = null;
let debounceTimer = null;

function debounce(func, delay) {
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(debounceTimer);
      func(...args);
    };
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(later, delay);
  };
}

function removeExistingButton() {
  if (currentButton) {
    currentButton.remove();
    currentButton = null;
  }
}

function getSelectionContext(selection) {
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  
  const contextLength = 200;
  const fullText = element.textContent || '';
  const selectedText = selection.toString();
  const selectionStart = fullText.indexOf(selectedText);
  
  if (selectionStart === -1) return fullText.slice(0, contextLength);
  
  const contextStart = Math.max(0, selectionStart - contextLength / 2);
  const contextEnd = Math.min(fullText.length, selectionStart + selectedText.length + contextLength / 2);
  
  return fullText.slice(contextStart, contextEnd);
}


function handleSelection() {
  console.log('🎯 handleSelection called'); // DEBUG
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  console.log('📝 Selected text:', selectedText); // DEBUG
  
  removeExistingButton();
  
  if (!selectedText || selectedText.length === 0) {
    return;
  }
  
  console.log('✅ Text selected, creating button'); // DEBUG
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const context = getSelectionContext(selection);
  
  const anchorRect = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom
  };
  
  // Calculate button position (centered above selection)
  const left = rect.left + (rect.width / 2) - 75; // Approximately half of button width
  const top = rect.top - 45;
  
  currentButton = createActionButton(() => {
    console.log('🚀 onClick handler called!'); // DEBUG
    
    // Recalculate the selection position when button is clicked
    // This ensures we have the correct position even if user scrolled
    let currentAnchorRect = anchorRect;
    const currentSelection = window.getSelection();
    if (currentSelection.rangeCount > 0) {
      const currentRange = currentSelection.getRangeAt(0);
      const currentRect = currentRange.getBoundingClientRect();
      
      // Only update if we have a valid selection that matches our text
      if (currentSelection.toString().trim() === selectedText) {
        currentAnchorRect = {
          top: currentRect.top,
          left: currentRect.left,
          width: currentRect.width,
          height: currentRect.height,
          right: currentRect.right,
          bottom: currentRect.bottom
        };
        console.log('📍 Updated anchor rect for current position:', currentAnchorRect); // DEBUG
      } else {
        console.log('⚠️ Selection changed, using button position as fallback'); // DEBUG
        // If selection is gone, use button position as anchor
        const buttonRect = currentButton.getBoundingClientRect();
        currentAnchorRect = {
          top: buttonRect.bottom + 8, // Position below button
          left: buttonRect.left,
          width: buttonRect.width,
          height: 0,
          right: buttonRect.right,
          bottom: buttonRect.bottom + 8
        };
        console.log('📍 Using button-based anchor rect:', currentAnchorRect); // DEBUG
      }
    } else {
      console.log('⚠️ No selection found, using button position as fallback'); // DEBUG
      // If no selection, use button position as anchor
      const buttonRect = currentButton.getBoundingClientRect();
      currentAnchorRect = {
        top: buttonRect.bottom + 8,
        left: buttonRect.left,
        width: buttonRect.width,
        height: 0,
        right: buttonRect.right,
        bottom: buttonRect.bottom + 8
      };
      console.log('📍 Using button-based anchor rect (no selection):', currentAnchorRect); // DEBUG
    }
    
    // Capture variables in closure to ensure they're available in callback
    const requestPayload = {
      text: selectedText,
      context: context,
      anchorRect: currentAnchorRect
    };
    
    console.log('📦 Request payload:', requestPayload); // DEBUG
    
    // Send message to background script
    console.log('📞 Sending message to background script'); // DEBUG
    
    try {
      chrome.runtime.sendMessage({
        type: 'EXPLAIN',
        payload: requestPayload
      }, (response) => {
        console.log('📨 Received response from background:', response); // DEBUG
        
        if (chrome.runtime.lastError) {
          console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
          if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
            createOverlay('Extension reloaded. Please refresh the page and try again.', requestPayload.anchorRect, 'error');
          } else {
            createOverlay(`Extension error: ${chrome.runtime.lastError.message}`, requestPayload.anchorRect, 'error');
          }
          return;
        }
      
      if (response) {
        console.log('✅ Processing response type:', response.type); // DEBUG
        if (response.type === 'EXPLANATION_READY') {
          console.log('🎯 Creating info overlay with text:', response.text); // DEBUG
          createOverlay(response.text, response.anchorRect, 'info');
        } else if (response.type === 'EXPLANATION_LOADING') {
          console.log('⏳ Creating loading overlay'); // DEBUG
          createStreamingOverlay('Loading explanation...', response.anchorRect, 'info');
        } else if (response.type === 'EXPLANATION_ERROR') {
          console.log('⚠️ Creating error overlay with message:', response.message); // DEBUG
          createOverlay(response.message, response.anchorRect, 'error');
        }
      } else {
        console.log('⚠️ No response received, showing fallback error'); // DEBUG
        createOverlay('No response from background script', requestPayload.anchorRect, 'error');
      }
    });
    } catch (error) {
      console.error('❌ Error sending message:', error);
      createOverlay('Extension communication error. Please refresh the page.', requestPayload.anchorRect, 'error');
    }
    
    removeExistingButton();
  }, Math.max(8, left), Math.max(8, top));
  
  document.body.appendChild(currentButton);
  console.log('🏗️ Button added to DOM'); // DEBUG
}


const debouncedHandleSelection = debounce(handleSelection, 300);

document.addEventListener('mouseup', debouncedHandleSelection);
// Removed selectionchange listener - was causing issues

document.addEventListener('click', (e) => {
  if (currentButton && !currentButton.contains(e.target)) {
    removeExistingButton();
  }
});

window.addEventListener('scroll', () => {
  if (currentButton) {
    // Remove button on scroll since repositioning with Shadow DOM is complex
    removeExistingButton();
  }
});

window.addEventListener('resize', () => {
  removeExistingButton();
});

// Listen for streaming messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content script received message:', message);
  
  if (message.type === 'EXPLANATION_CHUNK') {
    updateStreamingOverlay(message.fullText);
  } else if (message.type === 'EXPLANATION_COMPLETE') {
    updateStreamingOverlay(message.text);
    completeStreamingOverlay();
  }
});