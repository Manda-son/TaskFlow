/* ============================================
   app.js — TaskFlow Application Logic
   Mobile-first • Gesture-driven • Minimal
   ============================================ */

// --- State ---
let tasks = [];
let currentView = 'today';
let currentSearch = '';
let activeTagFilter = null;
let currentSort = 'priority';
let sheetOpen = false;
let sheetEditingId = null;
let sheetPriority = 'medium';
let sheetDeadline = null;

// Datepicker
let pickerDate = new Date();
let selectedDate = null;

// Gesture
let longPressTimer = null;

// --- XSS Protection ---
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- DOM References ---
const greetingTime = document.getElementById('greeting-time');
const greetingDate = document.getElementById('greeting-date');
const searchContainer = document.getElementById('search-container');
const searchInput = document.getElementById('search-input');
const tagFiltersContainer = document.getElementById('tag-filters');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const sortSelect = document.getElementById('sort-select');
const taskList = document.getElementById('task-list');

// Bottom Nav
const navToggle = document.getElementById('nav-toggle');
const navToggleLabel = document.getElementById('nav-toggle-label');
const navIconToday = document.querySelector('.nav-icon--today');
const navIconAll = document.querySelector('.nav-icon--all');
const navSettings = document.getElementById('nav-settings');
const fabAdd = document.getElementById('fab-add');

// Sheet
const sheetOverlay = document.getElementById('sheet-overlay');
const sheet = document.getElementById('sheet');
const sheetForm = document.getElementById('sheet-form');
const sheetTaskInput = document.getElementById('sheet-task-input');
const sheetParsed = document.getElementById('sheet-parsed');
const sheetDateBtn = document.getElementById('sheet-date-btn');
const sheetCalendar = document.getElementById('sheet-calendar');

// Calendar
const calendarTitle = document.getElementById('calendar-title');
const calendarDaysGrid = document.getElementById('calendar-days');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const timeInput = document.getElementById('calendar-time-input');
const confirmDeadlineBtn = document.getElementById('confirm-deadline');

// Modal
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

// Toast
const toastContainer = document.getElementById('toast-container');

// Touch detection
const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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
      if (t.deadline === '') { t.deadline = null; migrated = true; }
      if (t.details === undefined) { t.details = ''; migrated = true; }
    });
    if (migrated) saveTasks();
  }
}

// ============================================
// 2. Toast System
// ============================================
function showToast(message, actionLabel, callback, duration) {
  duration = duration || 4000;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML =
    '<span class="toast__message">' + escapeHTML(message) + '</span>' +
    (actionLabel ? '<button class="toast__action">' + escapeHTML(actionLabel) + '</button>' : '');
  toastContainer.appendChild(toast);

  var timeoutId = setTimeout(function() { removeToast(toast); }, duration);

  if (actionLabel && callback) {
    toast.querySelector('.toast__action').addEventListener('click', function() {
      clearTimeout(timeoutId);
      callback();
      removeToast(toast);
    });
  }
}

function removeToast(toast) {
  toast.classList.add('toast--hide');
  toast.addEventListener('animationend', function() { toast.remove(); });
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
modalOverlay.addEventListener('click', function(e) {
  if (e.target === modalOverlay) closeModal();
});

// ============================================
// 4. Theme System (Auto + Manual)
// ============================================
function loadTheme() {
  var saved = localStorage.getItem('taskflow_theme');
  if (saved && saved !== 'auto') {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function setTheme(value) {
  if (value === 'auto') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('taskflow_theme', 'auto');
  } else {
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('taskflow_theme', value);
  }
}

// ============================================
// 5. Greeting
// ============================================
function updateGreeting() {
  var now = new Date();
  var hour = now.getHours();
  var greeting;
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 17) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';

  greetingTime.textContent = greeting;
  greetingDate.textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  }).format(now);
}

// ============================================
// 6. View System
// ============================================
function switchView(view) {
  currentView = view;
  currentSearch = '';
  searchInput.value = '';

  // Toggle icon: show the OPPOSITE view's icon (what you'll switch TO)
  if (view === 'today') {
    navIconToday.style.display = '';
    navIconAll.style.display = 'none';
    navToggleLabel.textContent = 'Today';
  } else {
    navIconToday.style.display = 'none';
    navIconAll.style.display = '';
    navToggleLabel.textContent = 'All';
  }

  searchContainer.classList.toggle('search--visible', view === 'all');

  renderTagFilters();
  renderTasks();
}

