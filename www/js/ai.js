// ==========================================
// AI Assistant — OpenRouter / GPT-4o-mini
// ==========================================

const AI_DEFAULT_MODEL = 'openai/gpt-4o-mini';
const AI_MODEL_STORAGE = 'ajanda_ai_model';
const AI_PROXY_URL    = '/api/chat';
const AI_DIRECT_URL   = 'https://openrouter.ai/api/v1/chat/completions';
const AI_PROXY_MODELS_URL  = '/api/models';
const AI_DIRECT_MODELS_URL = 'https://openrouter.ai/api/v1/models?supported_parameters=tools';
const MAX_TOOL_ROUNDS = 10;   // model durmadan araç çağırırsa API harcamasını kes
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

// ──────────────────────────────────────────────
// AI İşlem Hafızası — sohbetler arası kalıcı
// AI'nın yaptığı her CRUD'ı snapshot'ıyla saklar
// ──────────────────────────────────────────────
const AI_LOG_KEY = 'agenda_ai_action_log';
const MAX_AI_LOG = 100;
let aiActionLog = (() => {
    try { return JSON.parse(localStorage.getItem(AI_LOG_KEY)) || []; }
    catch { return []; }
})();

function logAIAction(entry) {
    aiActionLog.unshift({ ts: new Date().toISOString(), ...entry });
    if (aiActionLog.length > MAX_AI_LOG) aiActionLog.length = MAX_AI_LOG;
    try { localStorage.setItem(AI_LOG_KEY, JSON.stringify(aiActionLog)); } catch {}
}

function clearAIActionLog() {
    aiActionLog = [];
    try { localStorage.removeItem(AI_LOG_KEY); } catch {}
}

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
// Model Seçimi (OpenRouter)
// ==========================================

function getModel() {
    return localStorage.getItem(AI_MODEL_STORAGE) || AI_DEFAULT_MODEL;
}

function setModel(id) {
    localStorage.setItem(AI_MODEL_STORAGE, id);
    updateModelLabel();
}

function updateModelLabel() {
    const el = document.querySelector('.ai-model-label');
    if (el) el.textContent = `${getModel()} · OpenRouter`;
}

let aiModelsCache = null;  // oturum boyunca bir kez çekilir

