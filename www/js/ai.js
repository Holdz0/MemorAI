// ==========================================
// AI Assistant — OpenRouter / GPT-4o-mini
// ==========================================

const AI_MODEL        = 'openai/gpt-4o-mini';
const AI_PROXY_URL    = '/api/chat';
const AI_DIRECT_URL   = 'https://openrouter.ai/api/v1/chat/completions';
// Geliştirme için yerel olarak bir varsayılan anahtar tanımlayabilirsin.
// Boş bırakırsan "Varsayılan Anahtarı Kullan" butonları gizlenir.
// UYARI: Bu dosyayı public bir repoya commitlemeden önce DAİMA boş bırak.
const AI_EMBEDDED_KEY = '';
const AI_KEY_STORAGE  = 'ajanda_api_key';
const MAX_HISTORY     = 24;
const SESSIONS_KEY    = 'ajanda_sessions';
const MAX_SESSIONS    = 30;

// Capacitor (mobil APK) ortamında mı çalışıyoruz?
const IS_NATIVE = typeof window !== 'undefined' &&
    typeof window.Capacitor !== 'undefined' &&
    window.Capacitor.isNativePlatform?.();

let conversationHistory = [];
let aiIsProcessing      = false;
let activeSessionId     = null;
let aiSessions          = [];
let pendingOptionResolve = null;  // seçenek sorusu beklerken çözücü fonksiyon
let currentOptionBlock   = null;  // aktif seçenek butonları DOM elemanı

// ==========================================
// API Anahtarı Yönetimi (mobil)
// ==========================================

/** Kayıtlı kullanıcı anahtarını döndürür (yoksa boş string) */
function getApiKey() {
    return (localStorage.getItem(AI_KEY_STORAGE) || '').trim();
}

/** Anahtarı kaydeder */
function setApiKey(key) {
    localStorage.setItem(AI_KEY_STORAGE, (key || '').trim());
}

/** Anahtarı siler */
function clearApiKey() {
    localStorage.removeItem(AI_KEY_STORAGE);
}

/** AI kullanılabilir mi? Web'de proxy hep var; mobilde anahtar gerekli. */
function hasApiKey() {
    return IS_NATIVE ? Boolean(getApiKey()) : true;
}