// ============================================
// 7. Helpers
// ============================================
function isToday(dateStr) {
  if (!dateStr) return false;
  var d = new Date(dateStr);
  var now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function getFilteredTasks() {
  var filtered = tasks;

  if (currentView === 'today') {
    filtered = tasks.filter(function(t) {
      return !t.deadline || isToday(t.deadline) || isOverdue(t.deadline);
    });
  }

  if (currentSearch) {
    var q = currentSearch.toLowerCase();
    filtered = filtered.filter(function(t) {
      return t.text.toLowerCase().includes(q) ||
        (t.details || '').toLowerCase().includes(q) ||
        (t.tags || []).some(function(tag) { return tag.toLowerCase().includes(q); });
    });
  }

  if (activeTagFilter) {
    filtered = filtered.filter(function(t) {
      return (t.tags || []).includes(activeTagFilter);
    });
  }

  filtered.sort(function(a, b) {
    // Completed tasks always at the bottom
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    if (currentSort === 'priority') {
      var pMap = { high: 3, medium: 2, low: 1 };
      var pDiff = (pMap[b.priority] || 2) - (pMap[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
      return (b.createdAt || 0) - (a.createdAt || 0);
    } else if (currentSort === 'date-added') {
      return (b.createdAt || 0) - (a.createdAt || 0);
    } else if (currentSort === 'deadline') {
      // Tasks with deadlines first, sorted soonest first
      var aHas = a.deadline ? 1 : 0;
      var bHas = b.deadline ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    }
    return 0;
  });

  return filtered;
}

function getDeadlineInfo(deadlineStr) {
  if (!deadlineStr) return null;
  var dl = new Date(deadlineStr);
  var diff = dl - new Date();
  var dateStr = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(dl);

  if (diff < 0) return { text: 'Overdue', dateStr: dateStr, urgent: true };
  var hours = Math.floor(diff / (1000 * 60 * 60));
  var days = Math.floor(hours / 24);
  var relText = days > 0 ? days + 'd' : hours > 0 ? hours + 'h' : 'Soon';
  return { text: relText, dateStr: dateStr, urgent: diff < (24 * 60 * 60 * 1000) };
}

function getAllTags() {
  var tagSet = new Set();
  tasks.forEach(function(t) {
    (t.tags || []).forEach(function(tag) { tagSet.add(tag); });
  });
  return Array.from(tagSet).sort();
}

function updateProgress() {
  var viewTasks = getFilteredTasks();
  var total = viewTasks.length;
  var completed = viewTasks.filter(function(t) { return t.completed; }).length;

  if (total === 0) {
    progressBar.style.width = '0%';
    progressText.textContent = '';
  } else {
    var pct = Math.round((completed / total) * 100);
    progressBar.style.width = pct + '%';
    progressText.textContent = completed + '/' + total + ' done';
  }
}

// ============================================
// 8. Calendar
// ============================================
function renderCalendar() {
  calendarDaysGrid.innerHTML = '';
  var year = pickerDate.getFullYear();
  var month = pickerDate.getMonth();
  calendarTitle.textContent = new Intl.DateTimeFormat('en-US', {
    month: 'long', year: 'numeric'
  }).format(pickerDate);

  var firstDay = new Date(year, month, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;

  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var prevMonthDays = new Date(year, month, 0).getDate();

  for (var i = firstDay; i > 0; i--) {
    var span = document.createElement('div');
    span.className = 'calendar-day other-month';
    span.textContent = prevMonthDays - i + 1;
    calendarDaysGrid.appendChild(span);
  }

  var today = new Date();
  for (var d = 1; d <= daysInMonth; d++) {
    var span = document.createElement('div');
    span.className = 'calendar-day';
    if (today.getDate() === d && today.getMonth() === month && today.getFullYear() === year) {
      span.classList.add('today');
    }
    if (selectedDate && selectedDate.getDate() === d &&
      selectedDate.getMonth() === month && selectedDate.getFullYear() === year) {
      span.classList.add('selected');
    }
    span.textContent = d;
    (function(day) {
      span.onclick = function() {
        selectedDate = new Date(year, month, day);
        renderCalendar();
      };
    })(d);
    calendarDaysGrid.appendChild(span);
  }

  var totalCells = firstDay + daysInMonth;
  var nextDays = (Math.ceil(totalCells / 7) * 7) - totalCells;
  for (var i = 1; i <= nextDays; i++) {
    var span = document.createElement('div');
    span.className = 'calendar-day other-month';
    span.textContent = i;
    calendarDaysGrid.appendChild(span);
  }
}

// ============================================
// 9. Tag Filters
// ============================================
function renderTagFilters() {
  var allTags = getAllTags();
  tagFiltersContainer.innerHTML = '';
  if (allTags.length === 0) return;

  allTags.forEach(function(tag) {
    var btn = document.createElement('button');
    btn.className = 'tag-filter-btn' + (activeTagFilter === tag ? ' tag-filter-btn--active' : '');
    btn.textContent = tag;
    btn.addEventListener('click', function() {
      activeTagFilter = activeTagFilter === tag ? null : tag;
      renderTagFilters();
      renderTasks();
    });
    tagFiltersContainer.appendChild(btn);
  });
}

// ============================================
// 10. Natural Language Parser
// ============================================
function parseNaturalLanguage(text) {
  var parsedText = text;
  var deadline = null;
  var tags = [];
  var now = new Date();

  // Extract hashtags
  var hashtagRegex = /#([\w-]+)/g;
  var match;
  while ((match = hashtagRegex.exec(text)) !== null) {
    tags.push(match[1]);
  }
  parsedText = parsedText.replace(hashtagRegex, '').trim();

  // Date patterns (most specific first)
  var datePatterns = [
    {
      regex: /\btomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      handler: function(m) {
        var d = new Date(now);
        d.setDate(d.getDate() + 1);
        setTimeFromMatch(d, m[1], m[2], m[3]);
        return d;
      }
    },
    {
      regex: /\btoday\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      handler: function(m) {
        var d = new Date(now);
        setTimeFromMatch(d, m[1], m[2], m[3]);
        return d;
      }
    },
    {
      regex: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: function(m) {
        var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        var target = days.indexOf(m[1].toLowerCase());
        var d = new Date(now);
        var diff = target - d.getDay();
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        d.setHours(9, 0, 0, 0);
        return d;
      }
    },
    {
      regex: /\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: function(m) {
        var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        var target = days.indexOf(m[1].toLowerCase());
        var d = new Date(now);
        var diff = target - d.getDay();
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        d.setHours(9, 0, 0, 0);
        return d;
      }
    },
    {
      regex: /\btomorrow\b/i,
      handler: function() {
        var d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      }
    },
    {
      regex: /\btoday\b/i,
      handler: function() {
        var d = new Date(now);
        d.setHours(23, 59, 0, 0);
        return d;
      }
    },
    {
      regex: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      handler: function(m) {
        var d = new Date(now);
        setTimeFromMatch(d, m[1], m[2], m[3]);
        return d;
      }
    },
    {
      regex: /\bin\s+(\d+)\s+(hour|hr|minute|min)s?\b/i,
      handler: function(m) {
        var d = new Date(now);
        var amount = parseInt(m[1]);
        if (m[2].startsWith('hour') || m[2] === 'hr') d.setHours(d.getHours() + amount);
        else d.setMinutes(d.getMinutes() + amount);
        return d;
      }
    }
  ];

  for (var i = 0; i < datePatterns.length; i++) {
    var m = parsedText.match(datePatterns[i].regex);
    if (m) {
      deadline = datePatterns[i].handler(m);
      parsedText = parsedText.replace(datePatterns[i].regex, '').trim();
      break;
    }
  }

  parsedText = parsedText.replace(/\s+/g, ' ').trim();
  return { text: parsedText, deadline: deadline, tags: tags };
}

function setTimeFromMatch(date, hourStr, minStr, ampm) {
  var hour = parseInt(hourStr);
  var min = minStr ? parseInt(minStr) : 0;
  if (ampm) {
    if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
  }
  date.setHours(hour, min, 0, 0);
}

// ============================================
// 11. Bottom Sheet Controller
// ============================================
function openSheet(editTaskId) {
  sheetEditingId = editTaskId || null;
  sheetPriority = 'medium';
  sheetDeadline = null;
  selectedDate = null;
  sheetCalendar.classList.remove('calendar--visible');

  if (sheetEditingId) {
    var t = tasks.find(function(task) { return task.id === sheetEditingId; });
    if (t) {
      sheetTaskInput.value = t.text;
      sheetPriority = t.priority;
      sheetDeadline = t.deadline || null;
    }
  } else {
    sheetTaskInput.value = '';
  }

  updateSheetPriorityUI();
  updateSheetParsedDisplay();
  sheetOverlay.classList.add('sheet-overlay--visible');
  sheet.classList.add('sheet--open');
  sheetOpen = true;
  setTimeout(function() { sheetTaskInput.focus(); }, 350);
}

function closeSheet() {
  sheetOverlay.classList.remove('sheet-overlay--visible');
  sheet.classList.remove('sheet--open');
  sheetCalendar.classList.remove('calendar--visible');
  sheetOpen = false;
  sheetEditingId = null;
  sheetTaskInput.value = '';
  sheetParsed.innerHTML = '';
}

function updateSheetPriorityUI() {
  document.querySelectorAll('.sheet__priority-btn').forEach(function(btn) {
    btn.classList.toggle('sheet__priority-btn--active', btn.dataset.priority === sheetPriority);
  });
}

function updateSheetParsedDisplay() {
  var parsed = parseNaturalLanguage(sheetTaskInput.value);
  var parts = [];

  var effectiveDeadline = sheetDeadline ? new Date(sheetDeadline) : parsed.deadline;
  if (effectiveDeadline) {
    parts.push('<span class="sheet__parsed-date">' + new Intl.DateTimeFormat('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(effectiveDeadline) + '</span>');
  }
  if (parsed.tags.length) {
    parts.push(parsed.tags.map(function(t) {
      return '<span class="sheet__parsed-tag">#' + escapeHTML(t) + '</span>';
    }).join(' '));
  }
  sheetParsed.innerHTML = parts.join(' ');
}

// ============================================
// 12. Task Actions
// ============================================
function addTask(rawText, priority, manualDeadline) {
  if (!rawText.trim()) return;
  var parsed = parseNaturalLanguage(rawText);
  var deadline = manualDeadline || (parsed.deadline ? parsed.deadline.toISOString() : null);

  tasks.unshift({
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    text: parsed.text,
    completed: false,
    priority: priority || 'medium',
    deadline: deadline,
    details: '',
    tags: parsed.tags,
    subtasks: [],
    order: 0
  });

  tasks.forEach(function(t, i) { t.order = i; });
  saveTasks();
  renderTagFilters();
  renderTasks();
  scheduleNotifications();
}

function deleteTask(id) {
  var idx = tasks.findIndex(function(t) { return t.id === id; });
  if (idx === -1) return;

  var task = Object.assign({}, tasks[idx]);
  var li = document.querySelector('.task-item[data-id="' + CSS.escape(id) + '"]');

  if (li) li.classList.add('task-item--removing');

  setTimeout(function() {
    var currentIdx = tasks.findIndex(function(t) { return t.id === id; });
    if (currentIdx !== -1) {
      tasks.splice(currentIdx, 1);
      saveTasks();
      renderTagFilters();
      renderTasks();
    }
  }, 300);

  showToast('Task deleted', 'Undo', function() {
    tasks.splice(idx, 0, task);
    saveTasks();
    renderTagFilters();
    renderTasks();
  });
}

function toggleComplete(id) {
  var t = tasks.find(function(task) { return task.id === id; });
  if (!t) return;
  t.completed = !t.completed;
  saveTasks();

  if (t.completed) {
    var li = document.querySelector('.task-item[data-id="' + CSS.escape(id) + '"]');
    if (li) li.classList.add('task-item--completing');
    setTimeout(function() { renderTasks(); }, 500);
  } else {
    renderTasks();
  }
}

function rescheduleToTomorrow(id) {
  var t = tasks.find(function(task) { return task.id === id; });
  if (!t) return;
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (t.deadline) {
    var dl = new Date(t.deadline);
    tomorrow.setHours(dl.getHours(), dl.getMinutes(), 0, 0);
  } else {
    tomorrow.setHours(9, 0, 0, 0);
  }
  t.deadline = tomorrow.toISOString();
  saveTasks();
  renderTasks();
  showToast('Moved to tomorrow');
}

function clearCompleted() {
  var cleared = tasks.filter(function(t) { return t.completed; });
  if (cleared.length === 0) return;
  tasks = tasks.filter(function(t) { return !t.completed; });
  saveTasks();
  renderTagFilters();
  renderTasks();
  showToast('Cleared ' + cleared.length + ' task' + (cleared.length !== 1 ? 's' : ''), 'Undo', function() {
    tasks = tasks.concat(cleared);
    saveTasks();
    renderTagFilters();
    renderTasks();
  });
}

// ============================================
// 13. Gesture Handlers
// ============================================
function attachGestureListeners(li, taskId) {
  var swipeEl = li.querySelector('.task-item__swipe');
  if (!swipeEl) return;

  if (hasTouch) {
    var startX = 0, startY = 0, currentX = 0, swiping = false, direction = null;
    var THRESHOLD = 80;
    var ANGLE_THRESHOLD = 30;

    swipeEl.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = startX;
      swiping = false;
      direction = null;
      swipeEl.style.transition = 'none';

      longPressTimer = setTimeout(function() {
        if (!swiping) {
          if (navigator.vibrate) navigator.vibrate(30);
          openEditModal(taskId);
        }
      }, 500);
    }, { passive: true });

    swipeEl.addEventListener('touchmove', function(e) {
      currentX = e.touches[0].clientX;
      var currentY = e.touches[0].clientY;
      var diffX = currentX - startX;
      var diffY = currentY - startY;

      if (!direction && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
        var angle = Math.abs(Math.atan2(diffY, diffX) * 180 / Math.PI);
        if (angle < ANGLE_THRESHOLD || angle > (180 - ANGLE_THRESHOLD)) {
          direction = 'horizontal';
          swiping = true;
          clearTimeout(longPressTimer);
        } else {
          direction = 'vertical';
          clearTimeout(longPressTimer);
          return;
        }
      }

      if (direction === 'horizontal') {
        e.preventDefault();
        swipeEl.style.transform = 'translateX(' + diffX + 'px)';
      }
    }, { passive: false });

    swipeEl.addEventListener('touchend', function() {
      clearTimeout(longPressTimer);
      var diffX = currentX - startX;
      swipeEl.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

      if (Math.abs(diffX) > THRESHOLD) {
        if (diffX < 0) {
          swipeEl.style.transform = 'translateX(-100%)';
          setTimeout(function() {
            var t = tasks.find(function(task) { return task.id === taskId; });
            if (t) {
              if (t.completed) {
                deleteTask(taskId);
              } else {
                t.completed = true;
                saveTasks();
                renderTasks();
                showToast('Task completed', 'Undo', function() {
                  t.completed = false;
                  saveTasks();
                  renderTasks();
                });
              }
            }
          }, 300);
        } else {
          swipeEl.style.transform = 'translateX(100%)';
          setTimeout(function() { rescheduleToTomorrow(taskId); }, 300);
        }
      } else {
        swipeEl.style.transform = 'translateX(0)';
      }
    });
  } else {
    // Desktop: hover action buttons
    var actions = document.createElement('div');
    actions.className = 'task-item__hover-actions';
    actions.innerHTML =
      '<button class="hover-action hover-action--edit" data-action="edit" title="Edit">&#9998;</button>' +
      '<button class="hover-action hover-action--tomorrow" data-action="tomorrow" title="Move to tomorrow">&#8594;</button>' +
      '<button class="hover-action hover-action--delete" data-action="delete" title="Delete">&times;</button>';
    swipeEl.appendChild(actions);

    actions.addEventListener('click', function(e) {
      var btn = e.target.closest('.hover-action');
      if (!btn) return;
      e.stopPropagation();
      var action = btn.dataset.action;
      if (action === 'edit') openEditModal(taskId);
      else if (action === 'tomorrow') rescheduleToTomorrow(taskId);
      else if (action === 'delete') deleteTask(taskId);
    });
  }
}

// ============================================
// 14. Edit Modal
// ============================================
function openEditModal(taskId) {
  var t = tasks.find(function(task) { return task.id === taskId; });
  if (!t) return;

  var dlValue = t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : '';

  var subtasksHTML = (t.subtasks || []).map(function(st, i) {
    return '<div class="edit-subtask">' +
      '<input type="checkbox" class="edit-subtask__check" data-st-idx="' + i + '"' + (st.completed ? ' checked' : '') + '>' +
      '<span class="' + (st.completed ? 'edit-subtask--done' : '') + '">' + escapeHTML(st.text) + '</span>' +
      '<button class="edit-subtask__del" data-st-idx="' + i + '" type="button">&times;</button>' +
      '</div>';
  }).join('');

  openModal('Edit Task',
    '<div class="edit-form">' +
    '<input type="text" class="edit-form__input" id="edit-text" value="' + escapeHTML(t.text) + '" placeholder="Task name...">' +
    '<input type="text" class="edit-form__input" id="edit-details" value="' + escapeHTML(t.details || '') + '" placeholder="Details...">' +
    '<input type="text" class="edit-form__input" id="edit-tags" value="' + escapeHTML((t.tags || []).join(', ')) + '" placeholder="Tags (comma separated)...">' +
    '<input type="datetime-local" class="edit-form__input" id="edit-deadline" value="' + dlValue + '">' +
    '<div class="edit-form__priority">' +
    '<button type="button" class="edit-priority-btn ' + (t.priority === 'low' ? 'active' : '') + '" data-p="low">Low</button>' +
    '<button type="button" class="edit-priority-btn ' + (t.priority === 'medium' ? 'active' : '') + '" data-p="medium">Med</button>' +
    '<button type="button" class="edit-priority-btn ' + (t.priority === 'high' ? 'active' : '') + '" data-p="high">High</button>' +
    '</div>' +
    '<div class="edit-subtasks" id="edit-subtasks">' +
    subtasksHTML +
    '<input type="text" class="edit-form__input" id="edit-new-subtask" placeholder="Add subtask...">' +
    '</div>' +
    '<div class="edit-form__actions">' +
    '<button class="edit-form__save" id="edit-save">Save</button>' +
    '<button class="edit-form__delete" id="edit-delete">Delete</button>' +
    '</div>' +
    '</div>'
  );

  // Priority buttons
  document.querySelectorAll('.edit-priority-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.edit-priority-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // Subtask checkboxes
  document.querySelectorAll('.edit-subtask__check').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var idx = parseInt(cb.dataset.stIdx);
      if (t.subtasks[idx]) {
        t.subtasks[idx].completed = cb.checked;
        saveTasks();
        var span = cb.nextElementSibling;
        span.classList.toggle('edit-subtask--done', cb.checked);
      }
    });
  });

  // Subtask delete
  document.querySelectorAll('.edit-subtask__del').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(btn.dataset.stIdx);
      t.subtasks.splice(idx, 1);
      saveTasks();
      openEditModal(taskId);
    });
  });

  // Add subtask
  document.getElementById('edit-new-subtask').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var val = e.target.value.trim();
      if (val) {
        t.subtasks.push({ id: crypto.randomUUID(), text: val, completed: false });
        saveTasks();
        openEditModal(taskId);
      }
    }
  });

  // Save
  document.getElementById('edit-save').addEventListener('click', function() {
    t.text = document.getElementById('edit-text').value.trim() || t.text;
    t.details = document.getElementById('edit-details').value.trim();
    t.tags = document.getElementById('edit-tags').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var dlVal = document.getElementById('edit-deadline').value;
    t.deadline = dlVal ? new Date(dlVal).toISOString() : null;
    var activeP = document.querySelector('.edit-priority-btn.active');
    if (activeP) t.priority = activeP.dataset.p;
    saveTasks();
    closeModal();
    renderTagFilters();
    renderTasks();
  });

  // Delete
  document.getElementById('edit-delete').addEventListener('click', function() {
    closeModal();
    deleteTask(taskId);
  });
}