/** Tool çağırmayı destekleyen OpenRouter modellerini getirir (web: proxy, mobil: doğrudan) */
async function fetchModels() {
    if (aiModelsCache) return aiModelsCache;
    const key = getApiKey();
    const res = IS_NATIVE
        ? await fetch(AI_DIRECT_MODELS_URL, { headers: key ? { 'Authorization': `Bearer ${key}` } : {} })
        : await fetch(AI_PROXY_MODELS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Uygulama araç çağrısına dayanıyor — sorgu parametresi yok sayılırsa diye istemcide de süz
    aiModelsCache = (data.data || []).filter(m => m.supported_parameters?.includes('tools'));
    return aiModelsCache;
}

/** OpenRouter fiyatı (USD/token, string) → "$0.15/M" */
function formatModelPrice(m) {
    const p = Number(m.pricing?.prompt), c = Number(m.pricing?.completion);
    if (p === 0 && c === 0) return 'Ücretsiz';
    if (!(p > 0)) return 'Değişken fiyat';
    return `$${+(p * 1e6).toFixed(2)} / $${+(c * 1e6).toFixed(2)} per 1M`;
}

const MODEL_LIST_LIMIT = 50;

/** Ayarlar sayfasındaki model arama listesini çizer */
async function renderModelPicker() {
    const list   = document.getElementById('settings-model-list');
    const search = document.getElementById('settings-model-search');
    const cur    = document.getElementById('settings-model-current');
    if (!list || !search) return;
    if (cur) cur.textContent = getModel();

    let models;
    try {
        if (!aiModelsCache) list.innerHTML = '<div class="model-list-msg"><i class="ph ph-circle-notch ai-spin"></i> Modeller yükleniyor…</div>';
        models = await fetchModels();
    } catch (err) {
        list.innerHTML = `<div class="model-list-msg">Model listesi alınamadı (${escapeHTML(err.message)}).</div>`;
        return;
    }

    const q = search.value.trim().toLowerCase();
    const matches = q
        ? models.filter(m => m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q))
        : models;

    if (!matches.length) {
        list.innerHTML = '<div class="model-list-msg">Eşleşen model yok.</div>';
        return;
    }

    const selected = getModel();
    list.innerHTML = '';
    matches.slice(0, MODEL_LIST_LIMIT).forEach(m => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `model-item${m.id === selected ? ' selected' : ''}`;
        const ctx = m.context_length ? ` · ${Math.round(m.context_length / 1000)}K bağlam` : '';
        btn.innerHTML = `
            <span class="model-item-name">${escapeHTML(m.name || m.id)}</span>
            <span class="model-item-id">${escapeHTML(m.id)}</span>
            <span class="model-item-meta">${escapeHTML(formatModelPrice(m) + ctx)}</span>`;
        btn.addEventListener('click', () => {
            setModel(m.id);
            renderModelPicker();
        });
        list.appendChild(btn);
    });
    if (matches.length > MODEL_LIST_LIMIT) {
        list.insertAdjacentHTML('beforeend',
            `<div class="model-list-msg">+${matches.length - MODEL_LIST_LIMIT} model daha — aramayı daralt.</div>`);
    }
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
    const todayISO     = localDateStr(now);
    const tomorrowISO  = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
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

    const actionLines = formatActionLog(pLabel, cLabel);

    return `Sen kişisel ajanda asistanısın. Kullanıcının görev ve notlarını gerçek zamanlı yönetebilirsin.

📅 Bugün: ${todayTR} — Saat: ${timeStr}
📆 Tarih referansları: bugün=${todayISO}, yarın=${tomorrowISO}

━━━ GÖREVLER (${tasks.length} adet) ━━━
${taskLines}

━━━ NOTLAR (${notes.length} adet) ━━━
${noteLines}

━━━ SON AI İŞLEMLERİ — senin yaptıkların (en yeniden eskiye, en fazla 30) ━━━
${actionLines}

KURALLAR:
- Daima Türkçe konuş, samimi ve özlü ol
- Birden fazla işlem gerekiyorsa tüm araçları aynı anda çağır
- Görev/not ID'lerini doğru kullan; listede görünen ID'yi referans al
- Kısa yanıtlar ver; uzun listeler için markdown kullan

GERİ ALMA & İŞLEM HAFIZASI:
- "SON AI İŞLEMLERİ" listesi senin daha önce yaptığın işlemleri TAM VERİYLE içerir.
- Kullanıcı "sildiğin görevi geri getir", "son yaptığını iptal et", "az önce eklediğini sil"
  gibi ifadeler kullanırsa bu listeyi referans al ve uygun aracı çağır:
  • Silinen görev → create_task ile snapshot'taki TÜM verilerle (text, desc, date,
    time, priority, category, reminder) yeniden oluştur.
  • Silinen not → create_note ile snapshot'taki content/items ile yeniden oluştur.
  • Hatalı güncelleme → update_task ile "before" değerlerine geri döndür.
  • Hatalı tamamlama/aktife alma → complete_task ile durumu tersine çevir.
- Belirsizlik varsa en yeni (listedeki ilk) işlemi al; emin değilsen kullanıcıya sor.

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
  (ör. "1 saat önce"→reminder 60, "1 gün önce"→1440, "Hatırlatma yok"→reminder gönderme).
- GERİ ALMA durumunda bu akış geçerli DEĞİL — snapshot'taki orijinal değerleri kullan.`;
}

