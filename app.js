/* ============================================
   app.js — TaskFlow Application Logic
   ============================================ */

// --- State ---
let tasks = [];
let currentFilter = 'all';
let currentSort = 'date-added';
let currentSearch = '';
let activeTagFilter = null;
let editingTaskId = null;
let draggedTaskId = null;
let pendingDelete = null; // { task, index, timeoutId }

// --- Datepicker State ---
let pickerDate = new Date();
let selectedDate = null;

// --- XSS Protection ---
function escapeHTML(str) {
   const div = document.createElement('div');
   div.textContent = str;
   return div.innerHTML;
}

// --- DOM References ---
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const prioritySelect = document.getElementById('priority-select');
const deadlineDisplay = document.getElementById('deadline-display');
const deadlineInput = document.getElementById('deadline-input');
const detailsInput = document.getElementById('details-input');
const tagsInput = document.getElementById('tags-input');
const taskList = document.getElementById('task-list');
const filtersContainer = document.getElementById('filters');
const filterButtons = document.querySelectorAll('.filters__button');
const sortSelect = document.getElementById('sort-select');
const taskCountLabel = document.getElementById('task-count');
const clearCompletedBtn = document.getElementById('clear-completed');
const searchInput = document.getElementById('search-input');
const tagFiltersContainer = document.getElementById('tag-filters');
const deadlineClearBtn = document.getElementById('deadline-clear');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// Calendar
const calendarPicker = document.getElementById('calendar-picker');
const calendarTitle = document.getElementById('calendar-title');
const calendarDaysGrid = document.getElementById('calendar-days');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const timeInput = document.getElementById('calendar-time-input');
const confirmDeadlineBtn = document.getElementById('confirm-deadline');

// Theme
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// Modal
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

// Toast
const toastContainer = document.getElementById('toast-container');

// Export/Import
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');

// Shortcuts
const shortcutsBtn = document.getElementById('shortcuts-btn');

// ============================================
// 1. Storage
// ============================================
function saveTasks() {
   localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

function loadTasks() {
   const saved = localStorage.getItem('taskflow_tasks');
   if (saved) {
      tasks = JSON.parse(saved);
      // Migrate old numeric IDs to UUIDs
      let migrated = false;
      tasks.forEach(t => {
         if (typeof t.id === 'number') {
            t.createdAt = t.id;
            t.id = crypto.randomUUID();
            migrated = true;
         }
         if (!t.createdAt) { t.createdAt = Date.now(); migrated = true; }
         if (!t.tags) { t.tags = []; migrated = true; }
         if (!t.subtasks) { t.subtasks = []; migrated = true; }
         if (t.order === undefined) { t.order = 0; migrated = true; }
      });
      if (migrated) saveTasks();
   }
}

// ============================================
// 2. Toast System
// ============================================
function showToast(message, actionLabel, callback, duration = 5000) {
   const toast = document.createElement('div');
   toast.className = 'toast toast--show';
   toast.innerHTML = `
      <span class="toast__message">${escapeHTML(message)}</span>
      ${actionLabel ? `<button class="toast__action">${escapeHTML(actionLabel)}</button>` : ''}
   `;
   toastContainer.appendChild(toast);

   let timeoutId = setTimeout(() => removeToast(toast), duration);

   if (actionLabel && callback) {
      toast.querySelector('.toast__action').addEventListener('click', () => {
         clearTimeout(timeoutId);
         callback();
         removeToast(toast);
      });
   }

   return { toast, timeoutId };
}

function removeToast(toast) {
   toast.classList.remove('toast--show');
   toast.classList.add('toast--hide');
   toast.addEventListener('animationend', () => toast.remove());
}

// ============================================
// 3. Modal System
// ============================================
function openModal(title, bodyHTML) {
   modalTitle.textContent = title;
   modalBody.innerHTML = bodyHTML;
   modalOverlay.classList.add('modal-overlay--visible');
}

function closeModal() {
   modalOverlay.classList.remove('modal-overlay--visible');
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
   if (e.target === modalOverlay) closeModal();
});

// ============================================
// 4. Theme Toggle
// ============================================
function loadTheme() {
   const saved = localStorage.getItem('taskflow_theme') || 'dark';
   document.documentElement.setAttribute('data-theme', saved);
   themeIcon.innerHTML = saved === 'dark' ? '&#9790;' : '&#9788;';
}

