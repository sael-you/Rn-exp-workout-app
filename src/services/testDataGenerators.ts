/**
 * Test Data Generators for AI Coach Testing
 * Generate realistic workout session data for different scenarios
 * Current date context: November 11, 2025
 */

import { GymSession, OutdoorSession, ExerciseLog, SetLog } from '../models/types';
import { subDays, format } from 'date-fns';

// Reference date: November 11, 2025
const TODAY = new Date(2025, 10, 11); // Month is 0-indexed, so 10 = November

/**
 * Generate a single gym session with specified performance
 */
function generateGymSession(
  dayType: 'Push' | 'Pull' | 'Upper2',
  date: Date,
  exercises: { exerciseId: string; baseWeight: number; sets: number; reps: number }[],
  performanceMultiplier: number = 1.0
): GymSession {
  const exerciseLogs: ExerciseLog[] = exercises.map((ex) => {
    const sets: SetLog[] = [];
    const targetWeight = ex.baseWeight * performanceMultiplier;

    for (let i = 0; i < ex.sets; i++) {
      // Simulate slight fatigue across sets
      const setWeight = targetWeight * (1 - i * 0.05);
      const setReps = ex.reps - Math.floor(i * 0.5);

      sets.push({
        id: `${date.getTime()}-${ex.exerciseId}-${i}`,
        weight: Math.round(setWeight * 2) / 2, // Round to nearest 0.5
        reps: Math.max(setReps, Math.floor(ex.reps * 0.7)),
        timestamp: new Date(date.getTime() + i * 120000).toISOString(), // 2 min between sets
      });
    }

    // Best set is usually the first one
    const bestSet = sets.reduce((best, current) =>
      current.weight * current.reps > best.weight * best.reps ? current : best
    );

    return {
      exerciseId: ex.exerciseId,
      sets,
      bestSet,
    };
  });

  return {
    id: `test-session-${dayType}-${format(date, 'yyyy-MM-dd')}`,
    dayType,
    date: format(date, 'yyyy-MM-dd'),
    duration: 3600, // 60 minutes
    exercises: exerciseLogs,
    completed: true,
  };
}

/**
 * SCENARIO 1: Steady Progress
 * User consistently improving week over week
 */
