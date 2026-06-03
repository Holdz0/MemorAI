// State
let tasks = JSON.parse(localStorage.getItem('agenda_tasks')) || [];
let notes = JSON.parse(localStorage.getItem('agenda_notes')) || [];
let currentFilter = 'all';
let currentWeekOffset = 0;
let editingTaskId = null;
let editingNoteId = null;
let searchQuery = '';
let currentSort = 'default';
let pendingDeleteTask = null;
let undoTimeout = null;

// DOM Elements
const timeDisplay = document.getElementById('time-display');
const greetingText = document.getElementById('greeting-text');
const currentMonth = document.getElementById('current-month');
const currentYear = document.getElementById('current-year');
const currentDay = document.getElementById('current-day');
const currentDayName = document.getElementById('current-day-name');

const openModalBtn = document.getElementById('open-modal-btn');
const taskModal = document.getElementById('task-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const modalTaskForm = document.getElementById('modal-task-form');
const modalTaskTitle = document.getElementById('modal-task-title');
const modalTaskDesc = document.getElementById('modal-task-desc');
const modalTaskDate = document.getElementById('modal-task-date');
const modalTaskTime = document.getElementById('modal-task-time');
const modalTitle = document.getElementById('modal-title');

const taskDetailsModal = document.getElementById('task-details-modal');
const closeDetailsBtn = document.getElementById('close-details-btn');
const detailsTitle = document.getElementById('details-title');
const detailsPriority = document.getElementById('details-priority');
const detailsDate = document.getElementById('details-date');
const detailsTime = document.getElementById('details-time');
const detailsDesc = document.getElementById('details-desc');
const detailsDeleteBtn = document.getElementById('details-delete-btn');
const detailsEditBtn = document.getElementById('details-edit-btn');
const tasksContainer = document.getElementById('tasks-container');
const weeklyContainer = document.getElementById('weekly-container');
const weeklyGridContainer = document.getElementById('weekly-grid-container');
const prevWeekBtn = document.getElementById('prev-week-btn');
const nextWeekBtn = document.getElementById('next-week-btn');
const todayWeekBtn = document.getElementById('today-week-btn');
const weeklyRangeLabel = document.getElementById('weekly-range-label');
const emptyState = document.getElementById('empty-state');

const viewTabs = document.querySelectorAll('.view-tab');

const tasksLeftCount = document.getElementById('tasks-left-count');
const taskProgress = document.getElementById('task-progress');
const filterBtns = document.querySelectorAll('.filter-btn');

// Notes DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const appViews = document.querySelectorAll('.app-view');
const notesContainer = document.getElementById('notes-container');
const openNoteTypeBtn = document.getElementById('open-note-type-btn');
const noteTypeModal = document.getElementById('note-type-modal');
const closeNoteTypeBtn = document.getElementById('close-note-type-btn');
const typeOptionBtns = document.querySelectorAll('.type-option-btn');

const noteFormModal = document.getElementById('note-form-modal');
const closeNoteFormBtn = document.getElementById('close-note-form-btn');
const cancelNoteFormBtn = document.getElementById('cancel-note-form-btn');
const modalNoteForm = document.getElementById('modal-note-form');
const noteModalTitle = document.getElementById('note-modal-title');
const noteTypeInput = document.getElementById('note-type-input');
const noteTitleInput = document.getElementById('note-title');
const noteTextAreaGroup = document.getElementById('note-text-area');
const noteContentText = document.getElementById('note-content-text');
const noteListAreaGroup = document.getElementById('note-list-area');
const noteListItemsContainer = document.getElementById('note-list-items');
const addListItemBtn = document.getElementById('add-list-item-btn');
const noteDeleteBtn = document.getElementById('note-delete-btn');

// ==========================================
// Initialization
// ==========================================
function init() {
    updateDateTime();
    setInterval(updateDateTime, 1000); // Update clock every second
    renderTasks();
    renderNotes();
    updateStats();
}

// ==========================================
// Date & Time Logic
// ==========================================
function updateDateTime() {
    const now = new Date();
    
    // Time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeDisplay.textContent = `${hours}:${minutes}`;
    
    // Greeting based on time
    const h = now.getHours();
    let greeting = 'İyi Akşamlar';
    if (h >= 5 && h < 12) greeting = 'Günaydın';
    else if (h >= 12 && h < 18) greeting = 'Tünaydın';
    
    // Assuming user name is Taha based on requested path
    greetingText.textContent = `${greeting}, Taha.`;

    // Date
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    
    currentMonth.textContent = months[now.getMonth()];
    currentYear.textContent = now.getFullYear();
    currentDay.textContent = String(now.getDate()).padStart(2, '0');
    currentDayName.textContent = days[now.getDay()];

    // Mobile greeting meta — date label
    const mgmDate = document.getElementById('mgm-date');
    if (mgmDate) {
        mgmDate.textContent = `${now.getDate()} ${months[now.getMonth()]} · ${days[now.getDay()]}`;
    }
}

// ==========================================
// Task Logic
// ==========================================
function saveTasks() {
    localStorage.setItem('agenda_tasks', JSON.stringify(tasks));
    updateStats();
}

function addTask(title, descStr, dateStr, timeStr, priorityStr, categoryStr) {
    const newTask = {
        id: Date.now().toString(),
        text: title,
        desc: descStr || null,
        date: dateStr || null,
        time: timeStr || null,
        priority: priorityStr || 'medium',
        category: categoryStr || null,
        completed: false,
        createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    saveTasks();
    renderTasks();
}

function updateTask(id, title, descStr, dateStr, timeStr, priorityStr, categoryStr) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
        tasks[taskIndex].text = title;
        tasks[taskIndex].desc = descStr || null;
        tasks[taskIndex].date = dateStr || null;
        tasks[taskIndex].time = timeStr || null;
        tasks[taskIndex].priority = priorityStr || 'medium';
        tasks[taskIndex].category = categoryStr || null;
        saveTasks();
        renderTasks();
    }
}

