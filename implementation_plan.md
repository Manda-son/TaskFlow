# TaskFlow: Life RPG Transformation Plan

This plan outlines the evolution of TaskFlow from a minimalist to-do list into a **gamified accountability engine**. The core philosophy shifts from "managing tasks" to "leveling up your life" through strict consistency and quantified self-tracking.

## Data Structure
**Confirmed**: We are moving from a flat task list to a hierarchical `Goal -> Daily Quest` system.
**Strict Mode**: The app will enforce a "Day" concept based on the user's wake/sleep cycle.

## Concept: The "Life RPG" System

### 1. Macro Goals (The "Skill Trees")
Instead of generic lists, the user defines top-level **Macro Goals**.
*   **Example**: Gym, Study, Business.
*   **Mechanic**: Each goal has a **Level** and **XP Bar**.
*   **Visual**: Large cards on the "Home" tab showing current level and progress (e.g., "Gym - Lvl 12").

### 2. Micro Quests (The "Daily Grind")
Daily actions that feed into Macro Goals.
*   **Types**:
    *   *Boolean*: "Go to Gym" (Yes/No).
    *   *Quantifiable*: "Calories" (Input: 2150 / Target: 2150), "Water" (Input: 1.5L / Target: 2L).
*   **Mechanic**: Completing a quest grants XP to the specific Macro Goal it belongs to.

### 3. The "Game Clock" (Time Management)
*   **Inputs**: User sets **Wake Up Time** and **Bedtime**.
*   **Display**: A prominent "Action Points Remaining" or "Time Left" countdown in the UI, calculated from *Current Time* to *Bedtime*.
*   **Psychology**: Creates urgency to finish quests before the "server reset" (sleep).

### 4. Gamification & Accountability
*   **Streaks**: Global streak for days with >80% completion.
*   **Anti-Void**: Visual alerts (color shifts) when time is running out and progress is low.
*   **Daily Recap**: A "Level Complete" screen at bedtime showing XP gained.

## Proposed Changes

### 1. Data Model (`app.js`)
*   **New `Goal` Class**: `{ id, title, level, currentXP, nextLevelXP, color }`
*   **Enhanced `Task` Class**:
    *   `type`: 'checkbox' | 'counter'
    *   `targetValue`: (e.g., 2150)
    *   `currentValue`: (e.g., 1400)
    *   `parentId`: Links to Macro Goal
    *   `xpReward`: Amount of XP granted on completion.

### 2. UI Overhaul (`index.html`, `style.css`)
*   **Home Tab (Character Sheet)**:
    *   Top: "Time Left Today" Progress Bar (Visualizing the Wake-Sleep window).
    *   Body: Macro Goal Cards with Level & Progress Bars.
*   **Quests Tab (The Log)**:
    *   List of today's Micro Quests grouped by Goal.
    *   Swipe right to complete (or tap to enter numbers).
*   **Settings**:
    *   Bedtime / Wake Up time configuration.

### 3. Logic & Persistence
*   **Midnight/Bedtime Reset**: Logic to auto-reset daily quests for the next day while keeping the Macro Goal progress.
*   **XP Calculation**: Simple formula (e.g., `Level * 100 XP` to advance).

## Comparison: Current vs. New

| Feature | Current TaskFlow | Life RPG Vision |
| :--- | :--- | :--- |
| **Structure** | Flat list of tasks with tags | **Hierarchical**: Macro Goal -> Micro Daily Quests |
| **Input** | Text + Checkbox | **Quantifiable**: Text + Numeric Inputs + Validation |
| **Timing** | Simple Deadlines | **Game Clock**: Countdown based on rigid sleep schedule |
| **Progress** | List gets smaller | **Growth**: XP Bars fill up, Levels increase |
| **Vibe** | Minimalist Tool | **Gamified Dashboard** |

## Phased Implementation Roadmap

### Phase 1: The Core Loop (Goals & Quests)
- [ ] Define Goals (Gym, Study, Business) in code/storage.
- [ ] Create "Daily Quest" creation UI with numeric targets.
- [ ] Implement XP gain logic (Task completion -> Goal XP).

### Phase 2: The Timekeeper
- [ ] Implement Bedtime/Wake Up settings.
- [ ] Create the "Time Remaining" visualization (Countdown bar).

### Phase 3: The Polish (Visuals)
- [ ] Design "Level Up" animations.
- [ ] Create specific icons/themes for each Goal.
- [ ] Implement the "Streak" flame logic.

## Verification Plan
### Manual Verification
- **XP Check**: Complete 3 "Gym" quests -> Verify "Gym" XP bar increases.
- **Reset Logic**: Manually trigger "New Day" function -> Verify quests reset but XP remains.
- **Clock Check**: Change system time to 1 hour before bedtime -> Verify UI warns of "Low Time".