/** AI işlem hafızasını sistem promptu için biçimlendir */
function formatActionLog(pLabel, cLabel) {
    if (!aiActionLog || aiActionLog.length === 0) return '  (Henüz işlem yok)';

    const fmtTaskSnap = (t) => {
        if (!t) return '';
        const parts = [];
        if (t.date)                parts.push(`tarih=${t.date}${t.time ? ' ' + t.time : ''}`);
        if (t.priority)            parts.push(`öncelik=${pLabel[t.priority] || t.priority}`);
        if (t.category)            parts.push(`kategori=${cLabel[t.category] || t.category}`);
        if (t.reminder !== null && t.reminder !== undefined)
                                   parts.push(`hatırlatıcı=${t.reminder}dk`);
        if (t.completed)           parts.push('tamamlanmıştı');
        if (t.desc)                parts.push(`açıklama="${String(t.desc).slice(0, 80)}"`);
        return parts.length ? ' | ' + parts.join(' | ') : '';
    };

    return aiActionLog.slice(0, 30).map(a => {
        const d = new Date(a.ts);
        const time = d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        switch (a.op) {
            case 'create_task': {
                const t = a.snapshot;
                if (!t) return `  • [${time}] oluşturdum bir görev`;
                return `  • [${time}] OLUŞTURDUM görevi (id=${t.id}): "${t.text}"${fmtTaskSnap(t)}`;
            }
            case 'delete_task': {
                const t = a.snapshot;
                if (!t) return `  • [${time}] sildim görev (id=${a.id})`;
                return `  • [${time}] SİLDİM görevi (orig.id=${t.id}): "${t.text}"${fmtTaskSnap(t)}`;
            }
            case 'update_task': {
                const b = a.before, af = a.after;
                if (!b || !af) return `  • [${time}] güncelledim görev (id=${a.id})`;
                const changes = [];
                if (b.text     !== af.text)     changes.push(`metin "${b.text}"→"${af.text}"`);
                if ((b.desc||'') !== (af.desc||'')) changes.push(`açıklama değişti`);
                if ((b.date||'') !== (af.date||'')) changes.push(`tarih ${b.date||'-'}→${af.date||'-'}`);
                if ((b.time||'') !== (af.time||'')) changes.push(`saat ${b.time||'-'}→${af.time||'-'}`);
                if (b.priority !== af.priority) changes.push(`öncelik ${pLabel[b.priority]||b.priority}→${pLabel[af.priority]||af.priority}`);
                if ((b.category||'') !== (af.category||'')) changes.push(`kategori ${b.category||'-'}→${af.category||'-'}`);
                if ((b.reminder ?? null) !== (af.reminder ?? null)) changes.push(`hatırlatıcı ${b.reminder ?? '-'}→${af.reminder ?? '-'}`);
                return `  • [${time}] GÜNCELLEDİM "${af.text}" (id=${af.id}): ${changes.join(', ') || '(değişiklik yok)'}`;
            }
            case 'complete_task':
                return `  • [${time}] ${a.completed ? 'TAMAMLADIM' : 'AKTİFE ALDIM'} görev "${a.text}" (id=${a.id})`;
            case 'create_note': {
                const n = a.snapshot;
                if (!n) return `  • [${time}] oluşturdum bir not`;
                return `  • [${time}] OLUŞTURDUM notu (id=${n.id}): "${n.title}" (${n.type})`;
            }
            case 'delete_note': {
                const n = a.snapshot;
                if (!n) return `  • [${time}] sildim not (id=${a.id})`;
                const contentBlurb = n.type === 'list'
                    ? `[${(n.content || []).map(i => i.text).slice(0, 6).join(', ')}${(n.content || []).length > 6 ? ', …' : ''}]`
                    : `"${String(n.content || '').slice(0, 100)}"`;
                return `  • [${time}] SİLDİM notu (orig.id=${n.id}): "${n.title}" (${n.type}) içerik=${contentBlurb}`;
            }
            default:
                return `  • [${time}] ${a.op}`;
        }
    }).join('\n');
}

// ==========================================
// Tool Execution
// ==========================================

/**
 * Model çıktısı güvenilmez: geçersiz alanları undefined yapar (oluştururken varsayılan,
 * güncellerken "değiştirme" anlamına gelir). Boş string geçerlidir (alanı temizler).
 */
function cleanTaskArgs(a) {
    const valid = (v, ok) => (v === undefined || v === '' || ok(v)) ? v : undefined;
    const str = v => typeof v === 'string';
    return {
        ...a,
        text:     str(a.text) && a.text.trim() ? a.text.trim() : undefined,
        desc:     valid(a.desc, str),
        date:     valid(a.date, v => str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v)),
        time:     valid(a.time, v => str(v) && /^\d{2}:\d{2}$/.test(v)),
        priority: ['low', 'medium', 'high'].includes(a.priority) ? a.priority : undefined,
        category: valid(a.category, v => ['work', 'personal', 'school', 'health'].includes(v)),
        reminder: a.reminder !== undefined && a.reminder !== null && Number(a.reminder) in REMINDER_LABELS
            ? Number(a.reminder) : undefined
    };
}

