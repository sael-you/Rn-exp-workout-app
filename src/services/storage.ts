/**
 * Local storage service for Upper+Outdoor app
 * Privacy-first, offline-first data persistence using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WeeklyProgram,
  WorkoutPlan,
  GymSession,
  OutdoorSession,
  HabitsData,
  UserSettings,
  StreakData,
  AppDataExport,
  ExerciseCatalog,
} from '../models/types';

// Storage keys
const KEYS = {
  WEEKLY_PROGRAM: '@upper_outdoor/weekly_program',
  WORKOUT_PLAN: '@upper_outdoor/workout_plan',
  GYM_SESSIONS: '@upper_outdoor/gym_sessions',
  OUTDOOR_SESSIONS: '@upper_outdoor/outdoor_sessions',
  HABITS: '@upper_outdoor/habits',
  SETTINGS: '@upper_outdoor/settings',
  STREAKS: '@upper_outdoor/streaks',
  EXERCISE_CATALOG: '@upper_outdoor/exercise_catalog',
  ONBOARDING_COMPLETED: '@upper_outdoor/onboarding_completed',
};

// ============================================================================
// Generic storage utilities
// ============================================================================

async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
    throw error;
  }
}

async function getItem<T>(key: string): Promise<T | null> {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return null;
  }
}

async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
    throw error;
  }
}

// ============================================================================
// Weekly Program
// ============================================================================

export async function saveWeeklyProgram(program: WeeklyProgram): Promise<void> {
  return setItem(KEYS.WEEKLY_PROGRAM, program);
}

export async function loadWeeklyProgram(): Promise<WeeklyProgram | null> {
  return getItem<WeeklyProgram>(KEYS.WEEKLY_PROGRAM);
}

// ============================================================================
// Workout Plan
// ============================================================================

export async function saveWorkoutPlan(plan: WorkoutPlan): Promise<void> {
  return setItem(KEYS.WORKOUT_PLAN, plan);
}

export async function loadWorkoutPlan(): Promise<WorkoutPlan | null> {
  return getItem<WorkoutPlan>(KEYS.WORKOUT_PLAN);
}

// ============================================================================
// Gym Sessions
// ============================================================================

export async function saveGymSession(session: GymSession): Promise<void> {
  const sessions = await loadGymSessions();
  const existingIndex = sessions.findIndex((s) => s.id === session.id);

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }

  // Sort by date descending
  sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return setItem(KEYS.GYM_SESSIONS, sessions);
}

export async function loadGymSessions(): Promise<GymSession[]> {
  const sessions = await getItem<GymSession[]>(KEYS.GYM_SESSIONS);
  return sessions || [];
}

export async function loadGymSessionById(id: string): Promise<GymSession | null> {
  const sessions = await loadGymSessions();
  return sessions.find((s) => s.id === id) || null;
}

export async function deleteGymSession(id: string): Promise<void> {
  const sessions = await loadGymSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  return setItem(KEYS.GYM_SESSIONS, filtered);
}

// ============================================================================
// Outdoor Sessions
// ============================================================================

export async function saveOutdoorSession(session: OutdoorSession): Promise<void> {
  const sessions = await loadOutdoorSessions();
  const existingIndex = sessions.findIndex((s) => s.id === session.id);

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }

  // Sort by date descending
  sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return setItem(KEYS.OUTDOOR_SESSIONS, sessions);
}

export async function loadOutdoorSessions(): Promise<OutdoorSession[]> {
  const sessions = await getItem<OutdoorSession[]>(KEYS.OUTDOOR_SESSIONS);
  return sessions || [];
}

export async function loadOutdoorSessionById(id: string): Promise<OutdoorSession | null> {
  const sessions = await loadOutdoorSessions();
  return sessions.find((s) => s.id === id) || null;
}

export async function deleteOutdoorSession(id: string): Promise<void> {
  const sessions = await loadOutdoorSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  return setItem(KEYS.OUTDOOR_SESSIONS, filtered);
}

// ============================================================================
// Habits
// ============================================================================

export async function saveHabits(habits: HabitsData): Promise<void> {
  return setItem(KEYS.HABITS, habits);
}

export async function loadHabits(): Promise<HabitsData | null> {
  return getItem<HabitsData>(KEYS.HABITS);
}

// ============================================================================
// Settings
// ============================================================================

export async function saveSettings(settings: UserSettings): Promise<void> {
  return setItem(KEYS.SETTINGS, settings);
}

export async function loadSettings(): Promise<UserSettings | null> {
  return getItem<UserSettings>(KEYS.SETTINGS);
}

// ============================================================================
// Streaks
// ============================================================================

export async function saveStreaks(streaks: StreakData): Promise<void> {
  return setItem(KEYS.STREAKS, streaks);
}

export async function loadStreaks(): Promise<StreakData | null> {
  return getItem<StreakData>(KEYS.STREAKS);
}

// ============================================================================
// Exercise Catalog
// ============================================================================

export async function saveExerciseCatalog(catalog: ExerciseCatalog): Promise<void> {
  return setItem(KEYS.EXERCISE_CATALOG, catalog);
}

export async function loadExerciseCatalog(): Promise<ExerciseCatalog | null> {
  return getItem<ExerciseCatalog>(KEYS.EXERCISE_CATALOG);
}

// ============================================================================
// Onboarding
// ============================================================================

export async function setOnboardingCompleted(completed: boolean): Promise<void> {
  return setItem(KEYS.ONBOARDING_COMPLETED, completed);
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const completed = await getItem<boolean>(KEYS.ONBOARDING_COMPLETED);
  return completed || false;
}

// ============================================================================
// Export/Import
// ============================================================================

export async function exportAllData(): Promise<AppDataExport> {
  const [
    weeklyProgram,
    workoutPlan,
    gymSessions,
    outdoorSessions,
    habits,
    settings,
  ] = await Promise.all([
    loadWeeklyProgram(),
    loadWorkoutPlan(),
    loadGymSessions(),
    loadOutdoorSessions(),
    loadHabits(),
    loadSettings(),
  ]);

  return {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    weeklyProgram: weeklyProgram!,
    workoutPlan: workoutPlan!,
    gymSessions,
    outdoorSessions,
    habits: habits!,
    settings: settings!,
  };
}

export async function importAllData(data: AppDataExport): Promise<void> {
  // Import all data, merging sessions by timestamp to avoid duplicates
  const existingGymSessions = await loadGymSessions();
  const existingOutdoorSessions = await loadOutdoorSessions();

  // Merge gym sessions
  const mergedGymSessions = [...existingGymSessions];
  for (const session of data.gymSessions) {
    if (!mergedGymSessions.find((s) => s.id === session.id)) {
      mergedGymSessions.push(session);
    }
  }

  // Merge outdoor sessions
  const mergedOutdoorSessions = [...existingOutdoorSessions];
  for (const session of data.outdoorSessions) {
    if (!mergedOutdoorSessions.find((s) => s.id === session.id)) {
      mergedOutdoorSessions.push(session);
    }
  }

  // Save all data
  await Promise.all([
    saveWeeklyProgram(data.weeklyProgram),
    saveWorkoutPlan(data.workoutPlan),
    setItem(KEYS.GYM_SESSIONS, mergedGymSessions),
    setItem(KEYS.OUTDOOR_SESSIONS, mergedOutdoorSessions),
    saveHabits(data.habits),
    saveSettings(data.settings),
  ]);
}

// ============================================================================
// Clear all data (for testing/reset)
// ============================================================================

export async function clearAllData(): Promise<void> {
  await AsyncStorage.clear();
}
