/**
 * Core TypeScript types and interfaces for Upper+Outdoor app
 */

// ============================================================================
// Day Types & Weekly Program
// ============================================================================

export type DayType = 'Push' | 'Pull' | 'Upper2' | 'Outdoor' | 'Rest';

export interface TrainingDay {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday to Saturday)
  dayType: DayType;
  enabled: boolean;
}

export interface WeeklyProgram {
  trainingDays: TrainingDay[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Exercises & Catalog
// ============================================================================

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string; // Primary muscle
  equipment: string;
  gifUrl?: string;
  imageUrl?: string;
  secondaryMuscles?: string[];
  instructions?: string[];
}

export interface ExerciseCatalog {
  exercises: Exercise[];
  lastUpdated: string;
}

// ============================================================================
// Workout Plan
// ============================================================================

export interface PlannedExercise {
  exerciseId: string;
  order: number;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  notes?: string;
}

export interface DayPlan {
  dayType: DayType;
  exercises: PlannedExercise[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  plans: {
    Push: DayPlan;
    Pull: DayPlan;
    Upper2: DayPlan;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Session Logging
// ============================================================================

export interface SetLog {
  id: string;
  weight: number;
  reps: number;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  timestamp: string;
  struggle?: boolean;
  notes?: string;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
  bestSet?: SetLog;
  personalRecord?: boolean;
}

export interface GymSession {
  id: string;
  dayType: 'Push' | 'Pull' | 'Upper2';
  date: string;
  startTime: string;
  endTime?: string;
  exercises: ExerciseLog[];
  completed: boolean;
  duration?: number; // seconds
  notes?: string;
}

// ============================================================================
// Outdoor Session
// ============================================================================

export interface OutdoorInterval {
  roundNumber: number;
  workDuration: number; // seconds
  restDuration: number; // seconds
  completed: boolean;
}

export interface CoreExercise {
  name: string;
  completed: boolean;
  reps?: number;
  duration?: number; // seconds
}

export interface OutdoorSession {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  intervals: OutdoorInterval[];
  coreCircuit: CoreExercise[];
  gpsEnabled: boolean;
  distance?: number; // meters
  elevation?: number; // meters
  completed: boolean;
  duration?: number; // seconds
  notes?: string;
}

// ============================================================================
// Daily Habits
// ============================================================================

export interface HabitLog {
  date: string; // YYYY-MM-DD
  sleep?: number; // hours
  hydration?: number; // cups or liters
  stretching?: number; // minutes or boolean
  creatine?: boolean;
}

export interface HabitStreak {
  current: number;
  longest: number;
  lastUpdated: string;
}

export interface HabitsData {
  logs: HabitLog[];
  streaks: {
    sleep: HabitStreak;
    hydration: HabitStreak;
    stretching: HabitStreak;
    creatine: HabitStreak;
  };
}

// ============================================================================
// Progress & Insights
// ============================================================================

export interface PersonalRecord {
  exerciseId: string;
  weight: number;
  reps: number;
  date: string;
  sessionId: string;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  sessionsCompleted: number;
  sessionsPlanned: number;
  adherence: number; // percentage
  outdoorCompleted: boolean;
  totalVolume: number; // total weight × reps
  volumeByMuscle: Record<string, number>;
  prs: PersonalRecord[];
  habitsCompletion: number; // percentage
}

export interface ExerciseProgress {
  exerciseId: string;
  history: {
    date: string;
    bestSet: SetLog;
  }[];
  trend: 'improving' | 'stable' | 'declining';
  lastIncrease?: string;
}

// ============================================================================
// Reminders
// ============================================================================

export interface Reminder {
  id: string;
  type: 'training' | 'habits';
  dayOfWeek?: number; // For training reminders
  time: string; // HH:mm
  enabled: boolean;
  title: string;
  body: string;
}

// ============================================================================
// Settings & User Preferences
// ============================================================================

export type WeightUnit = 'kg' | 'lb';
export type VolumeUnit = 'L' | 'cups';

export interface UserSettings {
  weightUnit: WeightUnit;
  volumeUnit: VolumeUnit;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  reminders: Reminder[];
  onboardingCompleted: boolean;
}

// ============================================================================
// Auto-Progression
// ============================================================================

export interface ProgressionSuggestion {
  exerciseId: string;
  currentWeight: number;
  suggestedWeight: number;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================================
// Export/Import
// ============================================================================

export interface AppDataExport {
  version: string;
  exportDate: string;
  weeklyProgram: WeeklyProgram;
  workoutPlan: WorkoutPlan;
  gymSessions: GymSession[];
  outdoorSessions: OutdoorSession[];
  habits: HabitsData;
  settings: UserSettings;
}

// ============================================================================
// Streaks
// ============================================================================

export interface StreakData {
  training: {
    current: number; // consecutive weeks with 3+ sessions
    longest: number;
    lastUpdated: string;
  };
  outdoor: {
    current: number; // consecutive weeks
    longest: number;
    lastUpdated: string;
  };
  habits: {
    current: number; // consecutive days with 3+ habits logged
    longest: number;
    lastUpdated: string;
  };
}
