/* ============================================
   app.js — TaskFlow Application Logic
   ============================================ */

let tasks = [];
let currentFilter = 'all';
let currentSort = 'date-added';
let editingTaskId = null; // Tracks which task is being edited

// --- Datepicker State ---
let pickerDate = new Date();
let selectedDate = null;

// DOM REFERENCES
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const prioritySelect = document.getElementById('priority-select');
const deadlineDisplay = document.getElementById('deadline-display');
const deadlineInput = document.getElementById('deadline-input');
const detailsInput = document.getElementById('details-input');
const taskList = document.getElementById('task-list');
const filtersContainer = document.getElementById('filters');
const filterButtons = document.querySelectorAll('.filters__button');
const sortSelect = document.getElementById('sort-select');
const taskCountLabel = document.getElementById('task-count');
const clearCompletedBtn = document.getElementById('clear-completed');

// --- Calendar DOM References ---
const calendarPicker = document.getElementById('calendar-picker');
const calendarTitle = document.getElementById('calendar-title');
const calendarDaysGrid = document.getElementById('calendar-days');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const timeInput = document.getElementById('calendar-time-input');
const confirmDeadlineBtn = document.getElementById('confirm-deadline');

// 1. Storage
function saveTasks() {
   localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

function loadTasks() {
   const saved = localStorage.getItem('taskflow_tasks');
   if (saved) tasks = JSON.parse(saved);
}

// 2. Logic
function updateCounter() {
   const activeTasks = tasks.filter(t => !t.completed).length;
   taskCountLabel.textContent = `${activeTasks} task${activeTasks !== 1 ? 's' : ''} remaining`;
   clearCompletedBtn.style.visibility = tasks.some(t => t.completed) ? 'visible' : 'hidden';
}

function getDeadlineInfo(deadlineStr) {
   if (!deadlineStr) return null;
   const diff = new Date(deadlineStr) - new Date();
   if (diff < 0) return { text: 'Overdue!', urgent: true };
   const hours = Math.floor(diff / (1000 * 60 * 60));
   const days = Math.floor(hours / 24);
   let text = days > 0 ? `${days}d left` : hours > 0 ? `${hours}h left` : 'Soon!';
   return { text, urgent: diff < (24 * 60 * 60 * 1000) };
}

// 3. Custom Calendar Logic
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
      const d = prevMonthDays - i + 1;
      const span = document.createElement('div');
      span.className = 'calendar-day other-month';
      span.textContent = d;
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

// 4. Render Tasks
function renderTasks() {
   taskList.innerHTML = '';

   let filtered = tasks.filter(t => {
      if (currentFilter === 'active') return !t.completed;
      if (currentFilter === 'completed') return t.completed;
      return true;
   });

   filtered.sort((a, b) => {
      if (currentSort === 'priority') {
         const pMap = { high: 3, medium: 2, low: 1 };
         return pMap[b.priority] - pMap[a.priority];
      } else if (currentSort === 'urgency') {
         if (!a.deadline && !b.deadline) return 0;
         if (!a.deadline) return 1;
         if (!b.deadline) return -1;
         return new Date(a.deadline) - new Date(b.deadline);
      }
      return b.id - a.id;
   });

   if (filtered.length === 0) {
      taskList.innerHTML = `<li class="task-list__empty">No tasks found.</li>`;
   }

   filtered.forEach(t => {
      const li = document.createElement('li');
      li.className = `task-item task-item__priority--${t.priority}-box ${t.completed ? 'task-item--completed' : ''}`;
      li.dataset.id = t.id;

      if (editingTaskId === t.id) {
         // --- EDIT MODE ---
         li.innerHTML = `
            <div class="task-item__content">
               <input type="text" class="task-item__edit-input" value="${t.text}">
               <input type="text" class="task-item__edit-details" value="${t.details || ''}" placeholder="Details...">
            </div>
            <div class="task-item__actions">
               <button class="task-item__save">Save</button>
               <button class="task-item__cancel">Cancel</button>
            </div>
         `;
      } else {
         // --- VIEW MODE ---
         const info = getDeadlineInfo(t.deadline);
         const dlHTML = info ? `<span class="task-item__deadline-badge ${info.urgent ? 'task-item__deadline-badge--urgent' : ''}">${info.text}</span>` : '';
         li.innerHTML = `
            <input type="checkbox" class="task-item__checkbox" ${t.completed ? 'checked' : ''}>
            <div class="task-item__content">
               <span class="task-item__text">${t.text}</span>
               ${t.details ? `<span class="task-item__details-text">${t.details}</span>` : ''}
            </div>
            ${dlHTML}
            <div class="task-item__actions">
               <button class="task-item__edit" title="Edit text/details">✎</button>
               <button class="task-item__delete" title="Delete task">×</button>
            </div>
         `;
      }
      taskList.appendChild(li);
   });
   updateCounter();
}

// 5. Actions
function addTask(text, priority, deadline, details) {
   if (!text.trim()) return;
   tasks.unshift({ id: Date.now(), text, completed: false, priority, deadline, details });
   saveTasks();
   renderTasks();
}

function saveEdit(id, newText, newDetails) {
   const t = tasks.find(task => task.id === id);
   if (t && newText.trim()) {
      t.text = newText.trim();
      t.details = newDetails.trim();
      saveTasks();
   }
   editingTaskId = null;
   renderTasks();
}

function cyclePriority(id) {
   if (editingTaskId) return; // Don't cycle while editing
   const t = tasks.find(task => task.id === id);
   if (t) {
      const s = ['low', 'medium', 'high'];
      t.priority = s[(s.indexOf(t.priority) + 1) % 3];
      saveTasks();
      renderTasks();
   }
}

// 6. Event Listeners
taskForm.addEventListener('submit', (e) => {
   e.preventDefault();
   addTask(taskInput.value, prioritySelect.value, deadlineInput.value, detailsInput.value);
   taskInput.value = ''; deadlineInput.value = ''; deadlineDisplay.value = ''; detailsInput.value = '';
   selectedDate = null;
});

taskList.addEventListener('click', (e) => {
   const item = e.target.closest('.task-item');
   if (!item) return;
   const id = Number(item.dataset.id);

   if (e.target.classList.contains('task-item__checkbox')) {
      const t = tasks.find(task => task.id === id);
      if (t) { t.completed = !t.completed; saveTasks(); renderTasks(); }
   }
   else if (e.target.classList.contains('task-item__delete')) {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderTasks();
   }
   else if (e.target.classList.contains('task-item__edit')) {
      editingTaskId = id;
      renderTasks();
   }
   else if (e.target.classList.contains('task-item__save')) {
      const text = item.querySelector('.task-item__edit-input').value;
      const details = item.querySelector('.task-item__edit-details').value;
      saveEdit(id, text, details);
   }
   else if (e.target.classList.contains('task-item__cancel')) {
      editingTaskId = null;
      renderTasks();
   }
   else {
      // Background click -> cycle priority
      if (!e.target.closest('.task-item__actions') && !e.target.closest('.task-item__content')) {
         cyclePriority(id);
      }
   }
});

filtersContainer.addEventListener('click', (e) => {
   if (e.target.classList.contains('filters__button')) {
      currentFilter = e.target.dataset.filter;
      filterButtons.forEach(btn => btn.classList.remove('filters__button--active'));
      e.target.classList.add('filters__button--active');
      renderTasks();
   }
});

sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; renderTasks(); });
clearCompletedBtn.addEventListener('click', () => { tasks = tasks.filter(t => !t.completed); saveTasks(); renderTasks(); });

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
document.addEventListener('click', (e) => { if (!calendarPicker.contains(e.target) && e.target !== deadlineDisplay) calendarPicker.style.display = 'none'; });

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
   // 1. Esc to Clear Main Form or Cancel Edit
   if (e.key === 'Escape') {
      if (editingTaskId) {
         editingTaskId = null;
         renderTasks();
      } else {
         taskInput.value = ''; detailsInput.value = ''; deadlineInput.value = ''; deadlineDisplay.value = '';
         selectedDate = null;
      }
   }

   // 2. Enter to Save Edit
   if (e.key === 'Enter' && editingTaskId) {
      const item = document.querySelector(`.task-item[data-id="${editingTaskId}"]`);
      if (item) {
         const text = item.querySelector('.task-item__edit-input').value;
         const details = item.querySelector('.task-item__edit-details').value;
         saveEdit(editingTaskId, text, details);
      }
   }
});

// Init
loadTasks(); renderTasks(); setInterval(renderTasks, 60000);
