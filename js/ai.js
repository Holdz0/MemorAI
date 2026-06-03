// ==========================================
// AI Assistant — OpenRouter / GPT-4o-mini
// ==========================================

const AI_MODEL     = 'openai/gpt-4o-mini';
const AI_PROXY_URL = '/api/chat';
const MAX_HISTORY  = 24;
const SESSIONS_KEY = 'ajanda_sessions';
const MAX_SESSIONS = 30;

let conversationHistory = [];
let aiIsProcessing      = false;
let activeSessionId     = null;
let aiSessions          = [];

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
                    category: { type: 'string', enum: ['work','personal','school','health',''], description: 'Kategori' }
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
                    category: { type: 'string', enum: ['work','personal','school','health',''] }
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
- Eksik bilgi varsa ya makul varsayım yap (ve kullanıcıya bildir) ya da sor
- Birden fazla işlem gerekiyorsa tüm araçları aynı anda çağır
- Görev/not ID'lerini doğru kullan; listede görünen ID'yi referans al
- Kısa yanıtlar ver; uzun listeler için markdown kullan`;
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
                    args.category || ''
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
                    args.category !== undefined ? args.category : (task.category || '')
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
        if (m.role === 'user' && typeof m.content === 'string')
            appendChatMsg('user', m.content);
        else if (m.role === 'assistant' && m.content)
            appendChatMsg('assistant', m.content);
    });

    historyHide();
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
}

/** Yeni sohbet başlat */
function sessionNew() {
    sessionSaveCurrent();
    activeSessionId     = null;
    conversationHistory = [];
    const box = document.getElementById('ai-chat-messages');
    box.innerHTML = '';
    showAIWelcome();
    historyHide();
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
    document.getElementById('ai-history-panel').classList.remove('visible');
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

// ==========================================
// OpenRouter API Call — daima proxy kullanır
// ==========================================
async function callOpenRouter(messages) {
    const res = await fetch(AI_PROXY_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            model:       AI_MODEL,
            messages,
            tools:       AI_TOOLS,
            tool_choice: 'auto',
            temperature: 0.4,
            max_tokens:  1024
        })
    });

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

    aiIsProcessing = true;
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
                const results = msg.tool_calls.map(tc => {
                    let args = {};
                    try { args = JSON.parse(tc.function.arguments); } catch {}
                    const result = executeTool(tc.function.name, args);
                    return { role: 'tool', tool_call_id: tc.id, content: result };
                });
                loopMsgs.push(...results);
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
}

// ==========================================
// Chat UI Helpers
// ==========================================
function appendChatMsg(role, text) {
    const box    = document.getElementById('ai-chat-messages');
    const wrap   = document.createElement('div');
    wrap.className = `ai-msg ai-msg--${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';

    const safe = escapeHTML(text);
    bubble.innerHTML = safe
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    wrap.appendChild(bubble);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
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

function showAIWelcome() {
    activeSessionId = null;
    appendChatMsg('assistant',
        `Merhaba! 👋 Ben ajanda asistanınım.\n\n` +
        `Görevlerini ve notlarını doğal dille yönetebilirsin:\n\n` +
        `• **"Yarın 15:00'e diş doktoru randevusu ekle"**\n` +
        `• **"Yüksek öncelikli aktif görevlerimi listele"**\n` +
        `• **"Toplantı hazırlığı görevini tamamlandı yap"**\n` +
        `• **"Alışveriş listesi notu oluştur: süt, ekmek, yumurta"**\n\n` +
        `Ne yapmak istersin?`
    );
}

function toggleAIPanel() {
    const panel   = document.getElementById('ai-chat-panel');
    const opening = !panel.classList.contains('open');
    panel.classList.toggle('open');

    if (opening) {
        const box = document.getElementById('ai-chat-messages');
        if (box.children.length === 0) {
            if (aiSessions.length > 0 && conversationHistory.length === 0) {
                sessionLoad(aiSessions[0].id);
            } else if (conversationHistory.length === 0) {
                showAIWelcome();
            }
        }
        setTimeout(() => document.getElementById('ai-chat-input')?.focus(), 300);
    }
}

function handleAISend() {
    if (aiIsProcessing) return;
    const input = document.getElementById('ai-chat-input');
    const msg   = input.value.trim();
    if (!msg) return;
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

    // Geçmiş butonu
    document.getElementById('ai-history-btn')?.addEventListener('click', historyShow);

    // Yeni sohbet butonu
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
