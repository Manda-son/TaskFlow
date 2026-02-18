# Life RPG Overhaul Tasks

## Phase 1: Core Mechanics (Goals & XP)
- [ ] **Data Structure Refactor**
  - [ ] Define `MacroGoal` structure (id, name, level, xp).
  - [ ] Define `DailyQuest` structure (linked to Goal, type: boolean/numeric).
  - [ ] detailed `app.js` state migration (clear old data for new system).
- [ ] **Macro Goal UI (Home Tab)**
  - [ ] Create "Character Sheet" view.
  - [ ] Render Goal Cards with Level badges and XP progress bars.
- [ ] **Quest Interaction**
  - [ ] Update Task Item to support numeric input (e.g., "2150 / 2500 kcal").
  - [ ] Implement XP logic: Completion = XP add + Animation.

## Phase 2: The Game Clock (Time & Schedule)
- [ ] **Schedule Settings**
  - [ ] Create Input for "Wake Up Time" and "Bedtime".
  - [ ] Store schedule in local storage.
- [ ] **Time Display**
  - [ ] Implement "Day Progress" bar (Current Time vs Bedtime).
  - [ ] Add dynamic text: "4 hours left to grind".

## Phase 3: Gamification Polish
- [ ] **Streak System**
  - [ ] Logic: Check if >80% quests completed yesterday.
  - [ ] Visual: Flame icon with day count.
- [ ] **Visuals**
  - [ ] "Level Up" modal/confetti.
  - [ ] Dark/Light mode refinement for new components.
