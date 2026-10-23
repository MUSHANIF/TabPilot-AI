// Content Script: Chat Copilot (WhatsApp Web & Telegram Web)

(function () {
  let isPanelOpen = false;

  // Tunggu sampai antarmuka WhatsApp / Telegram termuat
  const initInterval = setInterval(() => {
    if (document.body) {
      clearInterval(initInterval);
      initChatCopilotTrigger();
    }
  }, 1500);

  function initChatCopilotTrigger() {
    if (document.getElementById('personal-chat-copilot-trigger')) return;

    const trigger = document.createElement('div');
    trigger.id = 'personal-chat-copilot-trigger';

    const isMini = localStorage.getItem('tabpilot_copilot_mini') === 'true';
    if (isMini) {
      trigger.classList.add('is-mini');
    }

    trigger.innerHTML = `
      <div class="p-copilot-drag-handle" title="Tahan dan geser untuk memindahkan posisi">⋮⋮</div>
      <div class="p-copilot-main-btn" id="pBtnOpenPanel" title="Buka Asisten Chat AI">
        <span class="p-copilot-icon">🤖</span>
        <span class="p-copilot-label">Copilot AI</span>
      </div>
      <button type="button" class="p-copilot-mini-toggle" id="pBtnToggleMini" title="Perkecil ke ikon / sembunyikan label">&ndash;</button>
    `;

    document.body.appendChild(trigger);

    // Aktifkan draggable
    const didDrag = makeDraggable(trigger, 'tabpilot_chat_pos');

    // Click handler
    trigger.addEventListener('click', (e) => {
      if (didDrag()) return; // Jika baru saja digeser/drag, jangan toggle

      // Jika klik tombol minimize/expand
      if (e.target.closest('#pBtnToggleMini')) {
        e.stopPropagation();
        trigger.classList.add('is-mini');
        localStorage.setItem('tabpilot_copilot_mini', 'true');
        return;
      }

      // Jika sedang mini, klik di mana saja pada badge akan membuka panel
      if (trigger.classList.contains('is-mini')) {
        toggleCopilotPanel();
        return;
      }

      // Mode normal: buka/tutup panel
      if (e.target.closest('#pBtnOpenPanel') || e.target === trigger) {
        toggleCopilotPanel();
      }
    });

    // Double-click pada ikon mini mengembalikannya ke tampilan penuh
    trigger.addEventListener('dblclick', () => {
      if (trigger.classList.contains('is-mini')) {
        trigger.classList.remove('is-mini');
        localStorage.setItem('tabpilot_copilot_mini', 'false');
      }
    });
  }

  // Fungsi helper membuat elemen bisa digeser (draggable) & mengingat posisi
  function makeDraggable(element, storageKey) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let moved = false;

    // Pulihkan posisi tersimpan jika ada
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const pos = JSON.parse(saved);
        const maxLeft = Math.max(10, window.innerWidth - 60);
        const maxTop = Math.max(10, window.innerHeight - 60);
        const left = Math.min(Math.max(10, pos.left), maxLeft);
        const top = Math.min(Math.max(10, pos.top), maxTop);
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
      }
    } catch (_) {}

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Hanya klik kiri
      if (e.target.closest('#pBtnToggleMini')) return;

      isDragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = element.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          moved = true;
          element.classList.add('is-dragging');
        }

        if (moved) {
          let newLeft = startLeft + dx;
          let newTop = startTop + dy;

          const maxLeft = window.innerWidth - element.offsetWidth - 10;
          const maxTop = window.innerHeight - element.offsetHeight - 10;
          newLeft = Math.max(10, Math.min(newLeft, maxLeft));
          newTop = Math.max(10, Math.min(newTop, maxTop));

          element.style.left = `${newLeft}px`;
          element.style.top = `${newTop}px`;
          element.style.right = 'auto';
          element.style.bottom = 'auto';
        }
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        setTimeout(() => {
          element.classList.remove('is-dragging');
        }, 50);

        if (moved) {
          const rect = element.getBoundingClientRect();
          try {
            localStorage.setItem(storageKey, JSON.stringify({ left: rect.left, top: rect.top }));
          } catch (_) {}
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    return () => moved;
  }

  function toggleCopilotPanel() {
    let panel = document.getElementById('personal-chat-copilot-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'personal-chat-copilot-panel';
      panel.innerHTML = `
        <div class="p-copilot-header">
          <h3><span>💬</span> Asisten Chat AI</h3>
          <button class="p-copilot-close" id="pBtnCloseCopilot" title="Tutup (Esc)">&times;</button>
        </div>
        <div class="p-copilot-body">
          <div class="p-copilot-actions">
            <button class="p-action-btn p-action-btn-outline" id="pBtnSummarizeChat">
              <span>⚡</span> Rangkum Obrolan
            </button>
            <button class="p-action-btn p-action-btn-primary" id="pBtnGenerateReplies">
              <span>✍️</span> 3 Opsi Balasan
            </button>
          </div>

          <!-- Section Tanya & Instruksi Khusus -->
          <div class="p-chat-qa-container">
            <div class="p-chat-qa-label">
              <span>💡</span> Tanya Chat / Minta Balasan Khusus:
            </div>
            <div class="p-chat-chip-list">
              <button type="button" class="p-chat-chip" data-cmd="Tolak dengan halus dan sopan karena jadwal sedang padat">Tolak halus</button>
              <button type="button" class="p-chat-chip" data-cmd="Minta jadwalkan ulang ke lusa jam 2 siang">Jadwalkan ulang</button>
              <button type="button" class="p-chat-chip" data-cmd="Tanyakan apa poin utama dan detail permintaannya">Tanya maksudnya</button>
              <button type="button" class="p-chat-chip" data-cmd="Katakan bahwa saya setuju dan tanyakan langkah selanjutnya">Setuju & lanjut</button>
            </div>
            <form class="p-chat-input-bar" id="pChatQaForm">
              <input type="text" class="p-chat-input" id="pChatQaInput" placeholder="Ketik pertanyaan / instruksi balasan... (Enter)" autocomplete="off">
              <button type="submit" class="p-chat-send-btn" id="pChatQaBtn">Kirim</button>
            </form>
          </div>

          <div id="pCopilotOutputArea">
            <div class="p-summary-box" style="text-align: center; color: #64748b;">
              Buka salah satu ruang obrolan (chat), lalu pilih tombol di atas atau ketik pertanyaan/arahan balasan.
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(panel);

      document.getElementById('pBtnCloseCopilot').onclick = () => {
        panel.style.display = 'none';
        isPanelOpen = false;
      };

      // Keyboard Esc untuk menutup panel
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isPanelOpen) {
          panel.style.display = 'none';
          isPanelOpen = false;
        }
      });

      document.getElementById('pBtnSummarizeChat').onclick = handleSummarizeChat;
      document.getElementById('pBtnGenerateReplies').onclick = handleGenerateReplies;

      // Inisialisasi Q&A / Instruksi Khusus
      const qaForm = document.getElementById('pChatQaForm');
      const qaInput = document.getElementById('pChatQaInput');
      const qaBtn = document.getElementById('pChatQaBtn');

      panel.querySelectorAll('.p-chat-chip').forEach(chip => {
        chip.onclick = () => {
          qaInput.value = chip.getAttribute('data-cmd');
          qaForm.dispatchEvent(new Event('submit'));
        };
      });

      qaForm.onsubmit = (e) => {
        e.preventDefault();
        const q = qaInput.value.trim();
        if (!q) return;
        qaInput.value = '';
        handleCustomChatQuery(q);
      };
    }

    isPanelOpen = !isPanelOpen;
    panel.style.display = isPanelOpen ? 'flex' : 'none';
  }

  // Ekstraksi 10-15 pesan terakhir dari DOM chat aktif
  function extractActiveChatMessages() {
    const messages = [];

    // 1. Selector WhatsApp Web
    const waBubbles = document.querySelectorAll('div[data-testid="msg-container"], div.message-in, div.message-out');
    if (waBubbles && waBubbles.length > 0) {
      // Ambil hingga 15 pesan terakhir
      const slice = Array.from(waBubbles).slice(-15);
      slice.forEach(bubble => {
        const isMe = bubble.classList.contains('message-out') || !!bubble.closest('.message-out');
        const textEl = bubble.querySelector('.selectable-text.copyable-text, span[dir="ltr"]');
        const text = textEl?.innerText?.trim();
        if (text) {
          messages.push({
            sender: isMe ? 'Saya' : 'Lawan Bicara',
            text: text
          });
        }
      });
      return messages;
    }

    // 2. Selector Telegram Web (K/A/Z version)
    const tgBubbles = document.querySelectorAll('.message-list-item, .bubble, .Message');
    if (tgBubbles && tgBubbles.length > 0) {
      const slice = Array.from(tgBubbles).slice(-15);
      slice.forEach(bubble => {
        const isMe = bubble.classList.contains('is-out') || bubble.classList.contains('own');
        const textEl = bubble.querySelector('.text-content, .message, .message-content');
        const text = textEl?.innerText?.trim();
        if (text) {
          messages.push({
            sender: isMe ? 'Saya' : 'Lawan Bicara',
            text: text
          });
        }
      });
      return messages;
    }

    // Fallback generik jika ada teks percakapan terlihat
    return messages;
  }

  function formatConversationForAI(msgs) {
    return msgs.map(m => `${m.sender}: ${m.text}`).join('\n');
  }

  async function getActiveSettings() {
    const s = await chrome.storage.local.get([
      'provider', 'geminiKey', 'claudeKey',
      'geminiModel'
    ]);
    const prov = s.provider || 'claude-local';
    const key = prov === 'claude-api' ? s.claudeKey : s.geminiKey;
    return {
      provider: prov,
      apiKey: key,
      geminiModel: s.geminiModel || 'gemini-2.5-flash'
    };
  }

  async function handleSummarizeChat() {
    const msgs = extractActiveChatMessages();
    const outputArea = document.getElementById('pCopilotOutputArea');

    if (!msgs || msgs.length === 0) {
      outputArea.innerHTML = `<div class="p-summary-box" style="color: #b91c1c;">⚠️ Tidak menemukan riwayat chat aktif. Pastikan Anda sedang membuka salah satu percakapan chat.</div>`;
      return;
    }

    outputArea.innerHTML = `<div class="p-summary-box"><em>⏳ AI sedang membaca ${msgs.length} pesan terakhir dan merangkum...</em></div>`;

    const settings = await getActiveSettings();
    if (settings.provider !== 'claude-local' && !settings.apiKey) {
      outputArea.innerHTML = `<div class="p-summary-box" style="color:#b91c1c;">⚠️ API Key untuk <strong>${settings.provider.toUpperCase()}</strong> belum disetel. Buka popup ekstensi untuk memasukkan key, atau gunakan mode <strong>Claude Code (Login Lokal)</strong>.</div>`;
      return;
    }

    const conversationText = formatConversationForAI(msgs);
    const systemPrompt = 'Anda adalah asisten manajemen komunikasi pribadi. Analisis riwayat percakapan dan buat rangkuman yang padat, akurat, dan menyorot poin yang membutuhkan tindakan dalam Bahasa Indonesia.';
    const prompt = `Berikut adalah riwayat percakapan chat terakhir:\n\n${conversationText}\n\nBuat rangkuman dalam 2-3 kalimat mencakup:\n1. Topik utama yang dibahas\n2. Status terakhir (siapa yang sedang menunggu balasan/keputusan apa).`;

    chrome.runtime.sendMessage({
      action: 'GENERATE_AI',
      payload: { prompt, systemPrompt, settings }
    }, (res) => {
      if (res && res.success) {
        outputArea.innerHTML = `
          <div class="p-summary-box">
            <strong style="display:block; margin-bottom:6px; color:#1e293b;">📌 Rangkuman Obrolan:</strong>
            <p style="margin:0; line-height:1.6;">${escapeHtml(res.text)}</p>
          </div>
        `;
      } else {
        outputArea.innerHTML = `<div class="p-summary-box" style="color:#b91c1c;">❌ Gagal merangkum: ${res?.error || 'Error'}</div>`;
      }
    });
  }

  async function handleGenerateReplies() {
    const msgs = extractActiveChatMessages();
    const outputArea = document.getElementById('pCopilotOutputArea');

    if (!msgs || msgs.length === 0) {
      outputArea.innerHTML = `<div class="p-summary-box" style="color: #b91c1c;">⚠️ Tidak menemukan riwayat chat aktif. Pastikan Anda sedang membuka salah satu percakapan chat.</div>`;
      return;
    }

    outputArea.innerHTML = `<div class="p-summary-box"><em>⏳ Menganalisis obrolan dan merancang 3 varian balasan...</em></div>`;

    const settings = await getActiveSettings();
    if (settings.provider !== 'claude-local' && !settings.apiKey) {
      outputArea.innerHTML = `<div class="p-summary-box" style="color:#b91c1c;">⚠️ API Key untuk <strong>${settings.provider.toUpperCase()}</strong> belum disetel. Buka popup ekstensi untuk memasukkan key, atau gunakan mode <strong>Claude Code (Login Lokal)</strong>.</div>`;
      return;
    }

    const conversationText = formatConversationForAI(msgs);
    const systemPrompt = `Anda adalah asisten korespondensi cerdas dalam Bahasa Indonesia.
Tugas Anda: Berikan TEPAT 3 opsi draf balasan pesan yang cocok dikirim oleh 'Saya' untuk merespons pesan lawan bicara.
Format respons HARUS berupa objek JSON valid dengan 3 keys persis:
{
  "formal": "Teks balasan bahasa Indonesia yang sopan, formal, santun, cocok untuk rekan kerja/klien/atasan.",
  "casual": "Teks balasan santai, ramah, bersahabat, cocok untuk teman dekat atau obrolan santai.",
  "direct": "Teks balasan ringkas, to-the-point, jelas tanpa basa-basi."
}
PENTING: Hanya keluarkan JSON murni tanpa markdown wrapper.`;

    const prompt = `Riwayat percakapan:\n\n${conversationText}\n\nBuat 3 varian balasan untuk 'Saya':`;

    chrome.runtime.sendMessage({
      action: 'GENERATE_AI',
      payload: { prompt, systemPrompt, settings }
    }, (res) => {
      if (res && res.success) {
        renderReplies(res.text);
      } else {
        outputArea.innerHTML = `<div class="p-summary-box" style="color:#b91c1c;">❌ Gagal membuat balasan: ${res?.error || 'Error'}</div>`;
      }
    });
  }

  async function handleCustomChatQuery(query) {
    const msgs = extractActiveChatMessages();
    const outputArea = document.getElementById('pCopilotOutputArea');
    const qaBtn = document.getElementById('pChatQaBtn');

    if (!msgs || msgs.length === 0) {
      outputArea.innerHTML = `<div class="p-summary-box" style="color: #b91c1c;">⚠️ Tidak menemukan obrolan aktif. Buka salah satu chat terlebih dahulu.</div>`;
      return;
    }

    if (qaBtn) {
      qaBtn.disabled = true;
      qaBtn.textContent = '...';
    }

    outputArea.innerHTML = `<div class="p-summary-box"><em>⏳ Sedang memproses: "${escapeHtml(query)}"...</em></div>`;

    const settings = await getActiveSettings();
    if (settings.provider !== 'claude-local' && !settings.apiKey) {
      if (qaBtn) { qaBtn.disabled = false; qaBtn.textContent = 'Kirim'; }
      outputArea.innerHTML = `<div class="p-summary-box" style="color:#b91c1c;">⚠️ API Key untuk <strong>${settings.provider.toUpperCase()}</strong> belum disetel.</div>`;
      return;
    }

    const conversationText = formatConversationForAI(msgs);
    const systemPrompt = `Anda adalah asisten komunikasi cerdas dalam Bahasa Indonesia.
Pengguna sedang membuka obrolan chat dan memberikan pertanyaan atau instruksi pembuatan balasan khusus.
Aturan:
1. Jika pengguna bertanya tentang fakta/isi obrolan (misal "kapan dia minta kirim?", "dia sebenarnya mau apa?"), berikan jawaban langsung yang jelas, lugas, dan akurat berdasarkan chat.
2. Jika pengguna meminta dibuatkan balasan pesan (misal "tolak halus", "jadwalkan ulang", "minta diskon", dll), rancanglah 1 draf balasan yang luwes, alami, dan siap kirim.
PENTING: Jika menghasilkan draf balasan, awali baris pertama dengan tepat: "[BALASAN]:" diikuti isi pesannya.`;

    const prompt = `Riwayat Obrolan:\n${conversationText}\n\nPermintaan / Pertanyaan Pengguna:\n${query}`;

    chrome.runtime.sendMessage({
      action: 'GENERATE_AI',
      payload: { prompt, systemPrompt, settings }
    }, (res) => {
      if (qaBtn) {
        qaBtn.disabled = false;
        qaBtn.textContent = 'Kirim';
      }

      if (res && res.success) {
        const text = res.text.trim();
        if (text.startsWith('[BALASAN]:')) {
          const replyText = text.replace(/^\[BALASAN\]:\s*/i, '').trim();
          outputArea.innerHTML = `
            <div class="p-reply-card">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="p-reply-tag p-tag-formal">✨ Balasan Khusus Sesuai Arahan</span>
              </div>
              <div class="p-reply-text">${escapeHtml(replyText)}</div>
              <div class="p-reply-actions">
                <button class="p-small-btn" id="pBtnCopyCustom">📋 Salin</button>
                <button class="p-small-btn p-small-btn-insert" id="pBtnInsertCustom">📨 Masukkan ke Chat</button>
              </div>
            </div>
          `;
          const copyBtn = document.getElementById('pBtnCopyCustom');
          const insertBtn = document.getElementById('pBtnInsertCustom');
          if (copyBtn) {
            copyBtn.onclick = () => {
              navigator.clipboard.writeText(replyText);
              copyBtn.textContent = '✅ Tersalin!';
              setTimeout(() => { copyBtn.textContent = '📋 Salin'; }, 2000);
            };
          }
          if (insertBtn) {
            insertBtn.onclick = () => {
              insertIntoChatInput(replyText);
              insertBtn.textContent = '✅ Dimasukkan!';
              setTimeout(() => { insertBtn.textContent = '📨 Masukkan ke Chat'; }, 2000);
            };
          }
        } else {
          outputArea.innerHTML = `
            <div class="p-summary-box">
              <strong style="display:block; margin-bottom:6px; color:#1e293b;">💡 Jawaban Asisten:</strong>
              <p style="margin:0; line-height:1.6;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>
            </div>
          `;
        }
      } else {
        outputArea.innerHTML = `<div class="p-summary-box" style="color:#b91c1c;">❌ Gagal memproses: ${res?.error || 'Error'}</div>`;
      }
    });
  }

  function renderReplies(rawResponseText) {
    const outputArea = document.getElementById('pCopilotOutputArea');
    let parsed = null;

    try {
      // Bersihkan jika ada codefence markdown ```json ... ```
      const cleaned = rawResponseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      // Jika parsing gagal, tampilkan teks mentah
      outputArea.innerHTML = `<div class="p-summary-box"><pre style="white-space:pre-wrap; margin:0;">${escapeHtml(rawResponseText)}</pre></div>`;
      return;
    }

    const variants = [
      { key: 'formal', tag: '👔 Formal & Sopan', cls: 'p-tag-formal', text: parsed.formal },
      { key: 'casual', tag: '☕ Santai & Friendly', cls: 'p-tag-casual', text: parsed.casual },
      { key: 'direct', tag: '⚡ Singkat & To-the-Point', cls: 'p-tag-direct', text: parsed.direct }
    ];

    let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;

    variants.forEach((v, idx) => {
      if (!v.text) return;
      html += `
        <div class="p-reply-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="p-reply-tag ${v.cls}">${v.tag}</span>
          </div>
          <div class="p-reply-text" id="replyText_${idx}">${escapeHtml(v.text)}</div>
          <div class="p-reply-actions">
            <button class="p-small-btn" data-copy="${idx}">📋 Salin</button>
            <button class="p-small-btn p-small-btn-insert" data-insert="${idx}">📨 Masukkan ke Chat</button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    outputArea.innerHTML = html;

    // Pasang Event Listeners untuk Salin & Masukkan
    variants.forEach((v, idx) => {
      const copyBtn = outputArea.querySelector(`[data-copy="${idx}"]`);
      const insertBtn = outputArea.querySelector(`[data-insert="${idx}"]`);

      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(v.text);
          copyBtn.textContent = '✅ Tersalin!';
          setTimeout(() => { copyBtn.textContent = '📋 Salin'; }, 2000);
        };
      }

      if (insertBtn) {
        insertBtn.onclick = () => {
          insertIntoChatInput(v.text);
          insertBtn.textContent = '✅ Dimasukkan!';
          setTimeout(() => { insertBtn.textContent = '📨 Masukkan ke Chat'; }, 2000);
        };
      }
    });
  }

  // Fungsi menginjeksi teks langsung ke kolom input WhatsApp / Telegram
  function insertIntoChatInput(text) {
    // 1. WhatsApp Web (Lexical editor)
    const waInput = document.querySelector('footer div[contenteditable="true"]') ||
                    document.querySelector('div[contenteditable="true"][role="textbox"]') ||
                    document.querySelector('[data-testid="conversation-compose-box-input"]');

    if (waInput) {
      waInput.focus();
      // Gunakan execCommand agar state internal WhatsApp merespons teks
      document.execCommand('insertText', false, text);
      waInput.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // 2. Telegram Web
    const tgInput = document.querySelector('.input-message-input[contenteditable="true"]') ||
                    document.querySelector('.editable-message-text[contenteditable="true"]') ||
                    document.querySelector('div[contenteditable="true"]');

    if (tgInput) {
      tgInput.focus();
      document.execCommand('insertText', false, text);
      tgInput.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // Fallback: Copy to clipboard jika kolom input tidak terdeteksi
    navigator.clipboard.writeText(text);
    alert('Teks berhasil disalin ke clipboard! (Silakan klik kolom ketik chat dan tekan Ctrl+V)');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
})();