// ============================================
// 15. Settings Modal
// ============================================
function openSettings() {
  var currentTheme = localStorage.getItem('taskflow_theme') || 'auto';
  var completedCount = tasks.filter(function(t) { return t.completed; }).length;
  var notifStatus = ('Notification' in window && Notification.permission === 'granted') ? 'Enabled' : 'Enable';

  openModal('Settings',
    '<div class="settings-list">' +
    '<div class="settings-item"><span>Theme</span>' +
    '<select id="settings-theme" class="settings-select">' +
    '<option value="auto"' + (currentTheme === 'auto' ? ' selected' : '') + '>Auto (System)</option>' +
    '<option value="light"' + (currentTheme === 'light' ? ' selected' : '') + '>Light</option>' +
    '<option value="dark"' + (currentTheme === 'dark' ? ' selected' : '') + '>Dark</option>' +
    '</select></div>' +
    '<div class="settings-item"><span>Notifications</span>' +
    '<button class="settings-btn" id="settings-notif">' + notifStatus + '</button></div>' +
    '<div class="settings-item"><span>Export tasks</span>' +
    '<button class="settings-btn" id="settings-export">Export JSON</button></div>' +
    '<div class="settings-item"><span>Import tasks</span>' +
    '<label class="settings-btn">Choose File<input type="file" id="settings-import" accept=".json" hidden></label></div>' +
    '<div class="settings-item"><span>Keyboard shortcuts</span>' +
    '<button class="settings-btn" id="settings-shortcuts">View</button></div>' +
    (completedCount > 0 ?
      '<div class="settings-item"><span>Clear ' + completedCount + ' completed</span>' +
      '<button class="settings-btn settings-btn--danger" id="settings-clear">Clear</button></div>' : '') +
    '</div>'
  );

  document.getElementById('settings-theme').addEventListener('change', function(e) { setTheme(e.target.value); });
  document.getElementById('settings-export').addEventListener('click', exportTasks);
  document.getElementById('settings-import').addEventListener('change', function(e) {
    if (e.target.files[0]) { importTasks(e.target.files[0]); closeModal(); }
  });
  document.getElementById('settings-shortcuts').addEventListener('click', showShortcutsModal);
  document.getElementById('settings-notif').addEventListener('click', function() {
    requestNotificationPermission();
    var btn = document.getElementById('settings-notif');
    if (btn) btn.textContent = 'Requested';
  });
  var clearBtn = document.getElementById('settings-clear');
  if (clearBtn) clearBtn.addEventListener('click', function() { clearCompleted(); closeModal(); });
}