function toggleTaskStatus(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
        tasks[taskIndex].completed = !tasks[taskIndex].completed;
        saveTasks();
        renderTasks();
    }
}

function deleteTask(id, element = null) {
    const taskToDelete = tasks.find(t => t.id === id);

    const doDelete = () => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
        if (taskToDelete) showUndoToast(taskToDelete);
    };

    if (element) {
        element.classList.add('deleting');
        setTimeout(doDelete, 300);
    } else {
        doDelete();
    }
}

function showUndoToast(deletedTask) {
    if (undoTimeout) clearTimeout(undoTimeout);
    pendingDeleteTask = deletedTask;

    const toast = document.getElementById('undo-toast');
    toast.classList.remove('d-none');
    // Trigger reflow for animation
    void toast.offsetWidth;
    toast.classList.add('visible');

    undoTimeout = setTimeout(() => hideUndoToast(false), 5000);
}

function hideUndoToast(restore = false) {
    if (undoTimeout) clearTimeout(undoTimeout);
    undoTimeout = null;

    const toast = document.getElementById('undo-toast');
    toast.classList.remove('visible');

    if (restore && pendingDeleteTask) {
        tasks.unshift(pendingDeleteTask);
        saveTasks();
        renderTasks();
    }

    pendingDeleteTask = null;
    setTimeout(() => toast.classList.add('d-none'), 300);
}

// ==========================================
// Filtering & Stats
// ==========================================
filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Update active class
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update filter state and render
        currentFilter = e.target.getAttribute('data-filter');
        renderTasks();
    });
});