function executeTool(toolName, args) {
    try {
        if (toolName === 'create_task' || toolName === 'update_task') args = cleanTaskArgs(args);
        switch (toolName) {

            case 'create_task': {
                if (!args.text) return '✗ Görev başlığı gerekli';
                addTask(
                    args.text,
                    args.desc     || '',
                    args.date     || '',
                    args.time     || '',
                    args.priority || 'medium',
                    args.category || '',
                    args.reminder
                );
                // tasks dizisinin en başına eklenir → snapshot tasks[0]
                const created = tasks[0];
                logAIAction({ op: 'create_task', snapshot: created ? { ...created } : null });
                return `✓ Görev oluşturuldu: "${args.text}"`;
            }

            case 'update_task': {
                const task = tasks.find(t => t.id === args.id);
                if (!task) return `✗ Görev bulunamadı (ID: ${args.id})`;
                const before = { ...task };
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
                const after = tasks.find(t => t.id === args.id);
                logAIAction({ op: 'update_task', id: args.id, before, after: after ? { ...after } : null });
                return `✓ Görev güncellendi: "${args.text || task.text}"`;
            }

            case 'complete_task': {
                const task = tasks.find(t => t.id === args.id);
                if (!task) return `✗ Görev bulunamadı (ID: ${args.id})`;
                const done = args.completed === true || args.completed === 'true';
                if (task.completed !== done) toggleTaskStatus(args.id);
                logAIAction({ op: 'complete_task', id: args.id, text: task.text, completed: done });
                return `✓ "${task.text}" → ${done ? 'tamamlandı' : 'aktif yapıldı'}`;
            }

            case 'delete_task': {
                const task = tasks.find(t => t.id === args.id);
                if (!task) return `✗ Görev bulunamadı (ID: ${args.id})`;
                const snapshot = { ...task };  // silmeden ÖNCE tüm veriyi yakala
                const label = task.text;
                deleteTask(args.id, null);
                logAIAction({ op: 'delete_task', id: args.id, snapshot });
                return `✓ Görev silindi: "${label}"`;
            }

            case 'create_note': {
                const title = typeof args.title === 'string' ? args.title.trim() : '';
                if (!title) return '✗ Not başlığı gerekli';
                const type = args.type === 'list' ? 'list' : 'text';
                const content = type === 'list'
                    ? (Array.isArray(args.items) ? args.items : [])
                        .map(i => ({ text: String(i?.text ?? '').trim(), checked: i?.checked === true }))
                        .filter(i => i.text)
                    : String(args.content ?? '');
                addNoteAI(type, title, content);
                const created = notes[0];
                logAIAction({ op: 'create_note', snapshot: created ? { ...created } : null });
                return `✓ Not oluşturuldu: "${args.title}"`;
            }

            case 'delete_note': {
                const before = notes.find(n => n.id === args.id);
                const ok = deleteNoteAI(args.id);
                if (ok && before) {
                    logAIAction({ op: 'delete_note', id: args.id, snapshot: { ...before } });
                }
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
    // İşlem/soru sürerken yüklenirse biten döngü yüklenen sohbetin üzerine yazar
    if (aiIsProcessing) return;
    const session = aiSessions.find(s => s.id === id);
    if (!session) return;

    activeSessionId     = id;
    // Eski sürümün kaydettiği, yetim 'tool' ile başlayan geçmişleri de onarır
    conversationHistory = trimHistory([...session.messages]);

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
        model:       getModel(),
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

/**
 * Son MAX_HISTORY mesajı tutar ama kesimi bir 'user' mesajında başlatır:
 * başta yetim kalan 'tool' / tool_calls mesajları API'de 400 hatasına yol açar.
 */
function trimHistory(msgs) {
    const cut = Math.max(0, msgs.length - MAX_HISTORY);
    let start = msgs.findIndex((m, i) => i >= cut && m.role === 'user');
    if (start === -1) start = msgs.map(m => m.role).lastIndexOf('user');
    return msgs.slice(Math.max(start, 0));
}
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
    homeResultStart(userMessage);
    conversationHistory.push({ role: 'user', content: userMessage });
    showTypingDots();

    try {
        let loopMsgs = [...conversationHistory];
        let finished = false;

        for (let round = 0; round < MAX_TOOL_ROUNDS && !finished; round++) {
            const data = await callOpenRouter([
                { role: 'system', content: buildSystemPrompt() },
                ...loopMsgs
            ]);

            // OpenRouter sağlayıcı hatalarını bazen HTTP 200 + error gövdesiyle döndürür
            const msg = data.choices?.[0]?.message;
            if (!msg) throw new Error(data.error?.message || 'Modelden boş yanıt geldi.');
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
                    homeResultAppend(buildActionChips(actionResults));
                    showTypingDots();
                }
            } else {
                hideTypingDots();
                if (msg.content) appendChatMsg('assistant', msg.content);
                else appendChatMsg('error', 'Model metin yanıtı döndürmedi.');
                homeResultFinish(msg.content || 'Model metin yanıtı döndürmedi.', !msg.content);
                conversationHistory = trimHistory(loopMsgs);
                sessionSaveCurrent();
                finished = true;
            }
        }
        if (!finished) throw new Error(`Model ${MAX_TOOL_ROUNDS} turda yanıtı bitirmedi, işlem durduruldu.`);
    } catch (err) {
        hideTypingDots();
        appendChatMsg('error', `❌ Hata: ${err.message}`);
        homeResultFinish(`Hata: ${err.message}`, true);
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

/** İşlem sonuçlarından (✓/✗ metinleri) rozet listesi üretir — panel ve ana ekran ortak */
function buildActionChips(results) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-actions';
    results.forEach(r => {
        const ok   = r.trim().startsWith('✓');
        const text = r.replace(/^[✓✗]\s*/, '');
        const chip = document.createElement('div');
        chip.className = `ai-action-chip ${ok ? 'ok' : 'fail'}`;
        chip.innerHTML = `<i class="ph ${ok ? 'ph-check-circle' : 'ph-warning-circle'}" aria-hidden="true"></i><span>${escapeHTML(text)}</span>`;
        wrap.appendChild(chip);
    });
    return wrap;
}

/** AI'nın yaptığı işlemleri sohbete rozet olarak ekler */
function appendActionChips(results) {
    if (!results || !results.length) return;
    const box = document.getElementById('ai-chat-messages');
    box.appendChild(buildActionChips(results));
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
            homeResultBusy(true);
            resolve(choice);
        };
        pendingOptionResolve = done;
        const question = args.question || 'Bir seçenek seç:';
        const opts = (Array.isArray(args.options) ? args.options : []).map(String);
        renderOptionButtons(question, opts);
        homeResultAsk(question, opts);
    });
}

