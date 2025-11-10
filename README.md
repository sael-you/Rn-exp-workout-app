# Upper+Outdoor

**Privacy-first workout tracker for 3 upper-body gym days + 1 outdoor legs/core day**

## Overview

Upper+Outdoor is a React Native mobile app designed for a specific training split:
- **Monday:** Push (Chest, Shoulders, Triceps)
- **Wednesday:** Pull (Back, Biceps)
- **Friday:** Upper2 (Full Upper Body)
- **Sunday:** Outdoor (Legs, Core, Intervals)

### Key Features

✅ **Privacy-First:** All data stored locally, no cloud, no tracking
✅ **Offline-First:** Works perfectly without internet after initial setup
✅ **Simple Logging:** 2 taps or less per set
✅ **Auto-Progression:** Smart weight suggestions based on performance
✅ **Daily Habits:** Track sleep, hydration, stretching, creatine
✅ **Progress Insights:** Weekly summaries and plain-language feedback

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Expo CLI (optional but recommended)
- iOS Simulator (macOS) or Android Emulator for testing

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd Rn-exp-workout-app

# Install dependencies
npm install

# Start the development server
npm start
```

### Running on Different Platforms

```bash
# iOS (macOS only)
npm run ios

# Android
npm run android

# Web
npm run web
```

## Project Structure

```
src/
├── models/         # TypeScript types and interfaces
├── screens/        # Main app screens (Home, Session, Progress, Settings)
├── navigation/     # React Navigation setup
├── services/       # Data services (storage, exercises, progression)
├── utils/          # Utility functions (streaks, date helpers)
└── theme/          # Design system (colors, typography, spacing)
```

## Documentation

For complete implementation details, architecture, and changelog, see:
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Comprehensive technical documentation

## Features by Screen

### Home / Today
- Shows today's workout type
- Current streaks (training, outdoor, habits)
- Quick habits check-in
- Start session button

### Session Runner (Gym Days)
- Exercise-by-exercise flow
- Set logging with weight × reps
- Auto rest timer with haptic feedback
- Progress tracking

### Outdoor Timer
- Configurable interval rounds
- Work/rest timer with haptics
- Core circuit checklist
- Optional GPS tracking (UI ready)

### Progress
- Weekly summary
- Adherence percentage
- Volume by muscle group
- Plain-language insights

### Settings
- Export/import backups
- Training schedule view
- Data management

## Tech Stack

- **Framework:** React Native with Expo
- **Language:** TypeScript
- **Navigation:** React Navigation
- **Storage:** AsyncStorage (local-first)
- **Exercise Data:** [Free Exercise DB](https://github.com/yuhonas/free-exercise-db)
- **Date Handling:** date-fns
- **Haptics:** expo-haptics

## Data Privacy

- ✅ All data stored locally on your device
- ✅ No user accounts required
- ✅ No analytics or tracking
- ✅ No cloud synchronization
- ✅ Export your data anytime (JSON format)

## Development Status

**Current Version:** 1.0.0 (MVP)
**Status:** ✅ Phase 1 Complete

### Implemented
- [x] Core workout tracking (gym + outdoor)
- [x] Daily habits tracking
- [x] Progress insights
- [x] Auto-progression logic
- [x] Local data storage
- [x] Export functionality

### Planned (Phase 2)
- [ ] Local notifications/reminders
- [ ] Import functionality (with file picker)
- [ ] Full GPS integration for outdoor sessions
- [ ] Plan editor UI
- [ ] Dedicated habits logging screen
- [ ] Personal records display
- [ ] Exercise history charts

## Contributing

This is a personal project. For development guidelines, see [IMPLEMENTATION.md](./IMPLEMENTATION.md).

## License

- **App Code:** Proprietary
- **Exercise Data:** [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (Unlicense - Public Domain)

## Acknowledgments

- Exercise data from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) by [@yuhonas](https://github.com/yuhonas)
- Built with [Expo](https://expo.dev)
- Powered by [React Native](https://reactnative.dev)

---

**Built with ❤️ for privacy-conscious strength training**