export function generateSteadyProgressSessions(weeksBack: number = 4): GymSession[] {
  const sessions: GymSession[] = [];

  const pushExercises = [
    { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', baseWeight: 80, sets: 4, reps: 8 },
    { exerciseId: 'Barbell_Incline_Bench_Press_-_Medium_Grip', baseWeight: 70, sets: 3, reps: 10 },
    { exerciseId: 'Dumbbell_Shoulder_Press', baseWeight: 25, sets: 3, reps: 10 },
    { exerciseId: 'Cable_Crossover', baseWeight: 20, sets: 3, reps: 12 },
  ];

  const pullExercises = [
    { exerciseId: 'Barbell_Deadlift', baseWeight: 100, sets: 3, reps: 6 },
    { exerciseId: 'Pull-up', baseWeight: 0, sets: 3, reps: 8 },
    { exerciseId: 'Bent_Over_Barbell_Row', baseWeight: 70, sets: 4, reps: 8 },
    { exerciseId: 'Barbell_Curl', baseWeight: 30, sets: 3, reps: 10 },
  ];

  const upper2Exercises = [
    { exerciseId: 'Dumbbell_Bench_Press', baseWeight: 35, sets: 4, reps: 8 },
    { exerciseId: 'Seated_Cable_Rows', baseWeight: 60, sets: 3, reps: 10 },
    { exerciseId: 'Lateral_Raise', baseWeight: 12, sets: 3, reps: 12 },
    { exerciseId: 'Face_Pull', baseWeight: 25, sets: 3, reps: 15 },
  ];

  for (let week = weeksBack; week >= 0; week--) {
    const performanceMultiplier = 1 + (weeksBack - week) * 0.05; // 5% improvement per week

    // Generate 3 sessions per week (Push, Pull, Upper2)
    const pushDate = subDays(TODAY, week * 7);
    const pullDate = subDays(TODAY, week * 7 - 2);
    const upper2Date = subDays(TODAY, week * 7 - 4);

    sessions.push(generateGymSession('Push', pushDate, pushExercises, performanceMultiplier));
    sessions.push(generateGymSession('Pull', pullDate, pullExercises, performanceMultiplier));
    sessions.push(generateGymSession('Upper2', upper2Date, upper2Exercises, performanceMultiplier));
  }

  return sessions.reverse(); // Newest first
}

/**
 * SCENARIO 2: Plateau Detected
 * User stuck at same weights for 3+ weeks
 */
export function generatePlateauSessions(weeksBack: number = 5): GymSession[] {
  const sessions: GymSession[] = [];

  const pushExercises = [
    { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', baseWeight: 80, sets: 4, reps: 8 },
    { exerciseId: 'Barbell_Incline_Bench_Press_-_Medium_Grip', baseWeight: 70, sets: 3, reps: 10 },
    { exerciseId: 'Dumbbell_Shoulder_Press', baseWeight: 25, sets: 3, reps: 10 },
  ];

  const pullExercises = [
    { exerciseId: 'Barbell_Deadlift', baseWeight: 100, sets: 3, reps: 6 },
    { exerciseId: 'Pull-up', baseWeight: 0, sets: 3, reps: 8 },
    { exerciseId: 'Bent_Over_Barbell_Row', baseWeight: 70, sets: 4, reps: 8 },
  ];

  const upper2Exercises = [
    { exerciseId: 'Dumbbell_Bench_Press', baseWeight: 35, sets: 4, reps: 8 },
    { exerciseId: 'Seated_Cable_Rows', baseWeight: 60, sets: 3, reps: 10 },
    { exerciseId: 'Lateral_Raise', baseWeight: 12, sets: 3, reps: 12 },
  ];

  for (let week = weeksBack; week >= 0; week--) {
    // First 2 weeks: progress, then plateau for last 3 weeks
    const performanceMultiplier = week > 2 ? 1 + (weeksBack - week) * 0.05 : 1.1;

    const pushDate = subDays(TODAY, week * 7);
    const pullDate = subDays(TODAY, week * 7 - 2);
    const upper2Date = subDays(TODAY, week * 7 - 4);

    sessions.push(generateGymSession('Push', pushDate, pushExercises, performanceMultiplier));
    sessions.push(generateGymSession('Pull', pullDate, pullExercises, performanceMultiplier));
    sessions.push(generateGymSession('Upper2', upper2Date, upper2Exercises, performanceMultiplier));
  }

  return sessions.reverse();
}

/**
 * SCENARIO 3: Overtraining / Regression
 * User's performance declining over time
 */
export function generateOvertrainingSessions(weeksBack: number = 4): GymSession[] {
  const sessions: GymSession[] = [];
  const baseExercises = [
    { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', baseWeight: 80, sets: 4, reps: 8 },
    { exerciseId: 'Bent_Over_Barbell_Row', baseWeight: 75, sets: 4, reps: 8 },
  ];

  for (let week = weeksBack; week >= 0; week--) {
    // Performance declining by 3% per week
    const performanceMultiplier = 1 - (weeksBack - week) * 0.03;
    const sessionDate = subDays(TODAY, week * 7);

    // Alternate Push and Pull
    const dayType = week % 2 === 0 ? 'Push' : 'Pull';
    sessions.push(generateGymSession(dayType, sessionDate, baseExercises, performanceMultiplier));
  }

  return sessions.reverse();
}

/**
 * SCENARIO 4: Inconsistent Training
 * User missing workouts, irregular schedule
 */
export function generateInconsistentSessions(weeksBack: number = 4): GymSession[] {
  const sessions: GymSession[] = [];
  const baseExercises = [
    { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', baseWeight: 80, sets: 4, reps: 8 },
  ];

  // Only train 1-2 times per week instead of 3
  for (let week = weeksBack; week >= 0; week--) {
    // Skip some weeks randomly
    if (week % 2 === 0 || week === 1) {
      const sessionDate = subDays(TODAY, week * 7);
      sessions.push(generateGymSession('Push', sessionDate, baseExercises, 1.0));
    }
  }

  return sessions.reverse();
}

/**
 * SCENARIO 5: Rapid Progress (Beginner Gains)
 * User making very fast progress (10% per week)
 */
export function generateRapidProgressSessions(weeksBack: number = 4): GymSession[] {
  const sessions: GymSession[] = [];
  const baseExercises = [
    { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', baseWeight: 60, sets: 4, reps: 8 },
    { exerciseId: 'Bent_Over_Barbell_Row', baseWeight: 55, sets: 4, reps: 8 },
  ];

  for (let week = weeksBack; week >= 0; week--) {
    const performanceMultiplier = 1 + (weeksBack - week) * 0.1; // 10% per week
    const pushDate = subDays(TODAY, week * 7);
    const pullDate = subDays(TODAY, week * 7 - 2);

    sessions.push(generateGymSession('Push', pushDate, baseExercises, performanceMultiplier));
    sessions.push(generateGymSession('Pull', pullDate, baseExercises, performanceMultiplier));
  }

  return sessions.reverse();
}

/**
 * SCENARIO 6: Deload Needed
 * User has been training hard for 5 weeks, showing fatigue
 */
export function generateDeloadNeededSessions(weeksBack: number = 5): GymSession[] {
  const sessions: GymSession[] = [];
  const baseExercises = [
    { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', baseWeight: 85, sets: 4, reps: 8 },
    { exerciseId: 'Barbell_Shoulder_Press', baseWeight: 60, sets: 3, reps: 8 },
    { exerciseId: 'Cable_One_Arm_Tricep_Extension', baseWeight: 15, sets: 3, reps: 12 },
  ];

  for (let week = weeksBack; week >= 0; week--) {
    // Weeks 1-3: good progress, Week 4-5: fatigue sets in
    let performanceMultiplier;
    if (week > 2) {
      performanceMultiplier = 1 + (weeksBack - week) * 0.05;
    } else {
      performanceMultiplier = 1.15 - (2 - week) * 0.08; // Decline due to fatigue
    }

    const sessionDate = subDays(TODAY, week * 7);
    sessions.push(generateGymSession('Push', sessionDate, baseExercises, performanceMultiplier));
  }

  return sessions.reverse();
}

/**
 * SCENARIO 7: Mixed Progress
 * Some exercises improving, others plateauing
 */
export function generateMixedProgressSessions(weeksBack: number = 4): GymSession[] {
  const sessions: GymSession[] = [];

  for (let week = weeksBack; week >= 0; week--) {
    const pushDate = subDays(TODAY, week * 7);
    const pullDate = subDays(TODAY, week * 7 - 2);
    const upper2Date = subDays(TODAY, week * 7 - 4);

    // Push: Bench improving, shoulders plateaued
    const pushProgressing = 1 + (weeksBack - week) * 0.05;
    const pushPlateau = 1.0;
    sessions.push(generateGymSession('Push', pushDate, [
      { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', baseWeight: 80, sets: 4, reps: 8 },
      { exerciseId: 'Dumbbell_Shoulder_Press', baseWeight: 25, sets: 3, reps: 10 }, // Plateaued
      { exerciseId: 'Cable_Crossover', baseWeight: 20, sets: 3, reps: 12 },
    ], pushProgressing));

    // Pull: Rows improving, deadlift plateaued
    sessions.push(generateGymSession('Pull', pullDate, [
      { exerciseId: 'Barbell_Deadlift', baseWeight: 100, sets: 3, reps: 6 }, // Plateaued
      { exerciseId: 'Bent_Over_Barbell_Row', baseWeight: 70, sets: 4, reps: 8 },
      { exerciseId: 'Barbell_Curl', baseWeight: 30, sets: 3, reps: 10 },
    ], pushProgressing));

    // Upper2: Mixed progress
    sessions.push(generateGymSession('Upper2', upper2Date, [
      { exerciseId: 'Dumbbell_Bench_Press', baseWeight: 35, sets: 4, reps: 8 },
      { exerciseId: 'Seated_Cable_Rows', baseWeight: 60, sets: 3, reps: 10 }, // Plateaued
      { exerciseId: 'Lateral_Raise', baseWeight: 12, sets: 3, reps: 12 },
    ], pushProgressing));
  }

  return sessions.reverse();
}

/**
 * Generate outdoor sessions
 */
export function generateOutdoorSessions(weeksBack: number = 4): OutdoorSession[] {
  const sessions: OutdoorSession[] = [];

  for (let week = weeksBack; week >= 0; week--) {
    const sessionDate = subDays(TODAY, week * 7);
    const duration = 3000 + Math.random() * 1200; // 50-70 minutes
    const distance = 8000 + Math.random() * 4000; // 8-12 km

    sessions.push({
      id: `test-outdoor-${format(sessionDate, 'yyyy-MM-dd')}`,
      date: format(sessionDate, 'yyyy-MM-dd'),
      duration: Math.round(duration),
      distance: Math.round(distance),
      completed: true,
    });
  }

  return sessions.reverse();
}

/**
 * Helper: Import sessions to storage (for testing)
 */
export async function importTestSessions(
  sessions: GymSession[],
  storage: any
): Promise<void> {
  for (const session of sessions) {
    await storage.saveGymSession(session);
  }
  console.log(`[TestData] Imported ${sessions.length} test sessions`);
}

/**
 * Generate comprehensive test suite
 */
export function generateTestSuite(): {
  [scenario: string]: GymSession[];
} {
  return {
    steadyProgress: generateSteadyProgressSessions(4),
    plateau: generatePlateauSessions(5),
    overtraining: generateOvertrainingSessions(5),
    inconsistent: generateInconsistentSessions(4),
    rapidProgress: generateRapidProgressSessions(3),
    deloadNeeded: generateDeloadNeededSessions(5),
    mixedProgress: generateMixedProgressSessions(4),
  };
}
