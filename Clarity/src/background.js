// LRU Cache implementation
class LRUCache {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }
}

// Global cache instance
const explanationCache = new LRUCache(200);

// SHA-256 hashing function
async function generateCacheKey(text, hostname) {
  const data = text + hostname;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get API key from storage
async function getApiKey() {
  try {
    const result = await chrome.storage.local.get(['GEMINI_KEY']);
    return result.GEMINI_KEY;
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
}

// Update usage statistics
async function updateStats() {
  try {
    const result = await chrome.storage.local.get(['numExplains', 'firstUse', 'lastUse']);
    const now = Date.now();
    
    const updatedStats = {
      numExplains: (result.numExplains || 0) + 1,
      lastUse: now,
      firstUse: result.firstUse || now
    };
    
    await chrome.storage.local.set(updatedStats);
    return updatedStats;
  } catch (error) {
    console.error('Error updating stats:', error);
    throw error;
  }
}

// Make API call to Gemini with streaming
async function callGeminiAPIStreaming(text, context, apiKey, onChunk, onComplete) {
  // Get detail level from storage
  const settings = await chrome.storage.local.get(['detailLevel']);
  const detailLevel = settings.detailLevel || 'brief';
  
  console.log('🔧 Detail level from storage:', detailLevel); // DEBUG
  
  // Create prompt based on detail level
  let prompt;
  switch (detailLevel) {
    case 'simple':
      prompt = `Explain in very simple terms, as if to a 12-year-old: "${text}"`;
      break;
    case 'brief':
      prompt = `Explain in 1–2 sentences: "${text}"`;
      break;
    case 'detailed':
      prompt = `Provide a comprehensive explanation with examples and context: "${text}"`;
      break;
    default:
      prompt = `Explain in 1–2 sentences: "${text}"`;
  }
  
  console.log('📝 Final prompt being sent:', prompt); // DEBUG
  
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  console.log('🔄 Starting streaming API call to Gemini...'); // DEBUG

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    console.log('📡 API Response status:', response.status, response.statusText); // DEBUG

    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error response:', errorText); // DEBUG
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    console.log('🌊 Starting to read stream...'); // DEBUG

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('✅ Stream completed. Processing any remaining data...'); // DEBUG
        // Process any remaining data in buffer
        if (buffer.trim()) {
          processBuffer(buffer, fullText, onChunk);
        }
        break;
      }
      
      const rawChunk = decoder.decode(value, { stream: true });
      console.log('📦 Raw chunk received:', rawChunk); // DEBUG
      
      buffer += rawChunk;
      
      // Process complete JSON objects as they arrive
      const result = processBuffer(buffer, fullText, onChunk);
      fullText = result.fullText;
      buffer = result.remainingBuffer;
    }

    function processBuffer(bufferData, currentFullText, chunkCallback) {
      let remaining = bufferData;
      let updatedFullText = currentFullText;
      
      // Look for complete JSON objects in the buffer
      // Handle both first object [{ and subsequent objects ,{
      let startPos = 0;
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = 0; i < remaining.length; i++) {
        const char = remaining[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            if (braceCount === 0) {
              startPos = i;
            }
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              // Found complete JSON object
              let jsonStr = remaining.substring(startPos, i + 1);
              console.log('🔍 Found complete JSON object:', jsonStr.substring(0, 100) + '...'); // DEBUG
              
              try {
                const jsonData = JSON.parse(jsonStr);
                console.log('✨ Parsed JSON successfully'); // DEBUG
                
                if (jsonData.candidates && jsonData.candidates[0] && jsonData.candidates[0].content) {
                  const parts = jsonData.candidates[0].content.parts;
                  if (parts && parts[0] && parts[0].text) {
                    const newText = parts[0].text;
                    console.log('🎯 Extracted text chunk:', newText); // DEBUG
                    updatedFullText += newText;
                    chunkCallback(newText, updatedFullText);
                  }
                }
              } catch (e) {
                console.log('❌ Could not parse JSON object:', e); // DEBUG
              }
              
              // Remove processed part from buffer
              remaining = remaining.substring(i + 1);
              i = -1; // Reset loop
              startPos = 0;
            }
          }
        }
      }
      
      return {
        fullText: updatedFullText,
        remainingBuffer: remaining
      };
    }
    
    console.log('🏁 Final fullText length:', fullText.length); // DEBUG
    onComplete(fullText);
    return fullText;
  } catch (error) {
    console.error('Gemini API streaming error:', error);
    throw error;
  }
}