function toggleTheme() {
   const current = document.documentElement.getAttribute('data-theme');
   const next = current === 'dark' ? 'light' : 'dark';
   document.documentElement.setAttribute('data-theme', next);
   localStorage.setItem('taskflow_theme', next);
   themeIcon.innerHTML = next === 'dark' ? '&#9790;' : '&#9788;';
}

themeToggle.addEventListener('click', toggleTheme);

// ============================================
// 5. Helpers
// ============================================
function updateCounter() {
   const total = tasks.length;
   const completed = tasks.filter(t => t.completed).length;
   const active = total - completed;
   taskCountLabel.textContent = `${active} task${active !== 1 ? 's' : ''} remaining`;
   clearCompletedBtn.style.visibility = completed > 0 ? 'visible' : 'hidden';

   // Progress indicator
   if (total === 0) {
      progressBar.style.width = '0%';
      progressText.textContent = '';
   } else {
      const pct = Math.round((completed / total) * 100);
      progressBar.style.width = `${pct}%`;
      progressText.textContent = `${completed}/${total} completed (${pct}%)`;
   }
}

function getDeadlineInfo(deadlineStr) {
   if (!deadlineStr) return null;
   const dl = new Date(deadlineStr);
   const diff = dl - new Date();
   const dateStr = new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
   }).format(dl);

   if (diff < 0) return { text: 'Overdue!', dateStr, urgent: true };
   const hours = Math.floor(diff / (1000 * 60 * 60));
   const days = Math.floor(hours / 24);
   let relText = days > 0 ? `${days}d left` : hours > 0 ? `${hours}h left` : 'Soon!';
   return { text: relText, dateStr, urgent: diff < (24 * 60 * 60 * 1000) };
}

function getAllTags() {
   const tagSet = new Set();
   tasks.forEach(t => (t.tags || []).forEach(tag => tagSet.add(tag)));
   return [...tagSet].sort();
}

// ============================================
// 6. Calendar
// ============================================
function renderCalendar() {
   calendarDaysGrid.innerHTML = '';
   const year = pickerDate.getFullYear();
   const month = pickerDate.getMonth();
   calendarTitle.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(pickerDate);

   let firstDay = new Date(year, month, 1).getDay();
   firstDay = firstDay === 0 ? 6 : firstDay - 1;

   const daysInMonth = new Date(year, month + 1, 0).getDate();
   const prevMonthDays = new Date(year, month, 0).getDate();

   for (let i = firstDay; i > 0; i--) {
      const span = document.createElement('div');
      span.className = 'calendar-day other-month';
      span.textContent = prevMonthDays - i + 1;
      calendarDaysGrid.appendChild(span);
   }

   const today = new Date();
   for (let d = 1; d <= daysInMonth; d++) {
      const span = document.createElement('div');
      span.className = 'calendar-day';
      if (today.getDate() === d && today.getMonth() === month && today.getFullYear() === year) span.classList.add('today');
      if (selectedDate && selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year) span.classList.add('selected');
      span.textContent = d;
      span.onclick = () => { selectedDate = new Date(year, month, d); renderCalendar(); };
      calendarDaysGrid.appendChild(span);
   }

   const totalCells = firstDay + daysInMonth;
   const nextDays = 42 - totalCells;
   for (let i = 1; i <= nextDays; i++) {
      const span = document.createElement('div');
      span.className = 'calendar-day other-month';
      span.textContent = i;
      calendarDaysGrid.appendChild(span);
   }
}

// ============================================
// 7. Tag Filters
// ============================================
function renderTagFilters() {
   const allTags = getAllTags();
   tagFiltersContainer.innerHTML = '';
   if (allTags.length === 0) return;

   allTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-filter-btn' + (activeTagFilter === tag ? ' tag-filter-btn--active' : '');
      btn.textContent = tag;
      btn.addEventListener('click', () => {
         activeTagFilter = activeTagFilter === tag ? null : tag;
         renderTagFilters();
         renderTasks();
      });
      tagFiltersContainer.appendChild(btn);
   });
}