function getFilteredTasks() {
    let result;
    switch(currentFilter) {
        case 'active': result = tasks.filter(t => !t.completed); break;
        case 'completed': result = tasks.filter(t => t.completed); break;
        default: result = [...tasks];
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(t =>
            t.text.toLowerCase().includes(q) ||
            (t.desc && t.desc.toLowerCase().includes(q))
        );
    }

    switch(currentSort) {
        case 'date-asc':
            result.sort((a, b) => {
                if (!a.date && !b.date) return 0;
                if (!a.date) return 1;
                if (!b.date) return -1;
                return a.date.localeCompare(b.date);
            });
            break;
        case 'date-desc':
            result.sort((a, b) => {
                if (!a.date && !b.date) return 0;
                if (!a.date) return 1;
                if (!b.date) return -1;
                return b.date.localeCompare(a.date);
            });
            break;
        case 'priority': {
            const order = { high: 0, medium: 1, low: 2 };
            result.sort((a, b) => order[a.priority] - order[b.priority]);
            break;
        }
        case 'name':
            result.sort((a, b) => a.text.localeCompare(b.text, 'tr'));
            break;
    }

    return result;
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    const progressPercentage = total === 0 ? 0 : (completed / total) * 100;

    // Desktop widgets
    tasksLeftCount.textContent = active;
    taskProgress.style.width = `${progressPercentage}%`;

    // Mobile greeting meta
    const mgmLeft = document.getElementById('mgm-tasks-left');
    const mgmFill = document.getElementById('mgm-fill');
    if (mgmLeft) mgmLeft.textContent = active;
    if (mgmFill) mgmFill.style.width = `${progressPercentage}%`;
}

// ==========================================
// Rendering
// ==========================================
function renderTasks() {
    const filteredTasks = getFilteredTasks();
    
    // Clear current container except empty state
    tasksContainer.innerHTML = '';
    
    if (filteredTasks.length === 0) {
        // Show empty state
        const emptyMsg = currentFilter === 'completed' 
            ? 'Henüz tamamlanmış görev yok.' 
            : currentFilter === 'active' 
                ? 'Tüm görevler tamamlandı!' 
                : 'Şu an için hiç görevin yok. Rahatına bak!';
                
        tasksContainer.innerHTML = `
            <div class="empty-state" id="empty-state">
                <i class="ph-duotone ${currentFilter === 'active' ? 'ph-confetti' : 'ph-coffee'}"></i>
                <p>${emptyMsg}</p>
            </div>
        `;
        return;
    }
    
    // Create and append task elements
    filteredTasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
        taskEl.setAttribute('data-id', task.id);
        
        const categoryLabels = { work: 'İş', personal: 'Kişisel', school: 'Okul', health: 'Sağlık' };

        let badgeHTML = '';
        if (task.date || task.time) {
            badgeHTML = `
                <span class="task-badge">
                    <i class="ph ph-calendar-blank"></i>
                    ${escapeHTML(task.date || '')} ${escapeHTML(task.time || '')}
                </span>
            `;
        }

        const categoryBadge = task.category && categoryLabels[task.category]
            ? `<span class="category-tag ${task.category}">${categoryLabels[task.category]}</span>`
            : '';

        let metaHTML = '';
        if (task.desc || badgeHTML || categoryBadge) {
            metaHTML = `
                <div class="task-meta">
                    ${badgeHTML}
                    ${categoryBadge}
                </div>
                ${task.desc ? `<span class="task-desc-text">${escapeHTML(task.desc).replace(/\\n/g, '<br>')}</span>` : ''}
            `;
        }
        
        taskEl.innerHTML = `
            <div class="task-content">
                <label class="task-checkbox-container">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <div class="checkbox-custom">
                        <i class="ph-bold ph-check"></i>
                    </div>
                </label>
                <div class="task-info">
                    <span class="task-text"><span class="priority-dot ${task.priority}"></span>${escapeHTML(task.text)}</span>
                    ${metaHTML}
                </div>
            </div>
            <button class="delete-btn" aria-label="Görevi Sil">
                <i class="ph ph-trash"></i>
            </button>
        `;
        
        // Event Listeners for created elements
        const checkbox = taskEl.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => toggleTaskStatus(task.id));
        
        const deleteBtn = taskEl.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteTask(task.id, taskEl));
        
        taskEl.addEventListener('click', (e) => {
            if (!e.target.closest('.task-checkbox-container') && !e.target.closest('.delete-btn')) {
                openDetailsModal(task.id);
            }
        });
        
        tasksContainer.appendChild(taskEl);
    });
    
    // Also update weekly view if it's currently active, or just update it anyway
    if (!weeklyContainer.classList.contains('d-none')) {
        renderWeeklyView();
    }
}