// ==========================================
// Tool Definitions (OpenAI Function Calling)
// ==========================================
const AI_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_task',
            description: 'Kullanıcı için yeni bir görev oluşturur.',
            parameters: {
                type: 'object',
                properties: {
                    text:     { type: 'string', description: 'Görev başlığı (zorunlu)' },
                    desc:     { type: 'string', description: 'Açıklama (isteğe bağlı)' },
                    date:     { type: 'string', description: 'Tarih YYYY-MM-DD (isteğe bağlı)' },
                    time:     { type: 'string', description: 'Saat HH:MM (isteğe bağlı)' },
                    priority: { type: 'string', enum: ['low','medium','high'], description: 'Öncelik seviyesi' },
                    category: { type: 'string', enum: ['work','personal','school','health',''], description: 'Kategori' },
                    reminder: { type: 'number', enum: [0,5,10,15,30,60,120,180,1440], description: 'Hatırlatıcı: görev saatinden kaç dakika önce bildirim gönderilsin (60=1 saat, 1440=1 gün önce). Tarih ve saat gerektirir.' }
                },
                required: ['text', 'priority']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_task',
            description: 'Mevcut bir görevi günceller. Sadece değiştirilecek alanları gönder.',
            parameters: {
                type: 'object',
                properties: {
                    id:       { type: 'string', description: 'Görevin ID\'si' },
                    text:     { type: 'string' },
                    desc:     { type: 'string' },
                    date:     { type: 'string', description: 'YYYY-MM-DD veya boş string (tarihi kaldırır)' },
                    time:     { type: 'string', description: 'HH:MM veya boş string' },
                    priority: { type: 'string', enum: ['low','medium','high'] },
                    category: { type: 'string', enum: ['work','personal','school','health',''] },
                    reminder: { type: 'number', enum: [0,5,10,15,30,60,120,180,1440], description: 'Hatırlatıcı dakikası (60=1 saat önce). Sadece değiştirilecekse gönder.' }
                },
                required: ['id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'complete_task',
            description: 'Bir görevi tamamlandı veya aktif olarak işaretler.',
            parameters: {
                type: 'object',
                properties: {
                    id:        { type: 'string', description: 'Görevin ID\'si' },
                    completed: { type: 'boolean', description: 'true=tamamlandı, false=aktif' }
                },
                required: ['id', 'completed']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_task',
            description: 'Bir görevi kalıcı olarak siler.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Silinecek görevin ID\'si' }
                },
                required: ['id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_note',
            description: 'Yeni bir metin veya liste notu oluşturur.',
            parameters: {
                type: 'object',
                properties: {
                    title:   { type: 'string', description: 'Not başlığı' },
                    type:    { type: 'string', enum: ['text','list'], description: 'text=serbest metin, list=kontrol listesi' },
                    content: { type: 'string', description: 'Metin notu içeriği (type=text ise)' },
                    items: {
                        type: 'array',
                        description: 'Liste öğeleri (type=list ise)',
                        items: {
                            type: 'object',
                            properties: {
                                text:    { type: 'string' },
                                checked: { type: 'boolean' }
                            },
                            required: ['text']
                        }
                    }
                },
                required: ['title', 'type']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_note',
            description: 'Bir notu siler.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Silinecek notun ID\'si' }
                },
                required: ['id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'ask_options',
            description: 'Bir görev oluştururken/güncellerken bağlamdan ÇIKARILAMAYAN belirsiz bir detayı kullanıcıya seçenekli olarak sorar. Kullanıcı arayüzde butonlarla cevap verir. Görevi oluşturmadan ÖNCE çağır. Kategori/öncelik gibi bağlamdan çıkarılabilen şeyler için KULLANMA.',
            parameters: {
                type: 'object',
                properties: {
                    question: { type: 'string', description: 'Kullanıcıya sorulacak kısa ve net soru' },
                    options: {
                        type: 'array',
                        description: '2-4 adet kısa, anlaşılır seçenek metni',
                        items: { type: 'string' }
                    }
                },
                required: ['question', 'options']
            }
        }
    }
];

// ==========================================
// System Prompt — her API çağrısında taze
// ==========================================
function buildSystemPrompt() {
    const now          = new Date();
    const todayISO     = now.toISOString().split('T')[0];
    const tomorrowISO  = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
    const todayTR      = now.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr      = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const pLabel = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' };
    const cLabel = { work: 'İş', personal: 'Kişisel', school: 'Okul', health: 'Sağlık' };

    const taskLines = tasks.length > 0
        ? tasks.map(t =>
            `  • [${t.id}] "${t.text}" | ${t.completed ? '✅ Tamamlandı' : '⏳ Aktif'}` +
            ` | Öncelik: ${pLabel[t.priority] || '-'}` +
            (t.date ? ` | Tarih: ${t.date}` + (t.time ? ` ${t.time}` : '') : '') +
            (t.category ? ` | Kategori: ${cLabel[t.category]}` : '') +
            (t.reminder !== null && t.reminder !== undefined ? ` | Hatırlatıcı: ${t.reminder}dk önce` : '') +
            (t.desc ? ` | Not: ${t.desc.substring(0, 80)}` : '')
          ).join('\n')
        : '  (Henüz görev yok)';

    const noteLines = notes.length > 0
        ? notes.map(n =>
            `  • [${n.id}] "${n.title}" (${n.type === 'text' ? 'Metin notu' : 'Liste notu'})`
          ).join('\n')
        : '  (Henüz not yok)';

    return `Sen kişisel ajanda asistanısın. Kullanıcının görev ve notlarını gerçek zamanlı yönetebilirsin.

📅 Bugün: ${todayTR} — Saat: ${timeStr}
📆 Tarih referansları: bugün=${todayISO}, yarın=${tomorrowISO}

━━━ GÖREVLER (${tasks.length} adet) ━━━
${taskLines}

━━━ NOTLAR (${notes.length} adet) ━━━
${noteLines}

KURALLAR:
- Daima Türkçe konuş, samimi ve özlü ol
- Birden fazla işlem gerekiyorsa tüm araçları aynı anda çağır
- Görev/not ID'lerini doğru kullan; listede görünen ID'yi referans al
- Kısa yanıtlar ver; uzun listeler için markdown kullan

GÖREV OLUŞTURMA AKIŞI:
- Bağlamdan ÇIKARILABİLEN detayları kendin belirle, ASLA sorma:
  • "okul/ödev/sınav/ders" → kategori "school"
  • "iş/toplantı/rapor/sunum" → kategori "work"
  • "doktor/spor/ilaç/sağlık" → kategori "health"
  • kişisel işler → kategori "personal"
  • "acil/önemli/yetiştir" → öncelik "high"
- Görevde tarih+saat varsa ve kullanıcı HATIRLATICI belirtmediyse: görevi
  oluşturmadan ÖNCE ask_options ile göreve uygun 3 seçenek sun.
  Örnek seçenekler: "1 gün önce", "1 saat önce", "Hatırlatma yok".
- ask_options'ı tek başına çağır (aynı turda görev oluşturma).
- Aynı anda en fazla 1-2 soru sor; gerek yoksa hiç sorma, direkt oluştur.
- Saat yoksa hatırlatıcı sorma (hatırlatıcı tarih+saat gerektirir).
- Kullanıcı cevap verince seçimi uygun değere çevir ve görevi oluştur
  (ör. "1 saat önce"→reminder 60, "1 gün önce"→1440, "Hatırlatma yok"→reminder gönderme).`;
}