// ============================================
// 8. Render Tasks
// ============================================
function renderTasks() {
   taskList.innerHTML = '';

   let filtered = tasks.filter(t => {
      if (currentFilter === 'active') return !t.completed;
      if (currentFilter === 'completed') return t.completed;
      return true;
   });

   // Search filter
   if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter(t =>
         t.text.toLowerCase().includes(q) ||
         (t.details || '').toLowerCase().includes(q) ||
         (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
   }

   // Tag filter
   if (activeTagFilter) {
      filtered = filtered.filter(t => (t.tags || []).includes(activeTagFilter));
   }

   // Sort
   filtered.sort((a, b) => {
      if (currentSort === 'priority') {
         const pMap = { high: 3, medium: 2, low: 1 };
         return pMap[b.priority] - pMap[a.priority];
      } else if (currentSort === 'urgency') {
         if (!a.deadline && !b.deadline) return 0;
         if (!a.deadline) return 1;
         if (!b.deadline) return -1;
         return new Date(a.deadline) - new Date(b.deadline);
      } else if (currentSort === 'manual') {
         return (a.order || 0) - (b.order || 0);
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
   });

   // Empty state
   if (filtered.length === 0) {
      const isSearching = currentSearch || activeTagFilter;
      taskList.innerHTML = `<li class="task-list__empty">
         <div class="empty-state__icon">${isSearching ? '&#128269;' : '&#9745;'}</div>
         <div class="empty-state__text">${isSearching ? 'No tasks match your search.' : 'No tasks yet. Add one above!'}</div>
      </li>`;
      updateCounter();
      return;
   }

   filtered.forEach(t => {
      const li = document.createElement('li');
      li.className = `task-item task-item__priority--${t.priority}-box ${t.completed ? 'task-item--completed' : ''} task-slide-in`;
      li.dataset.id = t.id;

      if (editingTaskId === t.id) {
         // --- EDIT MODE ---
         li.innerHTML = `
            <div class="task-item__row">
               <div class="task-item__content">
                  <input type="text" class="task-item__edit-input" value="${escapeHTML(t.text)}">
                  <input type="text" class="task-item__edit-details" value="${escapeHTML(t.details || '')}" placeholder="Details...">
                  <input type="text" class="task-item__edit-tags" value="${escapeHTML((t.tags || []).join(', '))}" placeholder="Tags (comma separated)...">
               </div>
               <div class="task-item__actions">
                  <button class="task-item__save">Save</button>
                  <button class="task-item__cancel">Cancel</button>
               </div>
            </div>
         `;
      } else {
         // --- VIEW MODE ---
         const info = getDeadlineInfo(t.deadline);
         const dlHTML = info ? `<span class="task-item__deadline-badge ${info.urgent ? 'task-item__deadline-badge--urgent' : ''}" title="${escapeHTML(info.dateStr)}">${escapeHTML(info.dateStr)} &middot; ${escapeHTML(info.text)}</span>` : '';

         const priorityLabels = { high: 'High', medium: 'Med', low: 'Low' };
         const priorityBadge = `<button class="task-item__priority-badge task-item__priority-badge--${t.priority}" title="Click to cycle priority">${priorityLabels[t.priority]}</button>`;

         const tagsHTML = (t.tags || []).length > 0
            ? `<div class="task-item__tags">${t.tags.map(tag => `<span class="task-item__tag">${escapeHTML(tag)}</span>`).join('')}</div>`
            : '';

         const subtasksHTML = (t.subtasks || []).length > 0
            ? `<div class="task-item__subtasks">${t.subtasks.map((st, i) => `
               <label class="subtask">
                  <input type="checkbox" class="subtask__checkbox" data-subtask-index="${i}" ${st.completed ? 'checked' : ''}>
                  <span class="subtask__text ${st.completed ? 'subtask__text--done' : ''}">${escapeHTML(st.text)}</span>
                  <button class="subtask__delete" data-subtask-index="${i}" title="Remove subtask">&times;</button>
               </label>
            `).join('')}</div>`
            : '';

         const dragHandle = currentSort === 'manual' ? `<span class="task-item__drag-handle" title="Drag to reorder">&#9776;</span>` : '';

         li.innerHTML = `
            <div class="task-item__row">
               ${dragHandle}
               <input type="checkbox" class="task-item__checkbox" ${t.completed ? 'checked' : ''}>
               <div class="task-item__content">
                  <span class="task-item__text">${escapeHTML(t.text)}</span>
                  ${t.details ? `<span class="task-item__details-text">${escapeHTML(t.details)}</span>` : ''}
                  ${tagsHTML}
               </div>
               ${priorityBadge}
               ${dlHTML}
               <div class="task-item__actions">
                  <button class="task-item__edit" title="Edit task">&#9998;</button>
                  <button class="task-item__delete" title="Delete task">&times;</button>
               </div>
            </div>
            ${subtasksHTML}
            <div class="task-item__add-subtask">
               <input type="text" class="task-item__subtask-input" placeholder="Add subtask..." data-task-id="${t.id}">
            </div>
         `;

         // Drag-and-drop for manual sort
         if (currentSort === 'manual') {
            li.draggable = true;
            li.addEventListener('dragstart', (e) => {
               draggedTaskId = t.id;
               li.classList.add('task-item--dragging');
               e.dataTransfer.effectAllowed = 'move';
            });
            li.addEventListener('dragend', () => {
               draggedTaskId = null;
               li.classList.remove('task-item--dragging');
               document.querySelectorAll('.task-item--drag-over').forEach(el => el.classList.remove('task-item--drag-over'));
            });
            li.addEventListener('dragover', (e) => {
               e.preventDefault();
               e.dataTransfer.dropEffect = 'move';
               li.classList.add('task-item--drag-over');
            });
            li.addEventListener('dragleave', () => {
               li.classList.remove('task-item--drag-over');
            });
            li.addEventListener('drop', (e) => {
               e.preventDefault();
               li.classList.remove('task-item--drag-over');
               if (draggedTaskId && draggedTaskId !== t.id) {
                  reorderTask(draggedTaskId, t.id);
               }
            });
         }
      }
      taskList.appendChild(li);
   });
   updateCounter();
}

// ============================================
// 9. Task Actions
// ============================================
function addTask(text, priority, deadline, details, tagsStr) {
   if (!text.trim()) return;
   const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
   tasks.unshift({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      text: text.trim(),
      completed: false,
      priority,
      deadline,
      details: details.trim(),
      tags,
      subtasks: [],
      order: 0
   });
   // Update order for all tasks
   tasks.forEach((t, i) => t.order = i);
   saveTasks();
   renderTagFilters();
   renderTasks();
}

function deleteTask(id) {
   const idx = tasks.findIndex(t => t.id === id);
   if (idx === -1) return;

   const task = tasks[idx];
   const li = document.querySelector(`.task-item[data-id="${id}"]`);

   // Animate out
   if (li) {
      li.classList.add('task-fade-out');
   }

   // Remove after animation
   setTimeout(() => {
      tasks.splice(idx, 1);
      saveTasks();
      renderTagFilters();
      renderTasks();
   }, 300);

   // Show undo toast
   const removedTask = { ...task };
   const removedIdx = idx;
   showToast('Task deleted', 'Undo', () => {
      tasks.splice(removedIdx, 0, removedTask);
      saveTasks();
      renderTagFilters();
      renderTasks();
   });
}

function saveEdit(id, newText, newDetails, newTagsStr) {
   const t = tasks.find(task => task.id === id);
   if (t && newText.trim()) {
      t.text = newText.trim();
      t.details = newDetails.trim();
      t.tags = newTagsStr ? newTagsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      saveTasks();
   }
   editingTaskId = null;
   renderTagFilters();
   renderTasks();
}

function cyclePriority(id) {
   if (editingTaskId) return;
   const t = tasks.find(task => task.id === id);
   if (t) {
      const s = ['low', 'medium', 'high'];
      t.priority = s[(s.indexOf(t.priority) + 1) % 3];
      saveTasks();
      renderTasks();
   }
}

function toggleSubtask(taskId, subtaskIndex) {
   const t = tasks.find(task => task.id === taskId);
   if (t && t.subtasks[subtaskIndex] !== undefined) {
      t.subtasks[subtaskIndex].completed = !t.subtasks[subtaskIndex].completed;
      saveTasks();
      renderTasks();
   }
}

function addSubtask(taskId, text) {
   if (!text.trim()) return;
   const t = tasks.find(task => task.id === taskId);
   if (t) {
      t.subtasks.push({ id: crypto.randomUUID(), text: text.trim(), completed: false });
      saveTasks();
      renderTasks();
   }
}

function deleteSubtask(taskId, subtaskIndex) {
   const t = tasks.find(task => task.id === taskId);
   if (t && t.subtasks[subtaskIndex] !== undefined) {
      t.subtasks.splice(subtaskIndex, 1);
      saveTasks();
      renderTasks();
   }
}

function reorderTask(draggedId, targetId) {
   const draggedIdx = tasks.findIndex(t => t.id === draggedId);
   const targetIdx = tasks.findIndex(t => t.id === targetId);
   if (draggedIdx === -1 || targetIdx === -1) return;
   const [moved] = tasks.splice(draggedIdx, 1);
   tasks.splice(targetIdx, 0, moved);
   tasks.forEach((t, i) => t.order = i);
   saveTasks();
   renderTasks();
}

// ============================================
// 10. Export / Import
// ============================================
function exportTasks() {
   const data = JSON.stringify(tasks, null, 2);
   const blob = new Blob([data], { type: 'application/json' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `taskflow-export-${new Date().toISOString().slice(0, 10)}.json`;
   a.click();
   URL.revokeObjectURL(url);
   showToast('Tasks exported successfully');
}

function importTasks(file) {
   const reader = new FileReader();
   reader.onload = (e) => {
      try {
         const imported = JSON.parse(e.target.result);
         if (!Array.isArray(imported)) throw new Error('Invalid format');
         // Validate each task has at least text and id
         imported.forEach(t => {
            if (!t.text) throw new Error('Invalid task data');
            if (!t.id) t.id = crypto.randomUUID();
            if (!t.createdAt) t.createdAt = Date.now();
            if (!t.tags) t.tags = [];
            if (!t.subtasks) t.subtasks = [];
            if (t.order === undefined) t.order = 0;
            if (t.priority === undefined) t.priority = 'medium';
            if (t.completed === undefined) t.completed = false;
         });
         tasks = imported;
         saveTasks();
         renderTagFilters();
         renderTasks();
         showToast(`Imported ${imported.length} task${imported.length !== 1 ? 's' : ''}`);
      } catch (err) {
         showToast('Import failed: invalid JSON file');
      }
   };
   reader.readAsText(file);
}

exportBtn.addEventListener('click', exportTasks);
importInput.addEventListener('change', (e) => {
   if (e.target.files[0]) {
      importTasks(e.target.files[0]);
      e.target.value = '';
   }
});

// ============================================
// 11. Keyboard Shortcuts Modal
// ============================================
function showShortcutsModal() {
   openModal('Keyboard Shortcuts', `
      <div class="shortcuts-list">
         <div class="shortcut-row"><kbd>/</kbd><span>Focus search</span></div>
         <div class="shortcut-row"><kbd>n</kbd><span>New task</span></div>
         <div class="shortcut-row"><kbd>?</kbd><span>Show this help</span></div>
         <div class="shortcut-row"><kbd>Esc</kbd><span>Clear form / close modal / cancel edit</span></div>
         <div class="shortcut-row"><kbd>Enter</kbd><span>Save edit (while editing)</span></div>
      </div>
   `);
}

shortcutsBtn.addEventListener('click', showShortcutsModal);

// ============================================
// 12. Event Listeners
// ============================================

// Form submit
taskForm.addEventListener('submit', (e) => {
   e.preventDefault();
   addTask(taskInput.value, prioritySelect.value, deadlineInput.value, detailsInput.value, tagsInput.value);
   taskInput.value = '';
   deadlineInput.value = '';
   deadlineDisplay.value = '';
   detailsInput.value = '';
   tagsInput.value = '';
   selectedDate = null;
});

// Task list interactions (delegated)
taskList.addEventListener('click', (e) => {
   const item = e.target.closest('.task-item');
   if (!item) return;
   const id = item.dataset.id;

   if (e.target.classList.contains('task-item__checkbox')) {
      const t = tasks.find(task => task.id === id);
      if (t) { t.completed = !t.completed; saveTasks(); renderTasks(); }
   }
   else if (e.target.classList.contains('task-item__delete')) {
      deleteTask(id);
   }
   else if (e.target.classList.contains('task-item__edit')) {
      editingTaskId = id;
      renderTasks();
   }
   else if (e.target.classList.contains('task-item__save')) {
      const text = item.querySelector('.task-item__edit-input').value;
      const details = item.querySelector('.task-item__edit-details').value;
      const tags = item.querySelector('.task-item__edit-tags').value;
      saveEdit(id, text, details, tags);
   }
   else if (e.target.classList.contains('task-item__cancel')) {
      editingTaskId = null;
      renderTasks();
   }
   else if (e.target.classList.contains('task-item__priority-badge')) {
      cyclePriority(id);
   }
   else if (e.target.classList.contains('subtask__checkbox')) {
      const idx = parseInt(e.target.dataset.subtaskIndex);
      toggleSubtask(id, idx);
   }
   else if (e.target.classList.contains('subtask__delete')) {
      const idx = parseInt(e.target.dataset.subtaskIndex);
      deleteSubtask(id, idx);
   }
});

// Subtask input (Enter to add)
taskList.addEventListener('keydown', (e) => {
   if (e.key === 'Enter' && e.target.classList.contains('task-item__subtask-input')) {
      e.preventDefault();
      const taskId = e.target.dataset.taskId;
      addSubtask(taskId, e.target.value);
      e.target.value = '';
   }
});

// Filters
filtersContainer.addEventListener('click', (e) => {
   if (e.target.classList.contains('filters__button')) {
      currentFilter = e.target.dataset.filter;
      filterButtons.forEach(btn => btn.classList.remove('filters__button--active'));
      e.target.classList.add('filters__button--active');
      renderTasks();
   }
});

// Sort
sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; renderTasks(); });

// Clear completed
clearCompletedBtn.addEventListener('click', () => {
   const cleared = tasks.filter(t => t.completed);
   if (cleared.length === 0) return;
   tasks = tasks.filter(t => !t.completed);
   saveTasks();
   renderTagFilters();
   renderTasks();
   showToast(`Cleared ${cleared.length} task${cleared.length !== 1 ? 's' : ''}`, 'Undo', () => {
      tasks = tasks.concat(cleared);
      saveTasks();
      renderTagFilters();
      renderTasks();
   });
});

// Search
searchInput.addEventListener('input', (e) => {
   currentSearch = e.target.value;
   renderTasks();
});

// Clear deadline button
deadlineClearBtn.addEventListener('click', (e) => {
   e.stopPropagation();
   deadlineInput.value = '';
   deadlineDisplay.value = '';
   selectedDate = null;
});

// --- Datepicker Event Listeners ---
deadlineDisplay.addEventListener('click', (e) => { e.stopPropagation(); calendarPicker.style.display = 'block'; renderCalendar(); });
prevMonthBtn.addEventListener('click', (e) => { e.stopPropagation(); pickerDate.setMonth(pickerDate.getMonth() - 1); renderCalendar(); });
nextMonthBtn.addEventListener('click', (e) => { e.stopPropagation(); pickerDate.setMonth(pickerDate.getMonth() + 1); renderCalendar(); });
confirmDeadlineBtn.addEventListener('click', (e) => {
   if (selectedDate) {
      const timeParts = timeInput.value.split(':');
      selectedDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]));
      deadlineInput.value = selectedDate.toISOString();
      deadlineDisplay.value = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(selectedDate);
   }
   calendarPicker.style.display = 'none';
});
document.addEventListener('click', (e) => {
   if (!calendarPicker.contains(e.target) && e.target !== deadlineDisplay) calendarPicker.style.display = 'none';
});

