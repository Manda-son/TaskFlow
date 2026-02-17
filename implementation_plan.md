# TaskFlow Minimalist Overhaul Plan

This plan details the transformation of TaskFlow from a standard to-do list into a competitive, minimalist, mobile-first productivity application. The goal is to reduce visual weight, improve interaction speed, and focus on "Today" vs. "Everything else".

- **Vanilla JS**: Confirmed. We will use vanilla JavaScript for all interactions, including gestures, to maintain a lightweight footprint without external dependencies.

## Proposed Changes

### 1. UI Redesign: The "Lightweight" Feel
**Files**: `index.html`, `style.css`
- **Bottom Navigation**: Replace the current top-heavy header/filter bar with a fixed bottom navigation bar containing:
  - **Today** (Star icon): Default view. Shows only tasks due today or overdue.
  - **Add (+) ** (Big center button): Floating Action Button (FAB) style.
  - **All** (List icon): Infinite scroll list of all tasks.
- **Header Removal**: Remove the large "TaskFlow" header. Replace with a minimal, dynamic header that changes based on the view (e.g., "You can do everything you put your mind to" or just "Today").
- **Visuals**:
  - Remove all borders from input fields.
  - Use whitespace to separate tasks instead of lines/boxes.
  - Subtle shadows for depth (neumorphism-lite or material design).
  - **Auto Dark/Light Theme**: Use system preference query (`prefers-color-scheme`) by default, with an optional toggle hidden in settings.

### 2. Interaction Model: Quick & Fluid
**Files**: `app.js`, `style.css`
- **Floating Quick Add**:
  - Clicking the bottom "+" opens a modal or bottom sheet (slide-up).
  - **Natural Language Input**: The input field will listen for keywords like "tomorrow", "next friday", "at 6pm".
  - **Mini parsing logic**: We will implement a Regex-based parser in `app.js` to extract dates/times from the text automatically.
- **Gestures**:
  - **Swipe Right**: Reschedule task (e.g., move to Tomorrow).
  - **Swipe Left**: Complete task (move to bottom/fade) or Delete.
  - **Long Press**: Trigger "Edit Mode" (open modal to edit text) or "Selection Mode" (multi-select to delete).
- **Checkbox**:
  - Make checkboxes larger and circular (Apple Reminders style).
  - Animation: On check, the task text strikethroughs and gently slides down or fades.

### 3. Core Logic & Data Structure
**Files**: `app.js`
- **Date Management**:
  - Every task needs a `dueDate` property (timestamp) to sort into "Today" vs "Later".
  - Logic to auto-move overdue tasks to "Today".
- **Priorities**:
  - Visuals: Small colored dot or side border (Red=High, Orange=Med, Blue=Low/None). No large badges.
- **Subtasks**:
  - Display progress (e.g., "1/3") on the main list item.
  - In detail view (long press), show nested checkboxes.
- **Offline & Sync**:
  - LocalStorage is already implemented. We will optimize `saveTasks()` to be debounced and robust.
  - Add "Export to JSON" as a hidden option in a "Settings" slide-out menu (swipe left from edge?).

## Phased Implementation Roadmap

### Phase 1: MVP (The "Feel")
- [ ] Refactor HTML structure to Bottom Tab Layout.
- [ ] Implement the "Today" vs "All" view logic.
- [ ] CSS Overhaul: Whitespace, typography, remove heavy borders.
- [ ] Add the Floating Action Button (FAB) for new tasks.

### Phase 2: Smart Input & Gestures
- [ ] Implement Natural Language Processing for dates (Regex based).
- [ ] Add Touch Event listeners for Swipe (Left/Right) gestures.
- [ ] Add Long-press detection for Edit.

### Phase 3: Polish & Essentials
- [ ] Refine Animations (Task completion, page transitions).
- [ ] Implement Subtasks listing in detail view.
- [ ] Add "Tags" as simple clickable pills in the edit view.
- [ ] Local Push Notifications (using Notification API).

## Verification Plan
### Manual Verification
- **Mobile Emulation**: Test swipe gestures using Chrome DevTools mobile emulator.
- **NLP Testing**: Input "Walk dog tomorrow at 5pm" -> Verify task is created with correct due date and time.
- **Theme Testing**: Toggle system dark mode preference and verify app adapts instantly.
- **Performance**: Ensure "All Tasks" list scrolls smoothly with 50+ items.
