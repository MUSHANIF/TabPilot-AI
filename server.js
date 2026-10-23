// Local AI Bridge Server for Claude (Akun Login Lokal)
// Menggunakan native Node.js tanpa perlu npm install tambahan!

const http = require('http');
const { spawn } = require('child_process');

const PORT = 3030;

const server = http.createServer((req, res) => {
  // Set CORS headers agar ekstensi browser bisa mengakses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Local AI Bridge siap digunakan' }));
    return;
  }

  // 2. Generate AI via Claude CLI yang sudah login
  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { prompt, systemPrompt } = JSON.parse(body || '{}');
        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Prompt tidak boleh kosong' }));
          return;
        }

        // Gabungkan system prompt dan user prompt
        let fullPrompt = '';
        if (systemPrompt) {
          fullPrompt += `[PETUNJUK SISTEM]:\n${systemPrompt}\n\n`;
        }
        fullPrompt += prompt;

        // Panggil Claude Code CLI yang sudah login di laptop user
        // Gunakan stdin agar prompt panjang aman dari batasan karakter shell Windows
        const claude = spawn('claude', ['-p', '-'], {
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdoutData = '';
        let stderrData = '';

        claude.stdout.on('data', (d) => { stdoutData += d.toString(); });
        claude.stderr.on('data', (d) => { stderrData += d.toString(); });

        claude.on('close', (code) => {
          if (code !== 0 && !stdoutData.trim()) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: stderrData || `Claude CLI keluar dengan error code ${code}`
            }));
            return;
          }

          // Bersihkan teks statusline jika ada
          let cleaned = stdoutData.trim();
          // Filter warning banner jika ada
          cleaned = cleaned.replace(/Warning: no stdin data received[^\n]*\n?/g, '').trim();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, text: cleaned }));
        });

        claude.stdin.write(fullPrompt);
        claude.stdin.end();

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint tidak ditemukan' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`====================================================`);
  console.log(`🚀 Local AI Bridge aktif di: http://127.0.0.1:${PORT}`);
  console.log(`👉 Ekstensi browser Anda sekarang dapat menggunakan`);
  console.log(`   Claude yang sudah login TANPA perlu API Key!`);
  console.log(`====================================================`);
});