/** Seçenek butonları bloğu — panel ve ana ekran ortak */
function buildOptionButtons(options) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-options';
    options.forEach(label => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-option-btn';
        btn.innerHTML = `<i class="ph ph-circle-dashed" aria-hidden="true"></i><span>${escapeHTML(label)}</span>`;
        btn.addEventListener('click', () => answerPendingOption(label));
        wrap.appendChild(btn);
    });
    return wrap;
}

/** Soru metnini + seçenek butonlarını sohbete basar */
function renderOptionButtons(question, options) {
    const box = document.getElementById('ai-chat-messages');
    appendChatMsg('assistant', question);
    box.appendChild(buildOptionButtons(options));
    box.scrollTop = box.scrollHeight;
}

/**
 * Bekleyen soruyu cevaplar (buton ya da yazılan metin, panel ya da ana ekran).
 * Kilitlenmemiş tüm seçenek blokları yalnızca bekleyen soruya aittir.
 */
function answerPendingOption(label) {
    const resolve = pendingOptionResolve;
    if (!resolve) return;
    appendChatMsg('user', label);
    document.querySelectorAll('.ai-options:not(.locked)').forEach(block => {
        block.classList.add('locked');
        block.querySelectorAll('.ai-option-btn').forEach(b => {
            b.disabled = true;
            const chosen = b.querySelector('span')?.textContent === label;
            b.classList.add(chosen ? 'chosen' : 'dimmed');
            if (chosen) b.querySelector('i').className = 'ph ph-check-circle';
        });
    });
    resolve(label);
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
    const spin = '<i class="ph ph-circle-notch ai-spin" aria-hidden="true"></i>';
    const btn = document.getElementById('ai-send-btn');
    if (btn) {
        btn.disabled = busy;
        btn.innerHTML = busy ? spin : '<i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>';
    }
    const homeBtn = document.getElementById('home-ai-send');
    if (homeBtn) {
        homeBtn.disabled = busy;
        homeBtn.innerHTML = busy ? spin : '<i class="ph ph-arrow-up" aria-hidden="true"></i>';
    }
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
        answerPendingOption(msg);
        return;
    }

    if (aiIsProcessing) return;
    input.value = '';
    input.style.height = 'auto';
    sendMessageToAI(msg);
}

