import tokens from '../tokens.js';

let currentOverlay = null;

/**
 * Creates and displays a floating overlay with explanation text
 * @param {string} text - The text content to display
 * @param {DOMRect} anchorRect - The bounding rectangle of the selected text
 * @param {string} variant - The variant ('info' or 'error')
 */
export function createOverlay(text, anchorRect, variant = 'info') {
  // Remove any existing overlay
  removeOverlay();

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

  // Load styles into shadow DOM
  const styleSheet = new CSSStyleSheet();
  const cssContent = `
    .clarity-overlay {
      position: fixed;
      z-index: 2147483647;
      pointer-events: all;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      color: ${tokens.colors.text};
      border-radius: ${tokens.radii.card};
      padding: ${tokens.spacing.md} ${tokens.spacing.lg};
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 300px;
      word-wrap: break-word;
      animation: fadeScaleIn ${tokens.duration.fast} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      transform-origin: center bottom;
    }

    .clarity-overlay.info {
      background: rgba(38, 38, 36, 0.65);
    }

    .clarity-overlay.error {
      background: rgba(201, 100, 66, 0.9);
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

  try {
    styleSheet.replaceSync(cssContent);
    shadowRoot.adoptedStyleSheets = [styleSheet];
  } catch (error) {
    // Fallback for older browsers
    const style = document.createElement('style');
    style.textContent = cssContent;
    shadowRoot.appendChild(style);
  }

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.className = `clarity-overlay ${variant}`;
  overlay.textContent = text;

  // Calculate position
  const position = calculatePosition(anchorRect);
  overlay.style.left = `${position.x}px`;
  overlay.style.top = `${position.y}px`;

  // Update transform origin based on position
  if (position.flippedVertically) {
    overlay.style.transformOrigin = 'center top';
  }

  shadowRoot.appendChild(overlay);
  document.body.appendChild(shadowHost);

  // Store reference for cleanup
  currentOverlay = {
    host: shadowHost,
    overlay,
    shadowRoot
  };

  // Add event listeners for dismissal
  addDismissalListeners();

  return overlay;
}

/**
 * Calculates the optimal position for the overlay
 * @param {DOMRect} anchorRect - The bounding rectangle of the selected text
 * @returns {Object} Position object with x, y coordinates and flip flags
 */
function calculatePosition(anchorRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  
  // Default position: 8px below the anchor, centered horizontally
  let x = anchorRect.left + scrollX + (anchorRect.width / 2) - 150; // 150 is half of max-width
  let y = anchorRect.bottom + scrollY + 8;
  
  let flippedVertically = false;
  let flippedHorizontally = false;

  // Check if overlay would go beyond right edge
  if (x + 300 > viewportWidth + scrollX) {
    x = viewportWidth + scrollX - 300 - 16; // 16px margin from edge
    flippedHorizontally = true;
  }

  // Check if overlay would go beyond left edge
  if (x < scrollX + 16) {
    x = scrollX + 16;
    flippedHorizontally = true;
  }

  // Check if overlay would go beyond bottom edge (estimate 100px height)
  if (y + 100 > viewportHeight + scrollY) {
    y = anchorRect.top + scrollY - 8 - 100; // Position above the anchor
    flippedVertically = true;
  }

  // Ensure overlay doesn't go above viewport
  if (y < scrollY + 16) {
    y = scrollY + 16;
  }

  return { x, y, flippedVertically, flippedHorizontally };
}

/**
 * Adds event listeners for overlay dismissal
 */
function addDismissalListeners() {
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

/**
 * Removes the current overlay and cleans up event listeners
 */
export function removeOverlay() {
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
