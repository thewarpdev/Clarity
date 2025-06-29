import tokens from '../tokens.js';

export default function createActionButton(onClick) {
  const button = document.createElement('div');
  button.id = 'clarity-action-button';
  
  const shadow = button.attachShadow({ mode: 'closed' });
  
  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
    }
    
    .button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: ${tokens.colors.accent};
      border-radius: ${tokens.radii.button};
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all ${tokens.duration.fast} cubic-bezier(0.25, 0.46, 0.45, 0.94);
      backdrop-filter: blur(8px);
    }
    
    .button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    }
    
    .icon {
      width: 16px;
      height: 16px;
      fill: ${tokens.colors.text};
    }
  `;
  
  const buttonEl = document.createElement('div');
  buttonEl.className = 'button';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.className = 'icon';
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M7 10l5 5 5-5z');
  
  svg.appendChild(path);
  buttonEl.appendChild(svg);
  shadow.appendChild(style);
  shadow.appendChild(buttonEl);
  
  buttonEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) onClick();
  });
  
  button.remove = function() {
    if (button.parentNode) {
      button.parentNode.removeChild(button);
    }
  };
  
  return button;
}