// Security utility to prevent XSS
function escapeHTML(str) {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
}

// ==========================================
// Event Listeners
// ==========================================
// ==========================================
// Modal Logic
// ==========================================
function openModal(isEdit = false) {
    taskModal.classList.remove('d-none');
    modalTitle.textContent = isEdit ? "Görevi Düzenle" : "Yeni Görev Tanımla";
    setTimeout(() => modalTaskTitle.focus(), 100);
}

function closeModal() {
    taskModal.classList.add('d-none');
    modalTaskForm.reset();
    editingTaskId = null;
    const defaultPriority = modalTaskForm.querySelector('input[name="task-priority"][value="medium"]');
    if (defaultPriority) defaultPriority.checked = true;
    const defaultCategory = modalTaskForm.querySelector('input[name="task-category"][value=""]');
    if (defaultCategory) defaultCategory.checked = true;
}

function openDetailsModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if(!task) return;
    
    const categoryLabels = { work: 'İş', personal: 'Kişisel', school: 'Okul', health: 'Sağlık' };

    detailsTitle.textContent = task.text;
    detailsDesc.textContent = task.desc || "Açıklama bulunmuyor.";
    detailsDate.textContent = task.date || "-";
    detailsTime.textContent = task.time || "-";

    const catRow = document.getElementById('details-category-row');
    const catSpan = document.getElementById('details-category');
    if (task.category && categoryLabels[task.category]) {
        catSpan.textContent = categoryLabels[task.category];
        catSpan.className = `category-tag ${task.category}`;
        catRow.classList.remove('d-none');
    } else {
        catRow.classList.add('d-none');
    }

    const priorityMap = { 'low': 'Düşük', 'medium': 'Orta', 'high': 'Yüksek' };
    detailsPriority.textContent = priorityMap[task.priority] || 'Orta';
    detailsPriority.className = `priority-badge ${task.priority}`;

    taskDetailsModal.classList.remove('d-none');

    detailsEditBtn.onclick = () => {
        closeDetailsModal();
        editingTaskId = taskId;
        modalTaskTitle.value = task.text;
        modalTaskDesc.value = task.desc || '';
        modalTaskDate.value = task.date || '';
        modalTaskTime.value = task.time || '';

        const priorityRadio = modalTaskForm.querySelector(`input[name="task-priority"][value="${task.priority}"]`);
        if (priorityRadio) priorityRadio.checked = true;

        const categoryVal = task.category || '';
        const categoryRadio = modalTaskForm.querySelector(`input[name="task-category"][value="${categoryVal}"]`);
        if (categoryRadio) categoryRadio.checked = true;

        openModal(true);
    };

    detailsDeleteBtn.onclick = () => {
        const row = document.querySelector(`.task-item[data-id="${taskId}"]`);
        deleteTask(taskId, row);
        closeDetailsModal();
    };
}

function closeDetailsModal() {
    taskDetailsModal.classList.add('d-none');
}

openModalBtn.addEventListener('click', () => openModal(false));
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
closeDetailsBtn.addEventListener('click', closeDetailsModal);

// Close on background click
taskModal.addEventListener('click', (e) => {
    if (e.target === taskModal) closeModal();
});
taskDetailsModal.addEventListener('click', (e) => {
    if (e.target === taskDetailsModal) closeDetailsModal();
});

modalTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = modalTaskTitle.value.trim();
    const desc = modalTaskDesc.value.trim();
    const dateVal = modalTaskDate.value;
    const timeVal = modalTaskTime.value;
    const priorityRadio = modalTaskForm.querySelector('input[name="task-priority"]:checked');
    const priorityVal = priorityRadio ? priorityRadio.value : 'medium';
    
    const categoryRadio = modalTaskForm.querySelector('input[name="task-category"]:checked');
    const categoryVal = categoryRadio ? categoryRadio.value : '';

    if (title) {
        if (editingTaskId) {
            updateTask(editingTaskId, title, desc, dateVal, timeVal, priorityVal, categoryVal);
        } else {
            addTask(title, desc, dateVal, timeVal, priorityVal, categoryVal);
        }
        closeModal();
        
        if (currentFilter === 'completed') {
            document.querySelector('[data-filter="all"]').click();
        }
    }
});

// ==========================================
// View Tabs & Weekly View
// ==========================================
viewTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        viewTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const view = e.target.getAttribute('data-view');
        if (view === 'list') {
            tasksContainer.classList.remove('d-none');
            weeklyContainer.classList.add('d-none');
        } else {
            tasksContainer.classList.add('d-none');
            weeklyContainer.classList.remove('d-none');
            renderWeeklyView();
        }
    });
});

function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6: 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}

function renderWeeklyView() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const currentMonday = getMonday(today);
    
    // Apply offset to get the center week
    const targetMonday = new Date(currentMonday);
    targetMonday.setDate(currentMonday.getDate() + (currentWeekOffset * 7));
    
    // Calculate start of 5-week block (-2 weeks)
    const blockStart = new Date(targetMonday);
    blockStart.setDate(targetMonday.getDate() - 14);
    
    let headerHTML = '';
    let gridHTML = '';
    
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    
    // Array of dates for 35 days (5 weeks)
    const weekDates = [];
    for(let i=0; i<35; i++) {
        let currentDay = new Date(blockStart);
        currentDay.setDate(blockStart.getDate() + i);
        weekDates.push(currentDay);
        
        const isToday = currentDay.getTime() === today.getTime();
        const dateStr = currentDay.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
        const fullDateStr = currentDay.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        
        headerHTML += `
            <div class="weekly-day-header ${isToday ? 'today' : ''}" data-index="${i}" data-full-date="${fullDateStr}">
                <div>${days[i % 7]}</div>
                <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 2px;">${dateStr}</div>
            </div>
        `;
    }
    
    // Initial Label Update (Target week is indices 14 to 20)
    const startStr = weekDates[14].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    const endStr = weekDates[20].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    weeklyRangeLabel.textContent = `${startStr} - ${endStr}`;
    
    // Map tasks to columns
    for(let i=0; i<35; i++) {
        const currentDate = weekDates[i];
        const offset = currentDate.getTimezoneOffset()
        const targetDateStr = new Date(currentDate.getTime() - (offset*60*1000)).toISOString().split('T')[0];
        
        const dayTasks = tasks.filter(t => t.date === targetDateStr);
        
        dayTasks.sort((a, b) => {
            if(!a.time && !b.time) return 0;
            if(!a.time) return 1;
            if(!b.time) return -1;
            return a.time.localeCompare(b.time);
        });
        
        let tasksHTML = dayTasks.map(t => `
            <div class="mini-task ${t.completed ? 'completed' : ''}" data-id="${t.id}">
                ${t.time ? `<span class="mini-task-time">${t.time}</span>` : ''}
                <span><span class="priority-dot ${t.priority}"></span>${escapeHTML(t.text)}</span>
            </div>
        `).join('');
        
        if(dayTasks.length === 0) {
            tasksHTML = `<div style="opacity: 0.3; text-align: center; font-size: 0.8rem; padding-top: 10px;">Yok</div>`;
        }
        
        gridHTML += `<div class="weekly-day-col">${tasksHTML}</div>`;
    }
    
    weeklyGridContainer.innerHTML = `
        <div class="weekly-scroll-area">
            <div class="weekly-header">${headerHTML}</div>
            <div class="weekly-grid">${gridHTML}</div>
        </div>
    `;
    
    // Auto-scroll to center week (Week 3)
    setTimeout(() => {
        const scrollArea = weeklyGridContainer.querySelector('.weekly-scroll-area');
        if(scrollArea) {
            const weekWidth = scrollArea.scrollWidth / 5;
            weeklyGridContainer.scrollLeft = weekWidth * 2;
        }
    }, 10);
}