function showShortcutsModal() {
  openModal('Keyboard Shortcuts',
    '<div class="shortcuts-list">' +
    '<div class="shortcut-row"><kbd>n</kbd><span>New task</span></div>' +
    '<div class="shortcut-row"><kbd>/</kbd><span>Focus search (All view)</span></div>' +
    '<div class="shortcut-row"><kbd>1</kbd><span>Switch to Today</span></div>' +
    '<div class="shortcut-row"><kbd>2</kbd><span>Switch to All</span></div>' +
    '<div class="shortcut-row"><kbd>,</kbd><span>Open Settings</span></div>' +
    '<div class="shortcut-row"><kbd>?</kbd><span>This help</span></div>' +
    '<div class="shortcut-row"><kbd>Esc</kbd><span>Close / Cancel</span></div>' +
    '</div>'
  );
}

// ============================================
// 16. Export / Import
// ============================================
function exportTasks() {
  var data = JSON.stringify(tasks, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'taskflow-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Tasks exported');
}

function importTasks(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      imported.forEach(function(t) {
        if (!t.text) throw new Error('Invalid task data');
        if (!t.id) t.id = crypto.randomUUID();
        if (!t.createdAt) t.createdAt = Date.now();
        if (!t.tags) t.tags = [];
        if (!t.subtasks) t.subtasks = [];
        if (t.order === undefined) t.order = 0;
        if (t.priority === undefined) t.priority = 'medium';
        if (t.completed === undefined) t.completed = false;
        if (t.details === undefined) t.details = '';
      });
      tasks = imported;
      saveTasks();
      renderTagFilters();
      renderTasks();
      showToast('Imported ' + imported.length + ' task' + (imported.length !== 1 ? 's' : ''));
    } catch (err) {
      showToast('Import failed: invalid file');
    }
  };
  reader.readAsText(file);
}