// ==========================================
// Tool Execution
// ==========================================
function executeTool(toolName, args) {
    try {
        switch (toolName) {

            case 'create_task': {
                addTask(
                    args.text,
                    args.desc     || '',
                    args.date     || '',
                    args.time     || '',
                    args.priority || 'medium',
                    args.category || '',
                    args.reminder
                );
                return `✓ Görev oluşturuldu: "${args.text}"`;
            }

            case 'update_task': {
                const task = tasks.find(t => t.id === args.id);
                if (!task) return `✗ Görev bulunamadı (ID: ${args.id})`;
                updateTask(
                    args.id,
                    args.text     !== undefined ? args.text     : task.text,
                    args.desc     !== undefined ? args.desc     : (task.desc  || ''),
                    args.date     !== undefined ? args.date     : (task.date  || ''),
                    args.time     !== undefined ? args.time     : (task.time  || ''),
                    args.priority !== undefined ? args.priority : task.priority,
                    args.category !== undefined ? args.category : (task.category || ''),
                    args.reminder
                );
                return `✓ Görev güncellendi: "${args.text || task.text}"`;
            }

            case 'complete_task': {
                const task = tasks.find(t => t.id === args.id);
                if (!task) return `✗ Görev bulunamadı (ID: ${args.id})`;
                if (task.completed !== args.completed) toggleTaskStatus(args.id);
                return `✓ "${task.text}" → ${args.completed ? 'tamamlandı' : 'aktif yapıldı'}`;
            }

            case 'delete_task': {
                const task = tasks.find(t => t.id === args.id);
                if (!task) return `✗ Görev bulunamadı (ID: ${args.id})`;
                const label = task.text;
                deleteTask(args.id, null);
                return `✓ Görev silindi: "${label}"`;
            }

            case 'create_note': {
                const content = args.type === 'list'
                    ? (args.items || []).map(i => ({ text: i.text, checked: i.checked || false }))
                    : (args.content || '');
                addNoteAI(args.type, args.title, content);
                return `✓ Not oluşturuldu: "${args.title}"`;
            }

            case 'delete_note': {
                const ok = deleteNoteAI(args.id);
                return ok ? `✓ Not silindi` : `✗ Not bulunamadı (ID: ${args.id})`;
            }

            default:
                return `✗ Bilinmeyen araç: ${toolName}`;
        }
    } catch (err) {
        console.error('[Tool Error]', toolName, err);
        return `✗ Araç hatası: ${err.message}`;
    }
}