// Navigation event listeners
prevWeekBtn.addEventListener('click', () => {
    currentWeekOffset--;
    renderWeeklyView();
});

nextWeekBtn.addEventListener('click', () => {
    currentWeekOffset++;
    renderWeeklyView();
});

todayWeekBtn.addEventListener('click', () => {
    currentWeekOffset = 0;
    renderWeeklyView();
});

// Drag to Scroll Events
let isDown = false;
let startX;
let scrollLeft;

weeklyGridContainer.addEventListener('mousedown', (e) => {
    isDown = true;
    weeklyGridContainer.classList.add('grabbing');
    startX = e.pageX - weeklyGridContainer.offsetLeft;
    scrollLeft = weeklyGridContainer.scrollLeft;
});
weeklyGridContainer.addEventListener('mouseleave', () => {
    isDown = false;
    weeklyGridContainer.classList.remove('grabbing');
});
weeklyGridContainer.addEventListener('mouseup', () => {
    isDown = false;
    weeklyGridContainer.classList.remove('grabbing');
});
weeklyGridContainer.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - weeklyGridContainer.offsetLeft;
    const walk = (x - startX) * 1.5; // scroll speed multiplier
    weeklyGridContainer.scrollLeft = scrollLeft - walk;
});

// Scroll Event to Update Header Label
weeklyGridContainer.addEventListener('scroll', () => {
    const scrollArea = weeklyGridContainer.querySelector('.weekly-scroll-area');
    if(!scrollArea) return;
    
    const weekWidth = scrollArea.scrollWidth / 5;
    let visibleWeekIndex = Math.round(weeklyGridContainer.scrollLeft / weekWidth);
    if(visibleWeekIndex < 0) visibleWeekIndex = 0;
    if(visibleWeekIndex > 4) visibleWeekIndex = 4;
    
    const startHeader = scrollArea.querySelector(`.weekly-day-header[data-index="${visibleWeekIndex * 7}"]`);
    const endHeader = scrollArea.querySelector(`.weekly-day-header[data-index="${visibleWeekIndex * 7 + 6}"]`);
    
    if (startHeader && endHeader) {
        weeklyRangeLabel.textContent = `${startHeader.getAttribute('data-full-date')} - ${endHeader.getAttribute('data-full-date')}`;
    }
});

// Click Delegation for Mini Tasks
weeklyGridContainer.addEventListener('click', (e) => {
    // If we were dragging, don't trigger click
    if(isDown) return; 
    
    const miniTask = e.target.closest('.mini-task');
    if (miniTask) {
        const taskId = miniTask.getAttribute('data-id');
        if(taskId) openDetailsModal(taskId);
    }
});

// ==========================================
// App Navigation
// ==========================================
navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        navTabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');

        const targetView = e.currentTarget.getAttribute('data-target');
        appViews.forEach(view => {
            if (view.id === targetView) {
                view.classList.remove('d-none');
            } else {
                view.classList.add('d-none');
            }
        });

        if (targetView === 'notes-view') {
            renderNotes();
            syncMobileNav('notes');
        } else {
            if (!weeklyContainer.classList.contains('d-none')) {
                renderWeeklyView();
            }
            syncMobileNav('tasks');
        }
    });
});

// ==========================================
// Notes Logic
// ==========================================
function saveNotes() {
    localStorage.setItem('agenda_notes', JSON.stringify(notes));
}