// ============================================
// 17. Notifications
// ============================================
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function scheduleNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  var now = Date.now();
  tasks.forEach(function(t) {
    if (t.completed || !t.deadline || t._notified) return;
    var dl = new Date(t.deadline).getTime();
    var diff = dl - now;
    if (diff > 0 && diff <= 10 * 60 * 1000) {
      var delay = Math.max(diff - 5 * 60 * 1000, 0);
      setTimeout(function() {
        if (!t.completed) {
          new Notification('TaskFlow', {
            body: '"' + t.text + '" is due ' + (diff <= 5 * 60 * 1000 ? 'now' : 'in 5 minutes'),
            tag: t.id
          });
        }
      }, delay);
      t._notified = true;
    }
  });
}

// ============================================
// 18. Render Tasks
// ============================================
function renderTasks() {
  taskList.innerHTML = '';
  var filtered = getFilteredTasks();

  if (filtered.length === 0) {
    var isSearching = currentSearch || activeTagFilter;
    var emptyIcon = isSearching ? '&#128269;' : (currentView === 'today' ? '&#9734;' : '&#9745;');
    var emptyText = isSearching
      ? 'No tasks match your search.'
      : (currentView === 'today' ? 'Nothing for today. Enjoy!' : 'No tasks yet. Tap + to add one.');
    taskList.innerHTML = '<li class="task-list__empty">' +
      '<div class="empty-state__icon">' + emptyIcon + '</div>' +
      '<div class="empty-state__text">' + emptyText + '</div>' +
      '</li>';
    updateProgress();
    return;
  }

  filtered.forEach(function(t) {
    var li = document.createElement('li');
    li.className = 'task-item task-item--priority-' + (t.priority || 'medium') + (t.completed ? ' task-item--completed' : '');
    li.dataset.id = t.id;

    var info = getDeadlineInfo(t.deadline);
    var deadlineHTML = info
      ? '<div class="task-item__deadline ' + (info.urgent ? 'task-item__deadline--urgent' : '') + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
        escapeHTML(info.dateStr) + ' &middot; ' + escapeHTML(info.text) +
        '</div>'
      : '';

    var subtasksDone = (t.subtasks || []).filter(function(s) { return s.completed; }).length;
    var subtasksTotal = (t.subtasks || []).length;
    var subtaskHTML = subtasksTotal > 0
      ? '<span class="task-item__subtask-count">' + subtasksDone + '/' + subtasksTotal + '</span>'
      : '';

    var tagsHTML = (t.tags || []).length > 0
      ? '<div class="task-item__tags">' + t.tags.map(function(tag) {
          return '<span class="task-item__tag">#' + escapeHTML(tag) + '</span>';
        }).join('') + '</div>'
      : '';

    var priorityDot = '<span class="priority-dot priority-dot--' + t.priority + '"></span>';

    li.innerHTML =
      '<div class="task-item__action-left">&#10003; Complete</div>' +
      '<div class="task-item__action-right">Tomorrow &#8594;</div>' +
      '<div class="task-item__swipe">' +
      '<input type="checkbox" class="task-item__checkbox"' + (t.completed ? ' checked' : '') + '>' +
      '<div class="task-item__content">' +
      '<div class="task-item__title-row">' +
      priorityDot +
      '<span class="task-item__text">' + escapeHTML(t.text) + '</span>' +
      subtaskHTML +
      '</div>' +
      deadlineHTML +
      tagsHTML +
      '</div>' +
      '</div>';

    // Checkbox handler
    var checkbox = li.querySelector('.task-item__checkbox');
    checkbox.addEventListener('change', function(e) {
      e.stopPropagation();
      toggleComplete(t.id);
    });

    // Gesture / hover actions
    attachGestureListeners(li, t.id);

    taskList.appendChild(li);
  });

  updateProgress();
}