// ==========================================
// Session / Conversation History
// ==========================================

function sessionsLoad() {
    try { aiSessions = JSON.parse(localStorage.getItem(SESSIONS_KEY)) || []; }
    catch { aiSessions = []; }
}

function sessionsSave() {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(aiSessions));
}

/** Mevcut sohbeti localStorage'a kaydet */
function sessionSaveCurrent() {
    if (!conversationHistory.length) return;

    const firstUser = conversationHistory.find(m => m.role === 'user');
    const rawTitle  = typeof firstUser?.content === 'string' ? firstUser.content : 'Sohbet';
    const title     = rawTitle.length > 55 ? rawTitle.slice(0, 52) + '…' : rawTitle;

    if (!activeSessionId) {
        activeSessionId = Date.now().toString();
        aiSessions.unshift({
            id: activeSessionId,
            title,
            createdAt:  new Date().toISOString(),
            updatedAt:  new Date().toISOString(),
            messages:   [...conversationHistory]
        });
    } else {
        const idx = aiSessions.findIndex(s => s.id === activeSessionId);
        if (idx > -1) {
            aiSessions[idx].updatedAt = new Date().toISOString();
            aiSessions[idx].messages  = [...conversationHistory];
        }
    }

    if (aiSessions.length > MAX_SESSIONS) aiSessions = aiSessions.slice(0, MAX_SESSIONS);
    sessionsSave();
}

/** Bir session'ı yükle ve sohbet ekranını doldur */
function sessionLoad(id) {
    const session = aiSessions.find(s => s.id === id);
    if (!session) return;

    activeSessionId     = id;
    conversationHistory = [...session.messages];

    const box = document.getElementById('ai-chat-messages');
    box.innerHTML = '';

    conversationHistory.forEach(m => {
        if (m.role === 'user' && typeof m.content === 'string') {
            appendChatMsg('user', m.content);
        } else if (m.role === 'assistant') {
            if (m.content) appendChatMsg('assistant', m.content);
            // ask_options soruları
            if (Array.isArray(m.tool_calls)) {
                m.tool_calls.forEach(tc => {
                    if (tc.function?.name === 'ask_options') {
                        try {
                            const a = JSON.parse(tc.function.arguments);
                            if (a.question) appendChatMsg('assistant', a.question);
                        } catch {}
                    }
                });
            }
        } else if (m.role === 'tool' && typeof m.content === 'string') {
            if (m.content.startsWith('Kullanıcı seçimi: ')) {
                appendChatMsg('user', m.content.slice('Kullanıcı seçimi: '.length));
            } else if (/^[✓✗]/.test(m.content.trim())) {
                appendActionChips([m.content]);
            }
        }
    });

    historyHide();
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
}

/** Yeni sohbet başlat */
function sessionNew() {
    if (aiIsProcessing) return; // işlem/soru sürerken yeni sohbet açma
    sessionSaveCurrent();
    activeSessionId     = null;
    conversationHistory = [];
    const box = document.getElementById('ai-chat-messages');
    box.innerHTML = '';
    historyHide();
    if (!hasApiKey()) renderKeyPrompt();
    else showAIWelcome();
}

/** Bir session'ı sil */
function sessionDelete(id, e) {
    e.stopPropagation();
    aiSessions = aiSessions.filter(s => s.id !== id);
    sessionsSave();
    if (activeSessionId === id) {
        activeSessionId     = null;
        conversationHistory = [];
    }
    historyRenderList();
}

// ── History Panel ──────────────────────────────

function historyShow() {
    historyRenderList();
    document.getElementById('ai-history-panel').classList.add('visible');
}

function historyHide() {
    document.getElementById('ai-history-panel')?.classList.remove('visible');
}