function renderNotes() {
    notesContainer.innerHTML = '';
    
    if (notes.length === 0) {
        notesContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; margin-top: 50px;">
                <i class="ph-duotone ph-notebook"></i>
                <p>Henüz not eklemediniz.</p>
            </div>
        `;
        return;
    }
    
    notes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.setAttribute('data-id', note.id);
        
        const dateStr = new Date(note.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
        const iconClass = note.type === 'list' ? 'ph-list-checks' : 'ph-text-align-left';
        
        let previewHTML = '';
        if (note.type === 'text') {
            previewHTML = `<div class="note-card-preview">${escapeHTML(note.content || '')}</div>`;
        } else if (note.type === 'list') {
            const listItems = note.content || [];
            const previewItems = listItems.slice(0, 4).map(item => `
                <div class="preview-list-item ${item.checked ? 'checked' : ''}">
                    <i class="ph ${item.checked ? 'ph-check-square' : 'ph-square'}"></i>
                    <span>${escapeHTML(item.text)}</span>
                </div>
            `).join('');
            const moreIndicator = listItems.length > 4 ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">+${listItems.length - 4} öğe daha</div>` : '';
            previewHTML = `<div class="note-card-list-preview">${previewItems}${moreIndicator}</div>`;
        }
        
        card.innerHTML = `
            <div class="note-card-header">
                <div>
                    <h3 class="note-card-title">${escapeHTML(note.title)}</h3>
                    <span class="note-card-date">${dateStr}</span>
                </div>
                <div class="note-card-icon"><i class="ph ${iconClass}"></i></div>
            </div>
            ${previewHTML}
        `;
        
        card.addEventListener('click', () => openNoteFormModal(note.type, true, note.id));
        notesContainer.appendChild(card);
    });
}

function openNoteTypeModal() {
    noteTypeModal.classList.remove('d-none');
}

function closeNoteTypeModal() {
    noteTypeModal.classList.add('d-none');
}

function createListItemInput(text = '', checked = false) {
    const row = document.createElement('div');
    row.className = 'note-list-item-row';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'list-item-check';
    checkbox.checked = checked;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'list-item-text';
    input.value = text;
    input.placeholder = 'Liste öğesi...';
    
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'remove-list-item-btn';
    delBtn.innerHTML = '<i class="ph ph-x"></i>';
    delBtn.onclick = () => row.remove();
    
    row.appendChild(checkbox);
    row.appendChild(input);
    row.appendChild(delBtn);
    
    return row;
}

function openNoteFormModal(type, isEdit = false, noteId = null) {
    closeNoteTypeModal();
    noteFormModal.classList.remove('d-none');
    modalNoteForm.reset();
    noteListItemsContainer.innerHTML = '';
    editingNoteId = isEdit ? noteId : null;
    noteTypeInput.value = type;
    
    noteModalTitle.textContent = isEdit ? "Notu Düzenle" : "Yeni Not Ekle";
    
    if (type === 'text') {
        noteTextAreaGroup.classList.remove('d-none');
        noteListAreaGroup.classList.add('d-none');
    } else {
        noteTextAreaGroup.classList.add('d-none');
        noteListAreaGroup.classList.remove('d-none');
        if (!isEdit) {
            noteListItemsContainer.appendChild(createListItemInput());
        }
    }
    
    if (isEdit && noteId) {
        noteDeleteBtn.classList.remove('d-none');
        const note = notes.find(n => n.id === noteId);
        if (note) {
            noteTitleInput.value = note.title;
            if (type === 'text') {
                noteContentText.value = note.content;
            } else if (type === 'list') {
                note.content.forEach(item => {
                    noteListItemsContainer.appendChild(createListItemInput(item.text, item.checked));
                });
            }
        }
    } else {
        noteDeleteBtn.classList.add('d-none');
    }
    
    setTimeout(() => noteTitleInput.focus(), 100);
}

function closeNoteFormModal() {
    noteFormModal.classList.add('d-none');
    editingNoteId = null;
}

// Event Listeners for Notes
openNoteTypeBtn.addEventListener('click', openNoteTypeModal);
closeNoteTypeBtn.addEventListener('click', closeNoteTypeModal);
noteTypeModal.addEventListener('click', (e) => { if (e.target === noteTypeModal) closeNoteTypeModal(); });

typeOptionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        openNoteFormModal(type);
    });
});

