// JSON yedek: dışa/içe aktarma (#2)
// app.js'ten sonra yüklenir; tasks/notes/taskLog ve save*/render* fonksiyonları oradan gelir.

/** Yedek dosyasını doğrular. Geçersizse hata fırlatır — böylece mevcut veriye hiç dokunulmaz. */
function parseBackup(text) {
    const d = JSON.parse(text);
    const isObjList = a => Array.isArray(a) && a.every(x => x && typeof x === 'object' && !Array.isArray(x));
    if (d?.app !== 'MemorAI'
        || !isObjList(d.tasks) || !d.tasks.every(t => t.id != null && typeof t.text === 'string')
        || !isObjList(d.notes) || !d.notes.every(n => n.id != null)) {
        throw new Error('MemorAI yedek dosyası değil');
    }
    return { tasks: d.tasks, notes: d.notes, taskLog: isObjList(d.taskLog) ? d.taskLog : [] };
}

// shortcut: blob indirme Android WebView'da çalışmaz, yalnızca web; APK için @capacitor/filesystem + paylaş gerekir
function exportBackup() {
    const data = { app: 'MemorAI', version: 1, exportedAt: new Date().toISOString(), tasks, notes, taskLog };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `memorai-yedek-${localDateStr(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Yedek indirildi');
}

async function importBackup(file) {
    let data;
    try {
        data = parseBackup(await file.text());
    } catch {
        showToast('Geçersiz yedek dosyası — mevcut veri korundu');
        return;
    }
    const summary = `${data.tasks.length} görev, ${data.notes.length} not, ${data.taskLog.length} geçmiş kaydı`;
    if (!confirm(`${summary} içe aktarılsın mı?\nMevcut veri bunlarla değiştirilecek.`)) return;

    tasks.forEach(t => cancelTaskReminder(t.id));
    tasks = data.tasks;
    notes = data.notes;
    taskLog = data.taskLog;
    saveTasks();
    saveNotes();
    saveTaskLog();
    renderTasks();
    renderNotes();
    syncAllReminders();
    showToast(`İçe aktarıldı: ${summary}`);
}

if (typeof module !== 'undefined') {
    module.exports = { parseBackup }; // node --test için
} else {
    const fileInput = document.getElementById('settings-import-file');
    document.getElementById('settings-export').addEventListener('click', exportBackup);
    document.getElementById('settings-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        fileInput.value = ''; // aynı dosya tekrar seçilebilsin
        if (file) importBackup(file);
    });
}