function historyRenderList() {
    const list = document.getElementById('ai-sessions-list');
    if (!list) return;

    if (!aiSessions.length) {
        list.innerHTML = `
            <div class="ai-sessions-empty">
                <i class="ph ph-chats"></i>
                Henüz kayıtlı sohbet yok.<br>
                <small>Mesaj gönderdiğinde otomatik kaydedilir.</small>
            </div>`;
        return;
    }

    list.innerHTML = '';
    aiSessions.forEach(s => {
        const el  = document.createElement('div');
        el.className = `ai-session-item${s.id === activeSessionId ? ' active-session' : ''}`;

        const d     = new Date(s.updatedAt);
        const today = new Date();
        let dateStr;
        if (d.toDateString() === today.toDateString()) {
            dateStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } else {
            dateStr = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        }

        el.innerHTML = `
            <div class="ai-session-title">${escapeHTML(s.title)}</div>
            <div class="ai-session-meta">
                <span class="ai-session-date">${dateStr}</span>
                <button class="ai-session-del" title="Sil"><i class="ph ph-trash"></i></button>
            </div>`;

        el.addEventListener('click', () => sessionLoad(s.id));
        el.querySelector('.ai-session-del').addEventListener('click', e => sessionDelete(s.id, e));
        list.appendChild(el);
    });
}

/** History panelini DOM'a enjekte et (init sırasında bir kez çağrılır) */
function historyPanelInject() {
    const panel = document.getElementById('ai-chat-panel');
    const hist  = document.createElement('div');
    hist.id        = 'ai-history-panel';
    hist.className = 'ai-history-panel';
    hist.innerHTML = `
        <div class="ai-history-header">
            <button class="ai-icon-btn" id="ai-history-back" title="Geri">
                <i class="ph ph-arrow-left"></i>
            </button>
            <h3>Sohbet Geçmişi</h3>
            <button class="ai-new-chat-btn" id="ai-new-chat-inner">
                <i class="ph ph-plus"></i> Yeni
            </button>
        </div>
        <div class="ai-sessions-list" id="ai-sessions-list"></div>`;
    panel.appendChild(hist);

    document.getElementById('ai-history-back').addEventListener('click', historyHide);
    document.getElementById('ai-new-chat-inner').addEventListener('click', sessionNew);
}

// ── API anahtarı değişimi ──────────────────────

/** Genel ayarlardan anahtar değiştiğinde çağrılır — app.js erişir */
function onApiKeyChanged() {
    const box = document.getElementById('ai-chat-messages');
    if (!box) return;
    // Anahtar istemi gösteriliyorsa ve artık anahtar varsa hoş geldine geç
    if (hasApiKey() && box.querySelector('.ai-key-prompt')) {
        box.innerHTML = '';
        showAIWelcome();
    }
}

// ==========================================
// OpenRouter API Call
// — Mobil (Capacitor): doğrudan API çağrısı
// — Web (tarayıcı): sunucu proxy kullanır
// ==========================================
async function callOpenRouter(messages) {
    const payload = {
        model:       AI_MODEL,
        messages,
        tools:       AI_TOOLS,
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens:  1024
    };

    let res;

    if (IS_NATIVE) {
        // Mobil APK: kullanıcının kaydettiği anahtarla doğrudan çağrı
        const key = getApiKey();
        if (!key) throw new Error('API anahtarı tanımlı değil. Ayarlardan ekleyebilirsin.');
        res = await fetch(AI_DIRECT_URL, {
            method:  'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type':  'application/json',
                'HTTP-Referer':  'https://ajanda.app',
                'X-Title':       'Premium Ajanda'
            },
            body: JSON.stringify(payload)
        });
    } else {
        // Web: sunucu proxy — anahtar tarayıcıya gelmez
        res = await fetch(AI_PROXY_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
    }

    if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try { const d = await res.json(); errMsg = d.error?.message || errMsg; } catch {}
        throw new Error(errMsg);
    }
    return res.json();
}