// Fallback non-streaming API call
async function callGeminiAPI(text, context, apiKey) {
  // Get detail level from storage
  const settings = await chrome.storage.local.get(['detailLevel']);
  const detailLevel = settings.detailLevel || 'brief';
  
  console.log('🔧 Detail level from storage:', detailLevel); // DEBUG
  
  // Create prompt based on detail level
  let prompt;
  switch (detailLevel) {
    case 'simple':
      prompt = `Explain in very simple terms, as if to a 12-year-old: "${text}"`;
      break;
    case 'brief':
      prompt = `Explain in 1–2 sentences: "${text}"`;
      break;
    case 'detailed':
      prompt = `Provide a comprehensive explanation with examples and context: "${text}"`;
      break;
    default:
      prompt = `Explain in 1–2 sentences: "${text}"`;
  }
  
  console.log('📝 Final prompt being sent:', prompt); // DEBUG
  
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

// Handle explanation requests with streaming
async function handleExplainRequest(request, sender, sendResponse) {
  try {
    const { text, context, anchorRect } = request.payload;
    
    if (!text || !text.trim()) {
      throw new Error('No text provided for explanation');
    }

    // Check for API key
    const apiKey = await getApiKey();
    if (!apiKey) {
      sendResponse({
        type: 'EXPLANATION_ERROR',
        message: 'API key not found. Please add your Gemini API key in settings.',
        anchorRect
      });
      return;
    }

    // Generate cache key
    const hostname = sender.tab ? new URL(sender.tab.url).hostname : 'unknown';
    const cacheKey = await generateCacheKey(text, hostname);

    // Check cache first
    if (explanationCache.has(cacheKey)) {
      const cachedExplanation = explanationCache.get(cacheKey);
      await updateStats();
      
      sendResponse({
        type: 'EXPLANATION_READY',
        text: cachedExplanation,
        anchorRect,
        isComplete: true
      });
      return;
    }

    // Send initial loading response
    sendResponse({
      type: 'EXPLANATION_LOADING',
      anchorRect
    });

    // Try streaming first, fallback to non-streaming if it fails
    try {
      await callGeminiAPIStreaming(
        text, 
        context, 
        apiKey,
        // onChunk callback
        (chunk, fullText) => {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'EXPLANATION_CHUNK',
            chunk,
            fullText,
            anchorRect
          });
        },
        // onComplete callback
        async (fullText) => {
          console.log('🎉 Streaming completed with text length:', fullText.length); // DEBUG
          
          // If streaming returned empty text, try non-streaming as fallback
          if (!fullText || fullText.trim().length === 0) {
            console.log('⚠️ Streaming returned empty text, trying non-streaming fallback...'); // DEBUG
            try {
              const nonStreamingResult = await callGeminiAPI(text, context, apiKey);
              console.log('✅ Non-streaming fallback successful:', nonStreamingResult.length); // DEBUG
              
              // Cache the result
              explanationCache.set(cacheKey, nonStreamingResult);
              
              // Update stats
              await updateStats();
              
              chrome.tabs.sendMessage(sender.tab.id, {
                type: 'EXPLANATION_COMPLETE',
                text: nonStreamingResult,
                anchorRect
              });
            } catch (fallbackError) {
              console.error('❌ Non-streaming fallback also failed:', fallbackError); // DEBUG
              throw fallbackError;
            }
          } else {
            // Cache the result
            explanationCache.set(cacheKey, fullText);
            
            // Update stats
            await updateStats();
            
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'EXPLANATION_COMPLETE',
              text: fullText,
              anchorRect
            });
          }
        }
      );
    } catch (streamingError) {
      console.error('❌ Streaming failed, trying non-streaming fallback:', streamingError); // DEBUG
      
      // Fallback to non-streaming
      const nonStreamingResult = await callGeminiAPI(text, context, apiKey);
      
      // Cache the result
      explanationCache.set(cacheKey, nonStreamingResult);
      
      // Update stats
      await updateStats();
      
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'EXPLANATION_COMPLETE',
        text: nonStreamingResult,
        anchorRect
      });
    }

  } catch (error) {
    console.error('Error handling explain request:', error);
    
    let errorMessage = 'An error occurred while getting explanation';
    
    if (error.message === 'RATE_LIMIT') {
      errorMessage = 'Rate limit exceeded. Please try again later.';
    } else if (error.message.includes('API key')) {
      errorMessage = 'Invalid API key. Please check your settings.';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection.';
    }

    sendResponse({
      type: 'EXPLANATION_ERROR',
      message: errorMessage,
      anchorRect: request.payload.anchorRect
    });
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🎧 Background received message:', request); // DEBUG
  
  if (request.type === 'EXPLAIN') {
    console.log('✅ Processing EXPLAIN request'); // DEBUG
    handleExplainRequest(request, sender, sendResponse);
    return true; // Keep message channel open for async response
  } else {
    console.log('❓ Unknown message type:', request.type); // DEBUG
  }
});

// Service worker lifecycle
self.addEventListener('install', () => {
  console.log('Clarity background service worker installed');
});

self.addEventListener('activate', () => {
  console.log('Clarity background service worker activated');
});