// Popup settings logic with Claude Local Bridge support
document.addEventListener('DOMContentLoaded', async () => {
  const providerEl = document.getElementById('provider');
  const modelEl = document.getElementById('model');
  const apiKeyEl = document.getElementById('apiKey');
  const keyLabel = document.getElementById('keyLabel');
  const groupModel = document.getElementById('group-model');
  const groupKey = document.getElementById('group-key');
  const infoClaudeLocal = document.getElementById('infoClaudeLocal');
  const infoGemini = document.getElementById('infoGemini');
  const bridgeStatus = document.getElementById('bridgeStatus');
  
  const featureNewsClean = document.getElementById('featureNewsClean');
  const featureNewsSummary = document.getElementById('featureNewsSummary');
  const featureChatCopilot = document.getElementById('featureChatCopilot');
  
  const btnSave = document.getElementById('btnSave');
  const btnTest = document.getElementById('btnTest');
  const statusBox = document.getElementById('statusBox');

  // Periksa apakah bridge lokal Claude sedang berjalan di port 3030
  async function checkBridge() {
    try {
      const res = await fetch('http://127.0.0.1:3030/health', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        bridgeStatus.innerHTML = '<span style="color:#16a34a;">🟢 Aktif & Siap Digunakan (Port 3030)</span>';
      } else {
        bridgeStatus.innerHTML = '<span style="color:#dc2626;">🔴 Error</span>';
      }
    } catch (_) {
      bridgeStatus.innerHTML = '<span style="color:#dc2626;">🔴 Belum Berjalan (Klik 2x start-bridge.bat)</span>';
    }
  }

  function updateView(prov) {
    if (prov === 'claude-local') {
      infoClaudeLocal.style.display = 'block';
      infoGemini.style.display = 'none';
      groupModel.style.display = 'none';
      groupKey.style.display = 'none';
      checkBridge();
    } else if (prov === 'gemini') {
      infoClaudeLocal.style.display = 'none';
      infoGemini.style.display = 'block';
      groupModel.style.display = 'flex';
      groupKey.style.display = 'flex';
      keyLabel.textContent = 'API Key Google AI Studio (Gratis)';
      apiKeyEl.placeholder = 'AIzaSy...';
    } else {
      infoClaudeLocal.style.display = 'none';
      infoGemini.style.display = 'none';
      groupModel.style.display = 'none';
      groupKey.style.display = 'flex';
      keyLabel.textContent = 'Anthropic Claude API Key';
      apiKeyEl.placeholder = 'sk-ant-...';
    }
  }

  // Load saved settings
  const stored = await chrome.storage.local.get([
    'provider', 'geminiKey', 'claudeKey',
    'geminiModel',
    'featureNewsClean', 'featureNewsSummary', 'featureChatCopilot'
  ]);

  const activeProvider = stored.provider || 'claude-local';
  providerEl.value = activeProvider;

  if (activeProvider === 'gemini') apiKeyEl.value = stored.geminiKey || '';
  else if (activeProvider === 'claude-api') apiKeyEl.value = stored.claudeKey || '';

  if (stored.geminiModel) modelEl.value = stored.geminiModel;

  if (stored.featureNewsClean !== undefined) featureNewsClean.checked = stored.featureNewsClean;
  if (stored.featureNewsSummary !== undefined) featureNewsSummary.checked = stored.featureNewsSummary;
  if (stored.featureChatCopilot !== undefined) featureChatCopilot.checked = stored.featureChatCopilot;

  updateView(activeProvider);

  providerEl.addEventListener('change', () => {
    updateView(providerEl.value);
  });

  // Save Settings
  btnSave.addEventListener('click', async () => {
    const prov = providerEl.value;
    const key = apiKeyEl.value.trim();

    const dataToSave = {
      provider: prov,
      geminiModel: modelEl.value,
      featureNewsClean: featureNewsClean.checked,
      featureNewsSummary: featureNewsSummary.checked,
      featureChatCopilot: featureChatCopilot.checked
    };

    if (prov === 'gemini') dataToSave.geminiKey = key;
    if (prov === 'claude-api') dataToSave.claudeKey = key;

    await chrome.storage.local.set(dataToSave);
    showStatus('✅ Pengaturan berhasil disimpan!', true);
    setTimeout(() => { hideStatus(); }, 3000);
  });

  // Test AI Connection
  btnTest.addEventListener('click', async () => {
    const prov = providerEl.value;
    const key = apiKeyEl.value.trim();

    if (prov !== 'claude-local' && !key) {
      showStatus('⚠️ Masukkan API Key terlebih dahulu sebelum mengetes.', false);
      return;
    }

    btnTest.disabled = true;
    btnTest.textContent = 'Menghubungi AI...';
    hideStatus();

    const testSettings = {
      provider: prov,
      apiKey: key,
      geminiModel: modelEl.value
    };

    chrome.runtime.sendMessage({
      action: 'GENERATE_AI',
      payload: {
        prompt: 'Balas hanya satu kata: "AKTIF"',
        systemPrompt: 'Jawab sangat singkat.',
        settings: testSettings
      }
    }, (response) => {
      btnTest.disabled = false;
      btnTest.textContent = '🧪 Tes Koneksi AI';

      if (response && response.success) {
        showStatus(`✅ Terhubung! Respons: "${response.text}"`, true);
      } else {
        showStatus(`❌ Gagal terhubung: ${response?.error || 'Tidak ada respons'}`, false);
      }
    });
  });

  function showStatus(msg, isSuccess) {
    statusBox.textContent = msg;
    statusBox.style.display = '';
    statusBox.className = 'status-box ' + (isSuccess ? 'status-success' : 'status-error');
  }

  function hideStatus() {
    statusBox.className = 'status-box';
    statusBox.style.display = 'none';
  }
});