// ============================================
// 19. Event Listeners
// ============================================
navToggle.addEventListener('click', function() {
  switchView(currentView === 'today' ? 'all' : 'today');
});
navSettings.addEventListener('click', function() { openSettings(); });
fabAdd.addEventListener('click', function() { openSheet(); });
sheetOverlay.addEventListener('click', closeSheet);

sheetForm.addEventListener('submit', function(e) {
  e.preventDefault();
  var rawText = sheetTaskInput.value;
  if (!rawText.trim()) return;

  if (sheetEditingId) {
    var t = tasks.find(function(task) { return task.id === sheetEditingId; });
    if (t) {
      var parsed = parseNaturalLanguage(rawText);
      t.text = parsed.text;
      if (parsed.deadline) t.deadline = parsed.deadline.toISOString();
      if (sheetDeadline) t.deadline = sheetDeadline;
      if (parsed.tags.length) t.tags = Array.from(new Set(t.tags.concat(parsed.tags)));
      t.priority = sheetPriority;
      saveTasks();
    }
  } else {
    addTask(rawText, sheetPriority, sheetDeadline);
  }
  closeSheet();
  renderTagFilters();
  renderTasks();
});

sheetTaskInput.addEventListener('input', updateSheetParsedDisplay);

document.querySelectorAll('.sheet__priority-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    sheetPriority = btn.dataset.priority;
    updateSheetPriorityUI();
  });
});

