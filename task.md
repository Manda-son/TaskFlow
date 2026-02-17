# TaskFlow Overhaul Tasks

## Phase 1: MVP UI Restructuring (Day 1)
- [ ] **Scaffold New Layout**
  - [ ] Create bottom navigation bar (Icons: Today, Add, All).
  - [ ] Remove top header and existing filter buttons.
  - [ ] Create "Today" and "All Tasks" containers (views).
- [ ] **Floating Action Button (FAB)**
  - [ ] Implement FAB styling and position.
  - [ ] Create "Add Task" bottom sheet/modal triggered by FAB.
- [ ] **Visual Cleanup (CSS)**
  - [ ] Update `style.css` to remove borders and increase whitespace.
  - [ ] Implement dynamic "Greeting / Date" header.
  - [ ] Refactor task items to be minimal (no visible delete buttons by default).

## Phase 2: Smart Input & Interaction (Day 1-2)
- [ ] **Smart Input Logic**
  - [ ] Implement `parseDateFromText(text)` function using Regex.
  - [ ] Connect input field to parser for real-time feedback (optional) or on-submit processing.
- [ ] **Gestures**
  - [ ] Implement `touchstart`, `touchmove`, `touchend` handlers on task items.
  - [ ] Logic: Swipe Right -> Reschedule (Tomorrow).
  - [ ] Logic: Swipe Left -> Delete / Archive.
- [ ] **Long Press Interaction**
  - [ ] Implement long-press timer to trigger Edit Modal.

## Phase 3: Essentials & Polish (Week 2)
- [ ] **Subtasks & Details**
  - [ ] Enhance Edit Modal to show Subtasks interactions.
  - [ ] Add completion progress indicator to main list item.
- [ ] **Tags System**
  - [ ] Implement simple hashtag parsing (e.g., "Buy milk #personal") or tag pills.
- [ ] **Notifications**
  - [ ] Request Notification permissions.
  - [ ] Schedule local notifications for tasks with specific times.
