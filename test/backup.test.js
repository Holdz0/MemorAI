const test = require('node:test');
const assert = require('node:assert');
const { parseBackup } = require('../www/js/backup.js');

const valid = {
    app: 'MemorAI',
    version: 1,
    tasks: [{ id: 't1', text: 'Rapor yaz', completed: false }],
    notes: [{ id: 'n1', title: 'Fikir', content: '' }],
    taskLog: [{ logId: 'log_1', text: 'Eski görev' }]
};

test('geçerli yedek aynen okunur', () => {
    assert.deepStrictEqual(parseBackup(JSON.stringify(valid)), {
        tasks: valid.tasks, notes: valid.notes, taskLog: valid.taskLog
    });
});

test('taskLog yoksa boş liste döner', () => {
    const { taskLog, ...noLog } = valid;
    assert.deepStrictEqual(parseBackup(JSON.stringify(noLog)).taskLog, []);
});

test('bozuk veya başka dosyalar reddedilir (mevcut veri korunur)', () => {
    const bad = [
        '{bozuk',
        'null',
        '[]',
        JSON.stringify({ ...valid, app: 'Baska' }),
        JSON.stringify({ ...valid, tasks: 'x' }),
        JSON.stringify({ ...valid, tasks: [{ id: 't1' }] }),       // text yok
        JSON.stringify({ ...valid, tasks: [null] }),
        JSON.stringify({ ...valid, notes: [{ title: 'id yok' }] })
    ];
    for (const text of bad) assert.throws(() => parseBackup(text), text);
});
