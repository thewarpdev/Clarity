# Clarity – AI Concept-Explainer Chrome Extension

Clarity is a lightweight Chrome extension that helps users instantly understand unfamiliar terms, phrases, or questions on any webpage by providing concise AI-powered explanations alongside an elegant, modern UI.

---

## Features

* **Inline Explanations**: Highlight text to trigger a 1–2 sentence plain-language explanation.
* **Context Awareness (WOP)**: Sends selected text plus one sentence of surrounding context, page title, and domain to the AI for more accurate responses. Sends selected text plus one sentence of surrounding context, page title, and domain to the AI for more accurate responses.
* **Glossary (WOP)**: Save explanations locally for future reference. Save explanations locally for future reference.
* **Customizable Settings**: Toggle auto-explain, adjust detail level, and manage API key.
* **Dark Theme UI**: Sleek glassmorphic cards with backdrop-blur and smooth micro-animations.
* **Light Theme UI (WOP)**: Alternative light theme with neutral backgrounds and soft accents.
* **Caching**: LRU cache in `chrome.storage.local` keyed by term+domain to reduce latency and cost.

---

## Tech Stack

* **Extension Framework**: Vanilla HTML, CSS, and JavaScript (Manifest V3).
* **AI Provider**: Google Gemini API (user-supplied API key).
* **Storage**: `chrome.storage.local` for settings, cache, and glossary.
* **Icons**: Font Awesome.

---

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/your-username/clarity-extension.git
   cd clarity-extension
   ```
2. Install dependencies (if using a build step):

   ```bash
   npm install
   ```
3. Load extension in Chrome:

   * Navigate to `chrome://extensions`
   * Enable **Developer mode**
   * Click **Load unpacked** and select the `clarity-extension` directory.

---

## Configuration

1. Open the extension popup and enter your Gemini API key in Settings.
2. Choose your default detail level (Simple or Detailed).
3. Toggle Auto-Explain on or off.

---

## Usage

1. Highlight any word, phrase, or question on a webpage.
2. Click the round button that appears above the selection.
3. The explanation card will fade and scale into view with a smooth animation.
4. To save an explanation, click the book icon on the card. Access saved entries via the Open Glossary button in the popup.

---

## UI/UX Principles

* **Dark Theme**: Base background `#262624`, primary accent `#c96442`, secondary accent `#8d8c85`.
* **Light Theme (WOP)**: Base background `#f5f5f5`, primary accent `#c96442`, secondary accent `#8d8c85`.
* **Typography**: 18 px headings, 14 px body, clean sans-serif font.
* **Glassmorphism**: `backdrop-filter: blur(8px)` on cards.
* **Micro-Animations**: Slide-in tooltip and button (150 ms or less), ease-out scale and fade for cards.

---

## Architecture Overview

```
content-script.js → background.js/service_worker → Gemini API
       ↓                       ↓
  UI Layer (tooltip + card)    Caching (LRU in storage)
                                      ↓
                              chrome.storage.local
```

* **content-script.js** handles text selection and injects UI elements.
* **background.js (service\_worker)** performs API calls, cache lookups, and rate-limit handling.
* **popup.html/js** provides settings, glossary management, and usage statistics.

---

## Checklist & Best Practices

* **Security**: Never sync API key to the cloud. Store only in `chrome.storage.local`.
* **Performance**: Debounce selection events, use LRU cache, minimize token usage by limiting context.
* **Accessibility**: Ensure contrast ratios for text, keyboard navigation for popup.
* **Testing**: Unit tests with Jest for core logic, manual QA for content scripts across sample sites.

---

## Publishing & Release

1. Update version in `manifest.json`.
2. Build (if applicable) and zip the extension folder.
3. Submit to Chrome Web Store with required icons and privacy policy.
4. Monitor usage analytics and user feedback.

---

## Contributing

Contributions are welcome! Please open issues or submit pull requests. See the CONTRIBUTING.md file for guidelines.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
