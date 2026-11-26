/**
 * Premium Ajanda — Proxy Sunucusu
 *
 * API anahtarı bu dosyada saklıdır; tarayıcıya asla gönderilmez.
 * Başlatmak için: npm start
 */

const express = require('express');
const path    = require('path');

// .env dosyasını yükle (Node ≥20.12). Dosya yoksa ortam değişkenleri kullanılır.
try { process.loadEnvFile(); } catch {}

const app  = express();
const PORT = process.env.PORT || 3000;

// ── API Anahtarı ────────────────────────────────────────
// Anahtar OPENROUTER_API_KEY ortam değişkeninden okunur.
// Kurulum: .env dosyası oluştur ve `OPENROUTER_API_KEY=sk-or-v1-...` ekle
// (Bkz: .env.example). Anahtar yok ise /api/chat 503 döndürür.
const API_KEY = process.env.OPENROUTER_API_KEY || '';
if (!API_KEY) {
    console.warn('[Uyarı] OPENROUTER_API_KEY tanımlı değil — /api/chat çalışmayacak.');
}

// ── Güvenlik başlıkları (statik dosyalardan ÖNCE, yoksa onlara uygulanmaz) ──
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// ── Middleware ──────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Statik dosyaları sun — www/ klasöründen
app.use(express.static(path.join(__dirname, 'www')));

// ── Sağlık kontrolü ─────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ ok: true, proxy: true });
});

// ── Model listesi (yalnızca tool çağırmayı destekleyenler) ──
app.get('/api/models', async (req, res) => {
    try {
        const upstream = await fetch('https://openrouter.ai/api/v1/models?supported_parameters=tools', {
            headers: API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}
        });
        res.status(upstream.status).json(await upstream.json());
    } catch (err) {
        console.error('[Models Error]', err.message);
        res.status(502).json({ error: { message: 'Model listesi alınamadı.' } });
    }
});

// ── AI Proxy endpoint ───────────────────────────────────
app.post('/api/chat', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({
            error: { message: 'Sunucuda OPENROUTER_API_KEY tanımlı değil. .env dosyası oluşturun.' }
        });
    }

    const { model, messages, tools, tool_choice, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: { message: 'Geçersiz istek: messages dizisi gerekli.' } });
    }

    try {
        const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization':  `Bearer ${API_KEY}`,
                'Content-Type':   'application/json',
                'HTTP-Referer':   req.headers.origin || `http://localhost:${PORT}`,
                'X-Title':        'Premium Ajanda'
            },
            body: JSON.stringify({
                model:        model        || 'openai/gpt-4o-mini',
                messages,
                tools:        tools        || [],
                tool_choice:  tool_choice  || 'auto',
                temperature:  temperature  ?? 0.4,
                max_tokens:   max_tokens   || 1024
            })
        });

        const data = await upstream.json();

        if (!upstream.ok) {
            return res.status(upstream.status).json(data);
        }

        res.json(data);
    } catch (err) {
        console.error('[Proxy Error]', err.message);
        res.status(500).json({ error: { message: 'OpenRouter\'a bağlanılamadı.' } });
    }
});

// ── Sunucuyu başlat ─────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Ajanda sunucusu çalışıyor: http://localhost:${PORT}`);
    console.log(`🔑 API anahtarı: ${API_KEY ? '✅ Yüklendi' : '❌ Tanımlı değil (.env)'}`);
});
