// Content Script: News Cleaner, Reader Mode & AI Summarizer

(async function () {
  // Hanya aktifkan jika berada di dokumen HTML biasa
  if (!document.body || document.contentType !== 'text/html') return;

  const host = window.location.hostname.toLowerCase();

  // DAFTAR HOST NON-BERITA: Jangan pernah aktif di aplikasi chat, sosmed, email, atau tools kerja
  const nonNewsHosts = [
    'whatsapp.com', 'telegram.org', 'slack.com', 'discord.com',
    'messenger.com', 'instagram.com', 'facebook.com', 'mail.google.com',
    'gmail.com', 'twitter.com', 'x.com', 'github.com', 'youtube.com',
    'linkedin.com', 'notion.so', 'figma.com', 'trello.com', 'drive.google.com'
  ];
  if (nonNewsHosts.some(h => host.includes(h))) {
    return; // Berhenti total
  }

  // Baca pengaturan pengguna
  const settings = await chrome.storage.local.get([
    'provider', 'geminiKey', 'claudeKey', 'customKey',
    'geminiModel', 'claudeModel', 'customEndpoint',
    'featureNewsClean', 'featureNewsSummary'
  ]);

  const cleanEnabled = settings.featureNewsClean !== false;
  const summaryEnabled = settings.featureNewsSummary !== false;

  // 1. AD KILLER: Pembersih Iklan & Elemen Pengganggu
  if (cleanEnabled) {
    purgeNewsAds();
    // Pantau elemen iklan dinamis yang baru disisipkan via JavaScript
    const adObserver = new MutationObserver(() => {
      purgeNewsAds();
    });
    adObserver.observe(document.body, { childList: true, subtree: true });
  }

  // 2. WIDGET FLOATING: Pasang jika fitur rangkuman atau reader mode aktif
  if (summaryEnabled || cleanEnabled) {
    // Beri sedikit jeda agar DOM utama selesai dimuat
    setTimeout(initNewsWidget, 1200);
  }

  function purgeNewsAds() {
    const adSelectors = [
      'iframe[id*="google_ads"]',
      'iframe[src*="doubleclick"]',
      'div[id*="div-gpt-ad"]',
      '.ads-wrapper', '.ad-banner', '.banner-sticky', '.adsbox',
      '.flying-ads', '.parallax-ads', '[data-ad-slot]', '.sticky-ads',
      '.banner-bottom', '.ads_container', '.ads-widget',
      '.ads-on-content', '.ads-top', '.banner__wrap', '.kcm-ads',
      '[class*="AdvertisementWrapper"]', '.ads-middle', '.ads-placeholder',
      '#banner_sticky', '.advertisement', '.native-ads'
    ];

    try {
      const ads = document.querySelectorAll(adSelectors.join(','));
      ads.forEach(el => {
        el.style.display = 'none';
        el.remove();
      });
    } catch (_) {}
  }

  function getArticleData() {
    const title = document.querySelector('h1')?.innerText?.trim() || document.title;

    // Selector artikel umum & media nasional Indonesia
    const contentSelectors = [
      '.detail__body-text',       // Detik
      '.itp_bodycontent',         // Detik
      '.read__content',           // Kompas
      '.kcm-read-text',           // Kompas
      '.detail-text',             // CNN Indonesia & CNBC
      '[data-qa-id="story-body"]',// Kumparan
      '.detail-konten',           // Tempo
      '.article-content',
      'article',
      '[itemprop="articleBody"]'
    ];

    let bodyText = '';
    for (const sel of contentSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        // Kloning untuk membersihkan script/style internal
        const clone = el.cloneNode(true);
        clone.querySelectorAll('script, style, noscript, .ads, .baca-juga, [class*="ads"]').forEach(e => e.remove());
        const txt = clone.innerText?.trim();
        if (txt && txt.length > 200) {
          bodyText = txt;
          break;
        }
      }
    }

    // Fallback jika selector spesifik tidak ketemu: ambil semua paragraf di main/body
    if (!bodyText) {
      const pElements = Array.from(document.querySelectorAll('article p, main p, body p'))
        .map(p => p.innerText.trim())
        .filter(t => t.length > 50 && !t.includes('Copyright') && !t.includes('Dilarang'));
      bodyText = pElements.join('\n\n');
    }

    return { title, bodyText: bodyText.slice(0, 10000) };
  }

  function initNewsWidget() {
    if (document.getElementById('personal-news-ai-widget')) return;

    // Pastikan halaman ini memang artikel berita/tulisan panjang sebelum memunculkan widget
    const isNewsSite = [
      'detik.com', 'kompas.com', 'kumparan.com', 'cnnindonesia.com',
      'tempo.co', 'tribunnews.com', 'liputan6.com', 'suara.com',
      'merdeka.com', 'idntimes.com', 'cnbcindonesia.com', 'medium.com'
    ].some(d => host.includes(d));

    const article = getArticleData();
    // Jika bukan portal berita dan tidak ada konten artikel yang layak (> 350 karakter), jangan tampilkan widget
    if (!isNewsSite && (!article.bodyText || article.bodyText.length < 350)) {
      return;
    }

    const widget = document.createElement('div');
    widget.id = 'personal-news-ai-widget';
    widget.innerHTML = `
      <button class="p-news-btn" id="btnToggleReader" title="Baca artikel tanpa iklan dan format nyaman">
        <span>📖</span> Mode Bersih
      </button>
      <button class="p-news-btn p-news-btn-primary" id="btnSummarizeNews" title="Rangkum artikel dengan AI">
        <span>⚡</span> Rangkum AI
      </button>
      <button class="p-news-btn-close" id="btnDismissNewsWidget" title="Sembunyikan widget">&times;</button>
    `;

    document.body.appendChild(widget);

    // Event Mode Baca Bersih
    document.getElementById('btnToggleReader').addEventListener('click', toggleReaderMode);

    // Event Rangkum Berita
    document.getElementById('btnSummarizeNews').addEventListener('click', triggerSummarize);

    // Event Tutup/Dismiss Widget
    document.getElementById('btnDismissNewsWidget').addEventListener('click', () => {
      widget.remove();
    });
  }

  function toggleReaderMode() {
    let reader = document.getElementById('personal-reader-container');
    if (!reader) {
      const data = getArticleData();
      reader = document.createElement('div');
      reader.id = 'personal-reader-container';
      reader.innerHTML = `
        <button class="p-reader-close-btn" id="btnCloseReader">✕ Tutup Mode Bersih</button>
        <div class="p-reader-content">
          <h1>${escapeHtml(data.title)}</h1>
          <div class="p-reader-meta">Sumber: ${window.location.hostname} · Mode Baca Bebas Iklan</div>
          <div>${data.bodyText.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>
        </div>
      `;
      document.body.appendChild(reader);
      document.getElementById('btnCloseReader').addEventListener('click', () => {
        reader.classList.remove('active');
      });
    }

    reader.classList.toggle('active');
  }

  async function triggerSummarize() {
    const data = getArticleData();
    if (!data.bodyText || data.bodyText.length < 100) {
      alert('Tidak menemukan konten teks artikel yang cukup di halaman ini.');
      return;
    }

    // Tampilkan Modal Loading
    showSummaryModal(data.title, '<em>⏳ Sedang membaca dan merangkum berita dengan AI...</em>', true);

    const activeSettings = await chrome.storage.local.get([
      'provider', 'geminiKey', 'claudeKey',
      'geminiModel'
    ]);

    const prov = activeSettings.provider || 'claude-local';
    const activeKey = prov === 'claude-api' ? activeSettings.claudeKey : activeSettings.geminiKey;

    if (prov !== 'claude-local' && !activeKey) {
      showSummaryModal(
        data.title,
        '<p style="color: #b91c1c;">⚠️ <strong>API Key Belum Disetel.</strong></p>' +
        '<p>Buka icon ekstensi di pojok kanan atas browser dan pilih mode <strong>Claude Code (Login Lokal)</strong> yang tanpa API key, atau masukkan API key Google Gemini gratis.</p>'
      );
      return;
    }

    const systemPrompt = 'Anda adalah asisten jurnalis cerdas berbahasa Indonesia. Rangkum artikel berita secara padat, akurat, netral, dan mudah dipahami dalam 30 detik.';
    const userPrompt = `Tolong rangkum artikel berita berikut ini:\n\nJUDUL: ${data.title}\n\nISI BERITA:\n${data.bodyText}\n\nFormat jawaban dalam HTML sederhana:\n<h4>📌 TL;DR (Ringkasan 1 Kalimat)</h4>\n<p>...</p>\n<h4>🔑 Poin-Poin Utama</h4>\n<ul>\n<li>...</li>\n<li>...</li>\n<li>...</li>\n</ul>\n<h4>💡 Konteks / Dampak</h4>\n<p>...</p>`;

    activeArticleContext = data;

    chrome.runtime.sendMessage({
      action: 'GENERATE_AI',
      payload: {
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        settings: {
          provider: prov,
          apiKey: activeKey,
          geminiModel: activeSettings.geminiModel || 'gemini-2.5-flash'
        }
      }
    }, (response) => {
      if (response && response.success) {
        showSummaryModal(data.title, response.text, false);
      } else {
        showSummaryModal(data.title, `<p style="color: #b91c1c;">❌ <strong>Gagal membuat rangkuman:</strong><br>${response?.error || 'Koneksi error'}</p>`, false);
      }
    });
  }

  let activeArticleContext = null;

  function showSummaryModal(title, contentHtml, isLoading = false) {
    let overlay = document.getElementById('personal-news-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'personal-news-modal-overlay';
      overlay.innerHTML = `
        <div id="personal-news-modal-card">
          <div class="p-modal-header">
            <h3><span>⚡</span> Rangkuman & Tanya Berita AI</h3>
            <button class="p-modal-close" id="btnModalClose">&times;</button>
          </div>
          <div class="p-modal-body">
            <div id="modalSummaryBody"></div>
            
            <!-- Section Tanya Jawab Interaktif -->
            <div class="p-qa-section" id="newsQaSection" style="display: none;">
              <div class="p-qa-section-title">
                <span>💬</span> Tanya Lebih Lanjut Seputar Berita Ini
              </div>
              <div class="p-chip-list">
                <button type="button" class="p-chip" data-q="Siapa saja pihak yang terlibat dalam peristiwa ini?">Siapa yang terlibat?</button>
                <button type="button" class="p-chip" data-q="Kapan dan di mana kejadian ini berlangsung?">Kapan & di mana?</button>
                <button type="button" class="p-chip" data-q="Berapa angka/nominal data statistik atau kerugian utamanya?">Data / Angka utama?</button>
                <button type="button" class="p-chip" data-q="Jelaskan intisari berita ini dengan bahasa sederhana seperti untuk anak 10 tahun.">Jelaskan sederhana</button>
              </div>
              <div class="p-qa-list" id="pNewsQaList"></div>
              <form class="p-qa-input-bar" id="pNewsQaForm">
                <input type="text" class="p-qa-input" id="pNewsQaInput" placeholder="Ketik pertanyaan Anda tentang artikel ini... (tekan Enter)" autocomplete="off">
                <button type="submit" class="p-qa-send-btn" id="pNewsQaBtn">Kirim</button>
              </form>
            </div>
          </div>
          <div class="p-modal-footer">
            <button class="p-news-btn p-news-btn-primary" id="btnCopySummary" style="color:#fff;">📋 Salin Rangkuman</button>
            <button class="p-news-btn" id="btnDismissModal" style="background:#e2e8f0; color:#334155;">Tutup</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('btnModalClose').onclick = () => overlay.remove();
      document.getElementById('btnDismissModal').onclick = () => overlay.remove();
      document.getElementById('btnCopySummary').onclick = () => {
        const text = document.getElementById('modalSummaryBody').innerText;
        navigator.clipboard.writeText(text);
        alert('Rangkuman berhasil disalin ke clipboard!');
      };
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
      };

      // Inisialisasi Event Q&A
      const qaForm = document.getElementById('pNewsQaForm');
      const qaInput = document.getElementById('pNewsQaInput');
      const qaBtn = document.getElementById('pNewsQaBtn');
      const qaList = document.getElementById('pNewsQaList');

      // Event klik saran pertanyaan (chips)
      overlay.querySelectorAll('.p-chip').forEach(chip => {
        chip.onclick = () => {
          qaInput.value = chip.getAttribute('data-q');
          qaForm.dispatchEvent(new Event('submit'));
        };
      });

      // Submit pertanyaan
      qaForm.onsubmit = async (e) => {
        e.preventDefault();
        const q = qaInput.value.trim();
        if (!q || !activeArticleContext) return;

        qaInput.value = '';
        qaBtn.disabled = true;
        qaBtn.textContent = '...';

        // Tambah bubble pertanyaan user
        const userBubble = document.createElement('div');
        userBubble.className = 'p-qa-bubble p-qa-bubble-user';
        userBubble.textContent = q;
        qaList.appendChild(userBubble);

        // Tambah bubble loading AI
        const aiBubble = document.createElement('div');
        aiBubble.className = 'p-qa-bubble p-qa-bubble-ai';
        aiBubble.innerHTML = '<em>⏳ Sedang mencari jawaban dari isi artikel...</em>';
        qaList.appendChild(aiBubble);
        qaList.scrollTop = qaList.scrollHeight;

        const activeSettings = await chrome.storage.local.get([
          'provider', 'geminiKey', 'claudeKey',
          'geminiModel'
        ]);
        const prov = activeSettings.provider || 'claude-local';
        const activeKey = prov === 'claude-api' ? activeSettings.claudeKey : activeSettings.geminiKey;

        const systemPrompt = 'Anda adalah asisten cerdas yang menjawab pertanyaan pembaca secara akurat, lugas, padat, dan langsung ke intinya berdasarkan teks artikel berita yang diberikan. Jawab dalam 1-3 paragraf ringkas dalam Bahasa Indonesia.';
        const userPrompt = `Artikel:\nJUDUL: ${activeArticleContext.title}\nISI BERITA:\n${activeArticleContext.bodyText.slice(0, 7000)}\n\nPertanyaan Pembaca: ${q}\n\nJawab berdasarkan fakta di artikel di atas:`;

        chrome.runtime.sendMessage({
          action: 'GENERATE_AI',
          payload: {
            prompt: userPrompt,
            systemPrompt: systemPrompt,
            settings: {
              provider: prov,
              apiKey: activeKey,
              geminiModel: activeSettings.geminiModel || 'gemini-2.5-flash'
            }
          }
        }, (res) => {
          qaBtn.disabled = false;
          qaBtn.textContent = 'Kirim';

          if (res && res.success) {
            aiBubble.innerHTML = res.text.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
          } else {
            aiBubble.innerHTML = `<span style="color:#b91c1c;">Gagal mendapatkan jawaban: ${res?.error || 'Error'}</span>`;
          }
          qaList.scrollTop = qaList.scrollHeight;
        });
      };
    }

    const bodyEl = document.getElementById('modalSummaryBody');
    bodyEl.innerHTML = `<h3 style="font-size:15px; margin-bottom:12px; color:#1e293b;">${escapeHtml(title)}</h3>` + contentHtml;

    // Munculkan bagian Q&A setelah rangkuman selesai dimuat
    const qaSection = document.getElementById('newsQaSection');
    if (qaSection) {
      qaSection.style.display = isLoading ? 'none' : 'block';
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
})();