// ==========================================
// Main Conversation Flow
// ==========================================
async function sendMessageToAI(userMessage) {
    if (aiIsProcessing) return;

    // Mobilde anahtar yoksa kullanıcıdan iste
    if (!hasApiKey()) {
        renderKeyPrompt();
        return;
    }

    aiIsProcessing = true;
    setSendButtonState(true);
    removeSuggestions();
    appendChatMsg('user', userMessage);
    conversationHistory.push({ role: 'user', content: userMessage });
    showTypingDots();

    try {
        let loopMsgs = [...conversationHistory];

        while (true) {
            const data = await callOpenRouter([
                { role: 'system', content: buildSystemPrompt() },
                ...loopMsgs
            ]);

            const choice = data.choices[0];
            const msg    = choice.message;
            loopMsgs.push(msg);

            if (msg.tool_calls && msg.tool_calls.length > 0) {
                const results = [];
                const actionResults = [];
                for (const tc of msg.tool_calls) {
                    let args = {};
                    try { args = JSON.parse(tc.function.arguments); } catch {}
                    if (tc.function.name === 'ask_options') {
                        // Kullanıcıdan seçenekli cevap bekle
                        const answer = await handleAskOptions(args);
                        results.push({ role: 'tool', tool_call_id: tc.id, content: `Kullanıcı seçimi: ${answer}` });
                    } else {
                        const result = executeTool(tc.function.name, args);
                        results.push({ role: 'tool', tool_call_id: tc.id, content: result });
                        actionResults.push(result);
                    }
                }
                loopMsgs.push(...results);
                // Yapılan işlemleri görsel olarak göster
                if (actionResults.length) {
                    hideTypingDots();
                    appendActionChips(actionResults);
                    showTypingDots();
                }
            } else {
                hideTypingDots();
                if (msg.content) appendChatMsg('assistant', msg.content);
                conversationHistory = loopMsgs.slice(-MAX_HISTORY);
                sessionSaveCurrent();
                break;
            }
        }
    } catch (err) {
        hideTypingDots();
        appendChatMsg('error', `❌ Hata: ${err.message}`);
        console.error('[AI Error]', err);
    }

    aiIsProcessing = false;
    setSendButtonState(false);
}

// ==========================================
// Chat UI Helpers
// ==========================================