// --- Global Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
   const activeEl = document.activeElement;
   const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT';

   // Esc: close modal, cancel edit, clear form
   if (e.key === 'Escape') {
      if (modalOverlay.classList.contains('modal-overlay--visible')) {
         closeModal();
         return;
      }
      if (editingTaskId) {
         editingTaskId = null;
         renderTasks();
         return;
      }
      if (isInput) {
         activeEl.blur();
         return;
      }
      taskInput.value = ''; detailsInput.value = ''; deadlineInput.value = ''; deadlineDisplay.value = ''; tagsInput.value = '';
      selectedDate = null;
      searchInput.value = '';
      currentSearch = '';
      renderTasks();
      return;
   }

   // Enter to save edit
   if (e.key === 'Enter' && editingTaskId && !e.target.classList.contains('task-item__subtask-input')) {
      const item = document.querySelector(`.task-item[data-id="${editingTaskId}"]`);
      if (item) {
         const text = item.querySelector('.task-item__edit-input').value;
         const details = item.querySelector('.task-item__edit-details').value;
         const tags = item.querySelector('.task-item__edit-tags').value;
         saveEdit(editingTaskId, text, details, tags);
      }
      return;
   }

   // Non-input shortcuts
   if (isInput) return;

   if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
   }
   else if (e.key === 'n') {
      e.preventDefault();
      taskInput.focus();
   }
   else if (e.key === '?') {
      e.preventDefault();
      showShortcutsModal();
   }
});

// ============================================
// 13. Init
// ============================================
loadTheme();
loadTasks();
renderTagFilters();
renderTasks();
setInterval(renderTasks, 60000);