closeNoteFormBtn.addEventListener('click', closeNoteFormModal);
cancelNoteFormBtn.addEventListener('click', closeNoteFormModal);
noteFormModal.addEventListener('click', (e) => { if (e.target === noteFormModal) closeNoteFormModal(); });

addListItemBtn.addEventListener('click', () => {
    noteListItemsContainer.appendChild(createListItemInput());
    const inputs = noteListItemsContainer.querySelectorAll('.list-item-text');
    if(inputs.length > 0) inputs[inputs.length - 1].focus();
});

noteDeleteBtn.addEventListener('click', () => {
    if(editingNoteId) {
        notes = notes.filter(n => n.id !== editingNoteId);
        saveNotes();
        renderNotes();
        closeNoteFormModal();
    }
});

modalNoteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = noteTitleInput.value.trim();
    if (!title) return;
    
    const type = noteTypeInput.value;
    let content = null;
    
    if (type === 'text') {
        content = noteContentText.value.trim();
    } else if (type === 'list') {
        content = [];
        const rows = noteListItemsContainer.querySelectorAll('.note-list-item-row');
        rows.forEach(row => {
            const text = row.querySelector('.list-item-text').value.trim();
            const checked = row.querySelector('.list-item-check').checked;
            if (text) {
                content.push({ text, checked });
            }
        });
    }
    
    if (editingNoteId) {
        const idx = notes.findIndex(n => n.id === editingNoteId);
        if (idx > -1) {
            notes[idx].title = title;
            notes[idx].content = content;
        }
    } else {
        notes.unshift({
            id: Date.now().toString(),
            type,
            title,
            content,
            createdAt: new Date().toISOString()
        });
    }
    
    saveNotes();
    renderNotes();
    closeNoteFormModal();
});

// ==========================================
// Search, Sort & Undo Event Listeners
// ==========================================
document.getElementById('task-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    document.getElementById('clear-search-btn').classList.toggle('d-none', !searchQuery);
    renderTasks();
});

document.getElementById('clear-search-btn').addEventListener('click', () => {
    document.getElementById('task-search').value = '';
    searchQuery = '';
    document.getElementById('clear-search-btn').classList.add('d-none');
    renderTasks();
});

document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderTasks();
});

document.getElementById('undo-btn').addEventListener('click', () => {
    hideUndoToast(true);
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && pendingDeleteTask) {
        e.preventDefault();
        hideUndoToast(true);
    }
});

// ==========================================
// ==========================================
// Mobile Bottom Navigation
// ==========================================

/** Mobile nav active state senkronizasyonu */
function syncMobileNav(target) {
    document.querySelectorAll('[data-mbn]').forEach(btn => {
        const t = btn.getAttribute('data-mbn');
        if (t !== 'ai') {
            btn.classList.toggle('active', t === target);
        }
    });
}

// Mobile nav item clicks
document.querySelectorAll('[data-mbn]').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-mbn');

        if (target === 'ai') {
            // AI panel — delegated to ai.js
            if (typeof toggleAIPanel === 'function') toggleAIPanel();
            return;
        }

        // Update mobile nav active state
        syncMobileNav(target);

        // Trigger the corresponding top-nav tab
        const topTab = document.querySelector(`.nav-tab[data-target="${target}-view"]`);
        if (topTab) topTab.click();
    });
});

// FAB → open add-task modal
document.getElementById('mbn-fab')?.addEventListener('click', () => openModal(false));

// ==========================================
// AI Helper Functions (used by ai.js)
// ==========================================

/** Yeni not oluşturur ve render eder — ai.js tarafından çağrılır */
function addNoteAI(type, title, content) {
    const newNote = {
        id: Date.now().toString(),
        type,
        title,
        content,
        createdAt: new Date().toISOString()
    };
    notes.unshift(newNote);
    saveNotes();
    renderNotes();
}

/** Notu ID'ye göre siler — ai.js tarafından çağrılır */
function deleteNoteAI(id) {
    const exists = notes.some(n => n.id === id);
    if (!exists) return false;
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();
    return true;
}

// Boot app
document.addEventListener('DOMContentLoaded', init);