/** Basit markdown: **kalın**, `kod`, satır sonu */
function formatMessage(text) {
    return escapeHTML(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function appendChatMsg(role, text) {
    const box  = document.getElementById('ai-chat-messages');
    const wrap = document.createElement('div');
    wrap.className = `ai-msg ai-msg--${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.innerHTML = formatMessage(text);
    wrap.appendChild(bubble);

    // Asistan mesajlarına kopyala butonu
    if (role === 'assistant') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ai-copy-btn';
        copyBtn.title = 'Kopyala';
        copyBtn.innerHTML = '<i class="ph ph-copy"></i> Kopyala';
        copyBtn.addEventListener('click', () => copyText(text, copyBtn));
        wrap.appendChild(copyBtn);
    }

    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
}

/** AI'nın yaptığı işlemleri rozet olarak gösterir */
function appendActionChips(results) {
    if (!results || !results.length) return;
    const box  = document.getElementById('ai-chat-messages');
    const wrap = document.createElement('div');
    wrap.className = 'ai-actions';
    results.forEach(r => {
        const ok   = r.trim().startsWith('✓');
        const text = r.replace(/^[✓✗]\s*/, '');
        const chip = document.createElement('div');
        chip.className = `ai-action-chip ${ok ? 'ok' : 'fail'}`;
        chip.innerHTML = `<i class="ph ${ok ? 'ph-check-circle' : 'ph-warning-circle'}"></i><span>${escapeHTML(text)}</span>`;
        wrap.appendChild(chip);
    });
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
}

// ── Seçenekli soru (ask_options) ───────────────

/** AI'nın seçenekli sorusunu gösterir, kullanıcının cevabını bekler */
function handleAskOptions(args) {
    hideTypingDots();
    setSendButtonState(false); // kullanıcı yazarak da cevap verebilsin
    return new Promise(resolve => {
        const done = (choice) => {
            if (pendingOptionResolve !== done) return; // zaten çözüldü
            pendingOptionResolve = null;
            setSendButtonState(true);
            showTypingDots();
            resolve(choice);
        };
        pendingOptionResolve = done;
        const opts = Array.isArray(args.options) ? args.options : [];
        renderOptionButtons(args.question || 'Bir seçenek seç:', opts, done);
    });
}

/** Soru metnini + seçenek butonlarını sohbete basar */
function renderOptionButtons(question, options, onPick) {
    const box = document.getElementById('ai-chat-messages');
    appendChatMsg('assistant', question);

    const wrap = document.createElement('div');
    wrap.className = 'ai-options';
    options.forEach(opt => {
        const label = String(opt);
        const btn = document.createElement('button');
        btn.className = 'ai-option-btn';
        btn.innerHTML = `<i class="ph ph-circle-dashed"></i><span>${escapeHTML(label)}</span>`;
        btn.addEventListener('click', () => {
            if (!currentOptionBlock) return;
            appendChatMsg('user', label);
            lockOptionBlock(label);
            onPick(label);
        });
        wrap.appendChild(btn);
    });
    box.appendChild(wrap);
    currentOptionBlock = wrap;
    box.scrollTop = box.scrollHeight;
}

/** Seçenek butonlarını kilitler, seçileni vurgular */
function lockOptionBlock(chosen) {
    if (!currentOptionBlock) return;
    currentOptionBlock.querySelectorAll('.ai-option-btn').forEach(b => {
        b.disabled = true;
        const label = b.querySelector('span')?.textContent;
        if (label === chosen) {
            b.classList.add('chosen');
            const ic = b.querySelector('i');
            if (ic) ic.className = 'ph ph-check-circle';
        } else {
            b.classList.add('dimmed');
        }
    });
    currentOptionBlock = null;
}

/** Metni panoya kopyalar */
async function copyText(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        ta.remove();
    }
    if (btn) {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="ph ph-check"></i> Kopyalandı';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="ph ph-copy"></i> Kopyala';
        }, 1500);
    }
}

function showTypingDots() {
    const box = document.getElementById('ai-chat-messages');
    if (document.getElementById('ai-typing-indicator')) return;
    const el = document.createElement('div');
    el.id        = 'ai-typing-indicator';
    el.className = 'ai-msg ai-msg--assistant';
    el.innerHTML = '<div class="ai-bubble ai-typing"><span></span><span></span><span></span></div>';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
}

function hideTypingDots() {
    document.getElementById('ai-typing-indicator')?.remove();
}

/** Gönder butonunu işlem durumuna göre günceller */
function setSendButtonState(busy) {
    const btn = document.getElementById('ai-send-btn');
    if (!btn) return;
    btn.disabled = busy;
    btn.innerHTML = busy
        ? '<i class="ph ph-circle-notch ai-spin"></i>'
        : '<i class="ph ph-paper-plane-tilt"></i>';
}

function removeSuggestions() {
    document.querySelector('.ai-suggestions')?.remove();
}

// ── Hoş geldin ekranı + öneri çipleri ──────────
const AI_SUGGESTIONS = [
    'Yarın 15:00\'e diş doktoru randevusu ekle',
    'Bu haftaki görevlerimi listele',
    'Yüksek öncelikli görevlerimi göster',
    'Alışveriş listesi notu oluştur: süt, ekmek, yumurta'
];

function showAIWelcome() {
    activeSessionId = null;
    const box = document.getElementById('ai-chat-messages');

    appendChatMsg('assistant',
        'Merhaba! 👋 Ben ajanda asistanınım.\n' +
        'Görevlerini ve notlarını doğal dille yönetebilirim. Aşağıdaki örneklerden birine dokun:'
    );

    const wrap = document.createElement('div');
    wrap.className = 'ai-suggestions';
    AI_SUGGESTIONS.forEach(text => {
        const chip = document.createElement('button');
        chip.className = 'ai-suggestion-chip';
        chip.innerHTML = `<i class="ph ph-arrow-up-right"></i><span>${escapeHTML(text)}</span>`;
        chip.addEventListener('click', () => {
            if (aiIsProcessing) return;
            sendMessageToAI(text);
        });
        wrap.appendChild(chip);
    });
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
}

// ── API anahtarı istemi ────────────────────────
function renderKeyPrompt() {
    const box = document.getElementById('ai-chat-messages');
    box.innerHTML = '';
    const hasDefault = AI_EMBEDDED_KEY && AI_EMBEDDED_KEY.length > 0;
    const wrap = document.createElement('div');
    wrap.className = 'ai-key-prompt';
    wrap.innerHTML = `
        <div class="ai-key-prompt-icon"><i class="ph ph-key"></i></div>
        <h4>AI Asistanı Etkinleştir</h4>
        <p>Asistanı kullanmak için bir OpenRouter API anahtarı gerekli.</p>
        <input type="password" id="ai-key-prompt-input" class="ai-settings-input"
            placeholder="sk-or-v1-..." autocomplete="off">
        <button class="ai-settings-btn primary full" id="ai-key-prompt-save">
            <i class="ph ph-check"></i> Anahtarı Kaydet
        </button>
        ${hasDefault ? `
        <button class="ai-settings-btn full" id="ai-key-prompt-default">
            <i class="ph ph-sparkle"></i> Varsayılan Anahtarı Kullan
        </button>` : ''}
        <p class="ai-settings-hint">
            Ücretsiz anahtar:
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a>
        </p>`;
    box.appendChild(wrap);

    document.getElementById('ai-key-prompt-save').addEventListener('click', () => {
        const val = document.getElementById('ai-key-prompt-input').value.trim();
        if (!val) return;
        setApiKey(val);
        box.innerHTML = '';
        showAIWelcome();
    });
    if (hasDefault) {
        document.getElementById('ai-key-prompt-default').addEventListener('click', () => {
            setApiKey(AI_EMBEDDED_KEY);
            box.innerHTML = '';
            showAIWelcome();
        });
    }

    setTimeout(() => document.getElementById('ai-key-prompt-input')?.focus(), 200);
}

function toggleAIPanel() {
    const panel   = document.getElementById('ai-chat-panel');
    const opening = !panel.classList.contains('open');
    panel.classList.toggle('open');

    if (opening) {
        const box = document.getElementById('ai-chat-messages');
        if (box.children.length === 0) {
            if (!hasApiKey()) {
                renderKeyPrompt();
            } else if (aiSessions.length > 0 && conversationHistory.length === 0) {
                sessionLoad(aiSessions[0].id);
            } else if (conversationHistory.length === 0) {
                showAIWelcome();
            }
        }
        setTimeout(() => document.getElementById('ai-chat-input')?.focus(), 300);
    }
}

function handleAISend() {
    const input = document.getElementById('ai-chat-input');
    const msg   = input.value.trim();
    if (!msg) return;

    // Seçenek sorusu bekleniyorsa, yazılan metni cevap olarak yönlendir
    if (pendingOptionResolve) {
        input.value = '';
        input.style.height = 'auto';
        const resolver = pendingOptionResolve;
        appendChatMsg('user', msg);
        lockOptionBlock(msg);
        resolver(msg);
        return;
    }

    if (aiIsProcessing) return;
    input.value = '';
    input.style.height = 'auto';
    sendMessageToAI(msg);
}

// ==========================================
// Init
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    sessionsLoad();
    historyPanelInject();

    // Toggle panel (masaüstü butonu)
    document.getElementById('ai-chat-toggle')?.addEventListener('click', toggleAIPanel);

    // Kapat
    document.getElementById('ai-chat-close')?.addEventListener('click', () => {
        document.getElementById('ai-chat-panel').classList.remove('open');
    });

    // Geçmiş / Yeni sohbet butonları
    document.getElementById('ai-history-btn')?.addEventListener('click', historyShow);
    document.getElementById('ai-clear-btn')?.addEventListener('click', sessionNew);

    // Mesaj gönder
    document.getElementById('ai-send-btn')?.addEventListener('click', handleAISend);
    document.getElementById('ai-chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAISend();
        }
    });

    // Textarea otomatik boyutlandır
    const ta = document.getElementById('ai-chat-input');
    ta?.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    });
});
