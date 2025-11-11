/**
 * Default Workout Plan Generator
 * Creates the ready-to-train default plan for Push, Pull, Upper2 days
 */

import { WorkoutPlan, DayPlan, PlannedExercise, Exercise } from '../models/types';
import { getPushExercises, getPullExercises, getUpper2Exercises } from './exerciseDB';

/**
 * Generate default workout plan from exercise catalog
 */
export function generateDefaultPlan(exercises: Exercise[]): WorkoutPlan {
  const pushExercises = getPushExercises(exercises);
  const pullExercises = getPullExercises(exercises);
  const upperExercises = getUpper2Exercises(exercises);

  return {
    id: 'default-plan-v1',
    name: 'Upper+Outdoor Default Plan',
    trainingSplit: 'muscle_group',
    plans: {
      Push: createPushPlan(pushExercises),
      Pull: createPullPlan(pullExercises),
      Upper2: createUpper2Plan(upperExercises),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create Push day plan (Chest, Shoulders, Triceps)
 * Target: 6-8 exercises
 */
function createPushPlan(exercises: Exercise[]): DayPlan {
  const plannedExercises: PlannedExercise[] = [];

  // 1. Main chest compound (barbell or dumbbell press)
  const chestPress = findExercise(exercises, ['bench press', 'dumbbell press'], ['chest']);
  if (chestPress) {
    plannedExercises.push(createPlannedExercise(chestPress, 1, 4, 6, 8));
  }

  // 2. Incline chest movement
  const inclinePress = findExercise(exercises, ['incline'], ['chest']);
  if (inclinePress) {
    plannedExercises.push(createPlannedExercise(inclinePress, 2, 3, 8, 12));
  }

  // 3. Shoulder press (overhead)
  const shoulderPress = findExercise(exercises, ['shoulder press', 'military press', 'overhead press'], ['shoulders']);
  if (shoulderPress) {
    plannedExercises.push(createPlannedExercise(shoulderPress, 3, 4, 6, 10));
  }

  // 4. Lateral raises
  const lateralRaise = findExercise(exercises, ['lateral raise', 'side raise'], ['shoulders']);
  if (lateralRaise) {
    plannedExercises.push(createPlannedExercise(lateralRaise, 4, 3, 10, 15));
  }

  // 5. Tricep compound
  const tricepPress = findExercise(exercises, ['dip', 'close grip', 'tricep press'], ['triceps']);
  if (tricepPress) {
    plannedExercises.push(createPlannedExercise(tricepPress, 5, 3, 8, 12));
  }

  // 6. Tricep isolation
  const tricepIso = findExercise(exercises, ['tricep extension', 'overhead extension', 'skull crusher'], ['triceps']);
  if (tricepIso) {
    plannedExercises.push(createPlannedExercise(tricepIso, 6, 3, 10, 15));
  }

  return {
    dayType: 'Push',
    exercises: plannedExercises,
  };
}

/**
 * Create Pull day plan (Back, Biceps)
 * Target: 6-8 exercises
 */
function createPullPlan(exercises: Exercise[]): DayPlan {
  const plannedExercises: PlannedExercise[] = [];

  // 1. Horizontal pull (row)
  const row = findExercise(exercises, ['barbell row', 'row'], ['back']);
  if (row) {
    plannedExercises.push(createPlannedExercise(row, 1, 4, 6, 10));
  }

  // 2. Vertical pull (pulldown or pull-up)
  const verticalPull = findExercise(exercises, ['pull', 'lat pulldown', 'chin'], ['lats', 'back']);
  if (verticalPull) {
    plannedExercises.push(createPlannedExercise(verticalPull, 2, 4, 6, 12));
  }

  // 3. Secondary row variation
  const secondRow = findExercise(exercises, ['dumbbell row', 'cable row', 'seated row'], ['back']);
  if (secondRow) {
    plannedExercises.push(createPlannedExercise(secondRow, 3, 3, 8, 12));
  }

  // 4. Rear delt
  const rearDelt = findExercise(exercises, ['rear delt', 'reverse fly', 'face pull'], ['shoulders', 'back']);
  if (rearDelt) {
    plannedExercises.push(createPlannedExercise(rearDelt, 4, 3, 10, 15));
  }

  // 5. Bicep compound
  const bicepCurl = findExercise(exercises, ['barbell curl', 'curl'], ['biceps']);
  if (bicepCurl) {
    plannedExercises.push(createPlannedExercise(bicepCurl, 5, 3, 8, 12));
  }

  // 6. Bicep variation
  const bicepVar = findExercise(exercises, ['hammer curl', 'preacher curl', 'concentration'], ['biceps']);
  if (bicepVar) {
    plannedExercises.push(createPlannedExercise(bicepVar, 6, 3, 10, 15));
  }

  return {
    dayType: 'Pull',
    exercises: plannedExercises,
  };
}

/**
 * Create Upper2 day plan (Full upper body mix)
 * Target: 6-8 exercises
 */
function createUpper2Plan(exercises: Exercise[]): DayPlan {
  const plannedExercises: PlannedExercise[] = [];

  // 1. Chest compound
  const chestMove = findExercise(exercises, ['dumbbell press', 'push up', 'chest press'], ['chest']);
  if (chestMove) {
    plannedExercises.push(createPlannedExercise(chestMove, 1, 3, 8, 12));
  }

  // 2. Back compound
  const backMove = findExercise(exercises, ['pull', 'row'], ['back']);
  if (backMove) {
    plannedExercises.push(createPlannedExercise(backMove, 2, 3, 8, 12));
  }

  // 3. Shoulder movement
  const shoulderMove = findExercise(exercises, ['shoulder', 'press', 'raise'], ['shoulders']);
  if (shoulderMove) {
    plannedExercises.push(createPlannedExercise(shoulderMove, 3, 3, 8, 12));
  }

  // 4. Chest fly or isolation
  const chestIso = findExercise(exercises, ['fly', 'cable cross'], ['chest']);
  if (chestIso) {
    plannedExercises.push(createPlannedExercise(chestIso, 4, 3, 10, 15));
  }

  // 5. Back isolation
  const backIso = findExercise(exercises, ['pullover', 'shrug'], ['back']);
  if (backIso) {
    plannedExercises.push(createPlannedExercise(backIso, 5, 3, 10, 15));
  }

  // 6. Arms superset (bi/tri)
  const armMove = findExercise(exercises, ['curl', 'extension'], ['biceps', 'triceps']);
  if (armMove) {
    plannedExercises.push(createPlannedExercise(armMove, 6, 3, 10, 15));
  }

  return {
    dayType: 'Upper2',
    exercises: plannedExercises,
  };
}

/**
 * Helper: Find exercise by keywords and target muscles
 */
function findExercise(
  exercises: Exercise[],
  keywords: string[],
  targetMuscles: string[]
): Exercise | undefined {
  return exercises.find(ex => {
    const nameLower = ex.name.toLowerCase();
    const targetLower = ex.target.toLowerCase();
    const bodyPartLower = ex.bodyPart.toLowerCase();

    const matchesKeyword = keywords.some(kw => nameLower.includes(kw.toLowerCase()));
    const matchesMuscle = targetMuscles.some(
      muscle =>
        targetLower.includes(muscle.toLowerCase()) ||
        bodyPartLower.includes(muscle.toLowerCase())
    );

    return matchesKeyword && matchesMuscle;
  });
}

/**
 * Helper: Create a planned exercise
 */
function createPlannedExercise(
  exercise: Exercise,
  order: number,
  targetSets: number,
  repRangeMin: number,
  repRangeMax: number
): PlannedExercise {
  return {
    exerciseId: exercise.id,
    order,
    targetSets,
    repRangeMin,
    repRangeMax,
  };
}

/**
 * Fallback: Create minimal plan if exercise matching fails
 */
export function createMinimalFallbackPlan(): WorkoutPlan {
  return {
    id: 'fallback-plan-v1',
    name: 'Minimal Upper Plan',
    trainingSplit: 'muscle_group',
    plans: {
      Push: {
        dayType: 'Push',
        exercises: [],
      },
      Pull: {
        dayType: 'Pull',
        exercises: [],
      },
      Upper2: {
        dayType: 'Upper2',
        exercises: [],
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