// ==========================================
// Ana Ekran Komut Çubuğu
// — sohbet akışını (sendMessageToAI) paylaşır; son etkileşimi
//   çubuğun altındaki sonuç şeridinde özetler
// ==========================================

function homeResultBox() {
    return document.getElementById('home-ai-result');
}

/** Şerit ve öneri çipleri aynı yeri paylaşır */
function homeResultShow(show) {
    homeResultBox()?.classList.toggle('d-none', !show);
    document.getElementById('home-ai-chips')?.classList.toggle('d-none', show);
}

function homeResultStart(query) {
    const box = homeResultBox();
    if (!box) return;
    box.innerHTML = `
        <p class="har-query"><i class="ph ph-chat-circle-dots" aria-hidden="true"></i><span>${escapeHTML(query)}</span></p>
        <p class="har-status"><i class="ph ph-circle-notch ai-spin" aria-hidden="true"></i>Asistan çalışıyor…</p>`;
    homeResultShow(true);
}

/** Durum satırının üstüne ekler — "çalışıyor…" hep en altta kalır */
function homeResultAppend(el) {
    const box = homeResultBox();
    if (!box) return;
    const status = box.querySelector('.har-status');
    if (status) box.insertBefore(el, status);
    else box.appendChild(el);
}

function homeResultBusy(on) {
    homeResultBox()?.querySelector('.har-status')?.classList.toggle('d-none', !on);
}

function homeResultAsk(question, options) {
    const q = document.createElement('p');
    q.className = 'har-question';
    q.textContent = question;
    homeResultAppend(q);
    homeResultAppend(buildOptionButtons(options));
    homeResultBusy(false);
}

/** Son yanıt ya da hata + "Sohbete devam et" / kapat */
function homeResultFinish(text, isError) {
    const box = homeResultBox();
    if (!box) return;
    box.querySelector('.har-status')?.remove();

    const reply = document.createElement('div');
    reply.className = isError ? 'har-reply har-error' : 'har-reply';
    reply.innerHTML = formatMessage(text);
    box.appendChild(reply);

    const actions = document.createElement('div');
    actions.className = 'har-actions';
    actions.innerHTML = `
        <button type="button" class="har-continue"><i class="ph ph-chats-circle" aria-hidden="true"></i>Sohbete devam et</button>
        <button type="button" class="har-close" aria-label="Sonucu kapat"><i class="ph ph-x" aria-hidden="true"></i></button>`;
    actions.querySelector('.har-continue').addEventListener('click', openAIPanel);
    actions.querySelector('.har-close').addEventListener('click', () => homeResultShow(false));
    box.appendChild(actions);
}

function openAIPanel() {
    if (!document.getElementById('ai-chat-panel').classList.contains('open')) toggleAIPanel();
}

/** Ana ekrandan gelen metni işler; metin kullanıldıysa true döner (giriş temizlenir) */
function homeAsk(text) {
    if (pendingOptionResolve) {
        answerPendingOption(text);
        return true;
    }
    if (aiIsProcessing) return false;
    if (!hasApiKey()) {
        // Mobilde anahtar yok: panel anahtar istemini gösterir, metin kutuda kalır
        renderKeyPrompt();
        openAIPanel();
        return false;
    }
    sendMessageToAI(text);
    return true;
}

function renderHomeChips() {
    const wrap = document.getElementById('home-ai-chips');
    if (!wrap) return;
    AI_SUGGESTIONS.forEach(text => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ai-chip';
        chip.textContent = text;
        chip.addEventListener('click', () => homeAsk(text));
        wrap.appendChild(chip);
    });
}

// ==========================================
// Init
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    sessionsLoad();
    historyPanelInject();
    updateModelLabel();
    renderHomeChips();

    // Ana ekran komut çubuğu
    document.getElementById('home-ai-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const input = document.getElementById('home-ai-input');
        const msg = input.value.trim();
        if (msg && homeAsk(msg)) input.value = '';
    });

    // Ayarlar → model arama
    let modelSearchTimer = null;
    document.getElementById('settings-model-search')?.addEventListener('input', () => {
        clearTimeout(modelSearchTimer);
        modelSearchTimer = setTimeout(renderModelPicker, 150);
    });

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
