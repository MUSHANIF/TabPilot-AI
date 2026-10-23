// Background Service Worker: AI Gateway for Claude Local Login & Gemini
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GENERATE_AI') {
    handleAIGenerate(request.payload)
      .then((data) => sendResponse({ success: true, text: data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep async channel open
  }

  if (request.action === 'FETCH_PAGE_RAW') {
    fetch(request.url)
      .then(res => res.text())
      .then(html => sendResponse({ success: true, html }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleAIGenerate({ prompt, systemPrompt, settings }) {
  const provider = settings?.provider || 'claude-local';

  // 1. Mode Claude yang sudah login di laptop (Tanpa API Key!)
  if (provider === 'claude-local') {
    return await callClaudeLocalBridge(prompt, systemPrompt, settings?.bridgeEndpoint || 'http://127.0.0.1:3030/generate');
  }

  // 2. Mode Google AI / Gemini API
  if (provider === 'gemini') {
    const apiKey = settings?.apiKey?.trim();
    if (!apiKey) {
      throw new Error('API Key Google AI Studio belum diisi. Anda bisa mengambilnya secara gratis di aistudio.google.com tanpa kartu kredit.');
    }
    return await callGemini(prompt, systemPrompt, apiKey, settings?.geminiModel || 'gemini-2.5-flash');
  }

  // 3. Mode Claude API manual
  if (provider === 'claude-api') {
    const apiKey = settings?.apiKey?.trim();
    if (!apiKey) {
      throw new Error('API Key Claude belum diisi.');
    }
    return await callClaudeAPI(prompt, systemPrompt, apiKey, settings?.claudeModel || 'claude-3-5-haiku-20241022');
  }

  throw new Error(`Provider AI tidak dikenal: ${provider}`);
}

// 1. Panggil Local Bridge (Claude Code yang sudah login di laptop user)
async function callClaudeLocalBridge(prompt, systemPrompt, endpoint) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemPrompt })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data.text?.trim() || 'Respons kosong dari Claude.';
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('ECONNREFUSED')) {
      throw new Error('Local Bridge belum berjalan. Silakan jalankan file "start-bridge.bat" di folder personal-ai-browser-tools untuk mengaktifkan Claude.');
    }
    throw err;
  }
}

// 2. Google Gemini (Google AI Studio)
async function callGemini(prompt, systemPrompt, apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini API error (Status ${res.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('')?.trim();
  if (!text) throw new Error('Gemini mengembalikan respons kosong.');
  return text;
}

// 3. Anthropic Claude Direct API
async function callClaudeAPI(prompt, systemPrompt, apiKey, model) {
  const url = 'https://api.anthropic.com/v1/messages';
  const body = {
    model: model,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Claude API error (Status ${res.status})`);
  }

  const text = data.content?.map(c => c.text).join('')?.trim();
  if (!text) throw new Error('Claude mengembalikan respons kosong.');
  return text;
}
