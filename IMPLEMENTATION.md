# Upper+Outdoor App - Implementation Documentation

**Version:** 1.0.0 (MVP)
**Platform:** React Native (Expo)
**Implementation Date:** November 10, 2025
**Status:** ✅ Phase 1 MVP Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features Implemented](#features-implemented)
4. [Project Structure](#project-structure)
5. [Dependencies](#dependencies)
6. [Key Implementation Details](#key-implementation-details)
7. [Changelog](#changelog)
8. [Testing Guide](#testing-guide)
9. [Future Roadmap](#future-roadmap)

---

## Overview

Upper+Outdoor is a privacy-first, offline-first workout tracking app designed for:
- **3 gym upper-body days:** Push, Pull, Upper2
- **1 outdoor legs/core day:** Interval training + core circuit
- **Daily habits tracking:** Sleep, hydration, stretching, creatine
- **Local-first data:** All data stored on device with export/import

### Key Principles

✅ **Privacy-First:** No cloud, no analytics, no tracking
✅ **Offline-First:** Works perfectly without internet
✅ **Friction-Free:** 2 taps or less per set logging
✅ **Simple & Clear:** Plain language insights and guidance

---

## Architecture

### Technology Stack

- **Framework:** React Native (Expo SDK 51+)
- **Language:** TypeScript
- **Navigation:** React Navigation (Bottom Tabs + Stack)
- **Storage:** AsyncStorage (local-first)
- **Date Handling:** date-fns
- **Exercise Data:** Free Exercise DB (GitHub)
- **Haptics:** expo-haptics
- **Location:** expo-location (optional for outdoor GPS)
- **Notifications:** expo-notifications

### Data Flow

```
User Action → Screen Component → Service Layer → AsyncStorage
                                       ↓
                         Exercise DB (cached locally)
```

All data persists locally:
- Training sessions (gym + outdoor)
- Daily habits logs
- Weekly programs
- Workout plans
- Streaks and progress

---

## Features Implemented

### ✅ Core Features (Phase 1 MVP)

#### 1. Home / Today Screen
- **Location:** `src/screens/HomeScreen.tsx`
- **Features:**
  - Display today's day type (Push/Pull/Upper2/Outdoor/Rest)
  - Show current streaks (training, outdoor, habits)
  - Quick daily habits check-in view
  - "Start Session" button
  - Auto-initialization of exercise catalog and default workout plan

#### 2. Session Runner (Gym Days)
- **Location:** `src/screens/SessionRunnerScreen.tsx`
- **Features:**
  - Exercise-by-exercise workout flow
  - Weight and reps input with large tap targets
  - Auto rest timer (90s default)
  - Set history display
  - Progress bar showing workout completion
  - Continuous auto-save
  - Best set tracking per exercise

#### 3. Outdoor Timer
- **Location:** `src/screens/OutdoorTimerScreen.tsx`
- **Features:**
  - Configurable interval rounds (work: 45s, rest: 15s default)
  - Haptic feedback for phase transitions
  - Core circuit checklist (plank, leg raises, crunches, etc.)
  - Visual timer with work/rest color coding
  - Optional GPS tracking (UI ready, full implementation in Phase 2)

#### 4. Progress & Insights
- **Location:** `src/screens/ProgressScreen.tsx`
- **Features:**
  - Weekly summary (sessions completed, adherence %, outdoor status)
  - Total training volume
  - Volume breakdown by muscle group
  - Plain-language insights
  - Habits completion percentage
  - Pull-to-refresh

#### 5. Settings
- **Location:** `src/screens/SettingsScreen.tsx`
- **Features:**
  - Export backup (JSON file download/share)
  - Import backup (UI ready)
  - Training schedule display
  - Data management
  - Clear all data (danger zone)

---

## Project Structure

```
Rn-exp-workout-app/
├── App.tsx                          # Main app entry point
├── app.json                         # Expo config
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── IMPLEMENTATION.md                # This file
│
├── src/
│   ├── models/
│   │   └── types.ts                 # All TypeScript interfaces
│   │
│   ├── screens/
│   │   ├── HomeScreen.tsx           # Today view
│   │   ├── SessionRunnerScreen.tsx  # Gym workout tracker
│   │   ├── OutdoorTimerScreen.tsx   # Outdoor intervals + core
│   │   ├── ProgressScreen.tsx       # Weekly insights
│   │   └── SettingsScreen.tsx       # Settings & export
│   │
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Tab + Stack navigation
│   │
│   ├── services/
│   │   ├── storage.ts               # AsyncStorage wrapper
│   │   ├── exerciseDB.ts            # Exercise catalog from GitHub
│   │   ├── defaultPlan.ts           # Default workout plan generator
│   │   └── progression.ts           # Auto-progression logic
│   │
│   ├── utils/
│   │   └── streaks.ts               # Streak calculations
│   │
│   └── theme/
│       └── index.ts                 # Colors, typography, spacing
│
└── assets/                          # Images, fonts
```

---

## Dependencies

### Core Dependencies

```json
{
  "@react-navigation/native": "^6.x",
  "@react-navigation/bottom-tabs": "^6.x",
  "@react-navigation/native-stack": "^6.x",
  "@react-native-async-storage/async-storage": "^1.x",
  "date-fns": "^3.x",
  "expo": "~51.x",
  "expo-haptics": "~13.x",
  "expo-location": "~17.x",
  "expo-notifications": "~0.28.x",
  "expo-file-system": "~17.x",
  "react": "18.x",
  "react-native": "0.74.x",
  "react-native-screens": "~3.x",
  "react-native-safe-area-context": "^4.x"
}
```

### Installation

```bash
npm install
```

---

## Key Implementation Details

### 1. Exercise Database Integration

**Service:** `src/services/exerciseDB.ts`

- Fetches exercise data from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (Unlicense)
- Caches locally for 30 days
- Transforms raw exercises to app format
- Provides filtering by muscle group, equipment, day type
- No network required after initial fetch

**Example:**
```typescript
const catalog = await initializeExerciseCatalog();
const pushExercises = getPushExercises(catalog.exercises);
```

### 2. Default Workout Plan

**Service:** `src/services/defaultPlan.ts`

Generates a ready-to-train plan:

**Push Day (Chest, Shoulders, Triceps):**
1. Bench Press (4×6-8)
2. Incline Press (3×8-12)
3. Shoulder Press (4×6-10)
4. Lateral Raises (3×10-15)
5. Tricep Press (3×8-12)
6. Tricep Extension (3×10-15)

**Pull Day (Back, Biceps):**
1. Barbell Row (4×6-10)
2. Lat Pulldown (4×6-12)
3. Cable Row (3×8-12)
4. Rear Delt Fly (3×10-15)
5. Barbell Curl (3×8-12)
6. Hammer Curl (3×10-15)

**Upper2 Day (Full Upper Mix):**
1. Dumbbell Press (3×8-12)
2. Pull-up/Row (3×8-12)
3. Shoulder Movement (3×8-12)
4. Chest Fly (3×10-15)
5. Pullover (3×10-15)
6. Arm Movement (3×10-15)

### 3. Auto-Progression Logic

**Service:** `src/services/progression.ts`

Implements rep-range method:

```typescript
// If all sets hit top of range with RPE ≤ 8
if (allSetsHitTop && averageRPE <= 8) {
  return {
    suggestedWeight: currentWeight + increment,
    reason: "All sets hit max reps. Ready for +2.5kg.",
    confidence: 'high'
  };
}

// If sets drop 2+ reps below minimum
if (anySetDroppedLow) {
  return {
    suggestedWeight: currentWeight - increment,
    reason: "Reps dropped. Consider -2.5kg for better form.",
    confidence: 'medium'
  };
}
```

**Weight increments:**
- < 10kg: +1.25kg
- < 20kg: +2.5kg
- < 50kg: +2.5kg
- ≥ 50kg: +5kg

### 4. Streak Calculations

**Service:** `src/utils/streaks.ts`

**Training Streak:** Consecutive weeks with 3+ completed gym sessions
**Outdoor Streak:** Consecutive weeks with 1+ completed outdoor session
**Habits Streak:** Consecutive days with 3+ habits logged

```typescript
const streaks = updateStreaks(
  gymSessions,
  outdoorSessions,
  habitLogs
);
```

### 5. Local Storage Architecture

**Service:** `src/services/storage.ts`

All data stored in AsyncStorage with keys:
- `@upper_outdoor/weekly_program`
- `@upper_outdoor/workout_plan`
- `@upper_outdoor/gym_sessions`
- `@upper_outdoor/outdoor_sessions`
- `@upper_outdoor/habits`
- `@upper_outdoor/streaks`
- `@upper_outdoor/exercise_catalog`

**Export format (JSON):**
```json
{
  "version": "1.0.0",
  "exportDate": "2025-11-10T...",
  "weeklyProgram": {...},
  "workoutPlan": {...},
  "gymSessions": [...],
  "outdoorSessions": [...],
  "habits": {...},
  "settings": {...}
}
```

### 6. Session Auto-Save

Both gym and outdoor sessions auto-save after every logged set/interval to prevent data loss.

---

## Changelog

### Version 1.0.0 - MVP (November 10, 2025)

#### 🎉 Initial Release

**✅ Completed:**

1. **Project Setup**
   - Initialized Expo React Native project with TypeScript
   - Set up folder structure (screens, services, models, utils, theme)
   - Installed and configured all core dependencies

2. **Data Layer**
   - Created comprehensive TypeScript types for all models
   - Implemented AsyncStorage-based local storage service
   - Built exercise database integration with Free Exercise DB
   - Created default workout plan generator
   - Implemented auto-progression logic (rep-range method)
   - Built streak calculation utilities

3. **Navigation**
   - Set up React Navigation with bottom tabs
   - Created stack navigator for session screens
   - Configured navigation types

4. **Screens**
   - **HomeScreen:** Today view with day type, streaks, habits preview, Start button
   - **SessionRunnerScreen:** Full gym workout tracker with set logging, rest timer, auto-save
   - **OutdoorTimerScreen:** Interval timer with haptics + core circuit checklist
   - **ProgressScreen:** Weekly summary, volume by muscle, insights
   - **SettingsScreen:** Export/import, schedule view, data management

5. **Theme & Design**
   - Created comprehensive theme system (colors, typography, spacing)
   - Day-type color coding (Push=purple, Pull=cyan, Upper2=pink, Outdoor=green)
   - High-contrast, accessible design
   - Large tap targets for easy input

6. **Services**
   - Exercise catalog fetching and caching
   - Local data persistence
   - Export functionality (JSON backup)
   - Progression suggestion engine

**📋 Known Limitations (to be addressed in Phase 2):**

- Import functionality (UI ready, needs expo-document-picker integration)
- Local notifications/reminders (not yet implemented)
- GPS tracking for outdoor sessions (location permission UI ready)
- Plan editing UI (schedule display only)
- Habit logging screen (quick check-in UI needed)
- Personal records tracking (logic exists, UI pending)
- Advanced insights (trend charts, exercise history graphs)

---

## Testing Guide

### Running the App

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platform
npm run ios       # iOS simulator (macOS only)
npm run android   # Android emulator
npm run web       # Web browser
```

### Manual Testing Checklist

#### Home Screen
- [ ] App initializes and loads exercise catalog
- [ ] Today's day type displays correctly based on current day
- [ ] Streaks show 0 initially (no data yet)
- [ ] Daily habits display correctly
- [ ] "Start Session" button navigates to correct screen

#### Session Runner (Gym Days)
- [ ] Exercises load from default plan
- [ ] Weight and reps input works
- [ ] "Log Set" button saves set and starts rest timer
- [ ] Rest timer counts down and gives haptic feedback
- [ ] "Next Exercise" button advances workout
- [ ] "Finish" button completes session and returns to home
- [ ] Progress bar updates correctly
- [ ] Session auto-saves (relaunch app to verify)

#### Outdoor Timer
- [ ] Rounds can be adjusted before starting
- [ ] "Start" begins work phase with countdown
- [ ] Work → Rest transition triggers haptic
- [ ] Core circuit items can be checked off
- [ ] "Finish Session" only enabled when all core exercises complete
- [ ] Session saves correctly

#### Progress Screen
- [ ] Weekly summary shows 0 sessions initially
- [ ] Adherence calculates correctly after completing sessions
- [ ] Volume by muscle displays after logging gym sessions
- [ ] Insights display contextual messages
- [ ] Pull-to-refresh works

#### Settings Screen
- [ ] Export creates and shares/downloads backup file
- [ ] Training schedule displays correctly
- [ ] "Clear All Data" shows confirmation and works

### Data Persistence Test

1. Log a gym session
2. Close app completely
3. Reopen app
4. Navigate to Progress → verify session appears
5. Export backup → verify file contains session data

---

## Future Roadmap

### Phase 2 (Planned Features)

- [ ] **Habit Logging Screen:** Dedicated UI for morning/evening check-ins
- [ ] **Local Notifications:** Training and habit reminders
- [ ] **Import Functionality:** Complete backup restore with expo-document-picker
- [ ] **GPS Integration:** Full outdoor session tracking with distance/elevation
- [ ] **Plan Editor:** Visual UI to swap, reorder, add exercises
- [ ] **Personal Records Display:** PR timeline and history
- [ ] **Exercise History:** Per-exercise progress charts
- [ ] **Advanced Insights:** Trend analysis, volume progression graphs
- [ ] **Rest Timer Customization:** Per-exercise rest intervals
- [ ] **RPE Tracking:** Rate of perceived exertion logging
- [ ] **Onboarding Flow:** First-launch setup wizard

### Phase 3 (Advanced Features)

- [ ] **Optional Cloud Sync:** Encrypted backup to user's cloud storage
- [ ] **Shareable Plan Templates:** Export/import workout plans
- [ ] **Health Platform Integration:** Apple Health, Google Fit
- [ ] **Dark Mode:** Full theme support
- [ ] **Multi-language Support:** Internationalization
- [ ] **Advanced Periodization:** Block programming, deload weeks
- [ ] **Custom Exercise Creation:** User-defined movements
- [ ] **Photo Progress Tracking:** Optional body composition photos
- [ ] **Coach View:** Share progress with trainer (optional)

---

## File Manifest

### Source Files Created

1. `src/models/types.ts` - TypeScript interfaces (385 lines)
2. `src/theme/index.ts` - Theme configuration (193 lines)
3. `src/services/storage.ts` - Local storage service (234 lines)
4. `src/services/exerciseDB.ts` - Exercise catalog integration (164 lines)
5. `src/services/defaultPlan.ts` - Default plan generator (224 lines)
6. `src/services/progression.ts` - Auto-progression logic (171 lines)
7. `src/utils/streaks.ts` - Streak calculations (204 lines)
8. `src/navigation/AppNavigator.tsx` - Navigation setup (107 lines)
9. `src/screens/HomeScreen.tsx` - Today screen (403 lines)
10. `src/screens/SessionRunnerScreen.tsx` - Gym session tracker (427 lines)
11. `src/screens/OutdoorTimerScreen.tsx` - Outdoor timer (478 lines)
12. `src/screens/ProgressScreen.tsx` - Progress insights (252 lines)
13. `src/screens/SettingsScreen.tsx` - Settings and export (273 lines)
14. `App.tsx` - Main app entry (17 lines)
15. `IMPLEMENTATION.md` - This documentation file

**Total Lines of Code:** ~3,500+ lines

---

## Technical Notes

### Offline-First Strategy

1. **Exercise Catalog:** Fetched once, cached for 30 days
2. **All Sessions:** Saved immediately to AsyncStorage
3. **Network Calls:** Only for initial catalog fetch (optional after cache)
4. **Graceful Degradation:** App works without network after first launch

### Performance Optimizations

- Lazy loading of exercise images (planned)
- Efficient streak calculations (memoization in Phase 2)
- Minimal re-renders with proper React hooks usage
- AsyncStorage batching for export operations

### Security & Privacy

- ✅ No external analytics
- ✅ No user accounts or authentication
- ✅ No cloud storage (local-only)
- ✅ No third-party trackers
- ✅ Export data is plain JSON (user-readable)

---

## Known Issues & Workarounds

### Issue 1: Import Not Implemented
**Status:** UI ready, needs `expo-document-picker`
**Workaround:** Manual file inspection and app reinstall

### Issue 2: Notifications Not Configured
**Status:** Dependency installed, implementation pending
**Workaround:** Use device calendar/reminders

### Issue 3: GPS Not Active
**Status:** Location permission UI exists, tracking logic needed
**Workaround:** Outdoor session works without GPS

---

## Contributing Guidelines

For future development:

1. **Code Style:** Follow existing TypeScript patterns
2. **Comments:** Document complex logic inline
3. **Testing:** Manually test on iOS + Android before commit
4. **Changelog:** Update this file with all changes
5. **Privacy:** Never add analytics or tracking
6. **Offline:** Always design for offline-first

---

## License & Credits

**App Code:** Proprietary (private use)
**Exercise Data:** [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (Unlicense - Public Domain)
**Dependencies:** See package.json for individual licenses

---

## Contact & Support

This is a personal project implementing the Upper+Outdoor product specification.

**Build Date:** November 10, 2025
**Platform Version:** Expo SDK 51+
**React Native Version:** 0.74+

---

## Appendix: Storage Schema

### Example Session Data

```json
{
  "id": "Push-2025-11-10-1699999999",
  "dayType": "Push",
  "date": "2025-11-10",
  "startTime": "2025-11-10T10:00:00.000Z",
  "endTime": "2025-11-10T11:15:00.000Z",
  "completed": true,
  "duration": 4500,
  "exercises": [
    {
      "exerciseId": "bench-press-001",
      "sets": [
        {
          "id": "1699999991",
          "weight": 80,
          "reps": 8,
          "rpe": 7,
          "timestamp": "2025-11-10T10:05:00.000Z"
        }
      ],
      "bestSet": {...},
      "personalRecord": false
    }
  ]
}
```

---

**End of Implementation Documentation**