sheetDateBtn.addEventListener('click', function() {
  sheetCalendar.classList.toggle('calendar--visible');
  if (sheetCalendar.classList.contains('calendar--visible')) renderCalendar();
});

prevMonthBtn.addEventListener('click', function() { pickerDate.setMonth(pickerDate.getMonth() - 1); renderCalendar(); });
nextMonthBtn.addEventListener('click', function() { pickerDate.setMonth(pickerDate.getMonth() + 1); renderCalendar(); });

confirmDeadlineBtn.addEventListener('click', function() {
  if (selectedDate) {
    var timeParts = timeInput.value.split(':');
    selectedDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]));
    sheetDeadline = selectedDate.toISOString();
    updateSheetParsedDisplay();
  }
  sheetCalendar.classList.remove('calendar--visible');
});

searchInput.addEventListener('input', function(e) {
  currentSearch = e.target.value;
  renderTasks();
});

sortSelect.addEventListener('change', function(e) {
  currentSort = e.target.value;
  localStorage.setItem('taskflow_sort', currentSort);
  renderTasks();
});

// Global keyboard shortcuts
document.addEventListener('keydown', function(e) {
  var isInput = ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(document.activeElement.tagName) !== -1;

  if (e.key === 'Escape') {
    if (sheetOpen) { closeSheet(); return; }
    if (modalOverlay.classList.contains('modal-overlay--visible')) { closeModal(); return; }
    if (isInput) { document.activeElement.blur(); return; }
  }

  if (isInput) return;

  if (e.key === 'n') { e.preventDefault(); openSheet(); }
  else if (e.key === '/') { e.preventDefault(); switchView('all'); setTimeout(function() { searchInput.focus(); }, 100); }
  else if (e.key === '1') { e.preventDefault(); switchView('today'); }
  else if (e.key === '2') { e.preventDefault(); switchView('all'); }
  else if (e.key === '?') { e.preventDefault(); showShortcutsModal(); }
  else if (e.key === ',') { e.preventDefault(); openSettings(); }
});

// Settings keyboard shortcut already handled in keydown listener

// ============================================
// 20. Init
// ============================================
loadTheme();
loadTasks();
updateGreeting();

// Restore saved sort preference
var savedSort = localStorage.getItem('taskflow_sort');
if (savedSort) { currentSort = savedSort; sortSelect.value = savedSort; }

renderTagFilters();
renderTasks();
requestNotificationPermission();

setInterval(function() {
  updateGreeting();
  scheduleNotifications();
}, 60000);
