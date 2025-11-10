/**
 * Auto-Progression Service
 * Implements rep-range method for suggesting weight/rep increases
 */

import { SetLog, GymSession, ProgressionSuggestion, PlannedExercise } from '../models/types';

/**
 * Analyze sets and suggest next session's weight
 *
 * Logic:
 * - If all sets hit top of rep range with RPE ≤ 8, suggest weight increase
 * - If any set drops 2+ reps below minimum, suggest weight decrease
 * - Otherwise, maintain weight and aim to add reps
 */
export function suggestProgression(
  plannedExercise: PlannedExercise,
  recentSessions: GymSession[],
  currentWeight: number
): ProgressionSuggestion | null {
  // Find the most recent session with this exercise
  const lastSession = findLastSessionWithExercise(recentSessions, plannedExercise.exerciseId);

  if (!lastSession) {
    return null; // No history yet
  }

  const exerciseLog = lastSession.exercises.find(
    ex => ex.exerciseId === plannedExercise.exerciseId
  );

  if (!exerciseLog || exerciseLog.sets.length === 0) {
    return null;
  }

  const sets = exerciseLog.sets;
  const { repRangeMin, repRangeMax } = plannedExercise;

  // Check if all sets hit top of range
  const allSetsHitTop = sets.every(set => set.reps >= repRangeMax);
  const averageRPE = sets.reduce((sum, set) => sum + (set.rpe || 8), 0) / sets.length;

  // Check if any set dropped significantly below minimum
  const anySetDroppedLow = sets.some(set => set.reps < repRangeMin - 2);

  // Determine weight increment based on exercise type and current weight
  const increment = getWeightIncrement(currentWeight);

  // All sets hit top of range with moderate effort -> increase weight
  if (allSetsHitTop && averageRPE <= 8) {
    return {
      exerciseId: plannedExercise.exerciseId,
      currentWeight,
      suggestedWeight: currentWeight + increment,
      reason: `All sets hit ${repRangeMax} reps with good form. Ready for +${increment}kg.`,
      confidence: 'high',
    };
  }

  // Sets dropping below minimum -> decrease weight
  if (anySetDroppedLow) {
    return {
      exerciseId: plannedExercise.exerciseId,
      currentWeight,
      suggestedWeight: Math.max(currentWeight - increment, 0),
      reason: `Reps dropped below ${repRangeMin}. Consider -${increment}kg for better form.`,
      confidence: 'medium',
    };
  }

  // Check for consistent performance over 2-3 weeks at top of range
  const consistentAtTop = checkConsistentPerformance(
    recentSessions,
    plannedExercise.exerciseId,
    repRangeMax
  );

  if (consistentAtTop) {
    return {
      exerciseId: plannedExercise.exerciseId,
      currentWeight,
      suggestedWeight: currentWeight + increment,
      reason: `Consistent performance at ${repRangeMax} reps for 2+ weeks. Time to progress.`,
      confidence: 'medium',
    };
  }

  // Otherwise, maintain weight and add reps
  return {
    exerciseId: plannedExercise.exerciseId,
    currentWeight,
    suggestedWeight: currentWeight,
    reason: `Keep building reps toward ${repRangeMax}. Maintain current weight.`,
    confidence: 'high',
  };
}

/**
 * Determine appropriate weight increment
 * - Smaller increments for isolation exercises (< 20kg)
 * - Larger increments for compound movements (>= 20kg)
 */
function getWeightIncrement(currentWeight: number): number {
  if (currentWeight < 10) return 1.25; // Small dumbbells
  if (currentWeight < 20) return 2.5;  // Medium dumbbells
  if (currentWeight < 50) return 2.5;  // Larger dumbbells / light barbell
  return 5;                             // Heavy barbell
}

/**
 * Find the most recent session that includes a specific exercise
 */
function findLastSessionWithExercise(
  sessions: GymSession[],
  exerciseId: string
): GymSession | null {
  // Sessions are sorted by date descending
  return sessions.find(session =>
    session.exercises.some(ex => ex.exerciseId === exerciseId)
  ) || null;
}

/**
 * Check if performance has been consistent at top of rep range
 * for the last 2-3 sessions
 */
function checkConsistentPerformance(
  sessions: GymSession[],
  exerciseId: string,
  targetReps: number
): boolean {
  const relevantSessions = sessions
    .filter(session =>
      session.exercises.some(ex => ex.exerciseId === exerciseId)
    )
    .slice(0, 3); // Last 3 sessions

  if (relevantSessions.length < 2) {
    return false; // Need at least 2 sessions
  }

  return relevantSessions.every(session => {
    const exerciseLog = session.exercises.find(ex => ex.exerciseId === exerciseId);
    if (!exerciseLog) return false;

    // Check if most sets hit target
    const setsHittingTarget = exerciseLog.sets.filter(set => set.reps >= targetReps).length;
    return setsHittingTarget >= exerciseLog.sets.length * 0.7; // 70% of sets
  });
}

/**
 * Get best set from exercise log (highest weight × reps)
 */
export function getBestSet(sets: SetLog[]): SetLog | undefined {
  if (sets.length === 0) return undefined;

  return sets.reduce((best, current) => {
    const currentVolume = current.weight * current.reps;
    const bestVolume = best.weight * best.reps;
    return currentVolume > bestVolume ? current : best;
  });
}

/**
 * Check if a set is a personal record
 */
export function isPersonalRecord(
  set: SetLog,
  exerciseId: string,
  allSessions: GymSession[]
): boolean {
  const currentVolume = set.weight * set.reps;

  // Check all previous sessions
  for (const session of allSessions) {
    const exerciseLog = session.exercises.find(ex => ex.exerciseId === exerciseId);
    if (!exerciseLog) continue;

    for (const prevSet of exerciseLog.sets) {
      const prevVolume = prevSet.weight * prevSet.reps;
      if (prevVolume >= currentVolume && prevSet.timestamp < set.timestamp) {
        return false; // Found a previous better or equal set
      }
    }
  }

  return true;
}

/**
 * Calculate estimated 1RM using Epley formula
 * 1RM = weight × (1 + reps / 30)
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Suggest progression for bodyweight exercises
 */
export function suggestBodyweightProgression(
  plannedExercise: PlannedExercise,
  recentSessions: GymSession[]
): ProgressionSuggestion | null {
  const lastSession = findLastSessionWithExercise(recentSessions, plannedExercise.exerciseId);

  if (!lastSession) return null;

  const exerciseLog = lastSession.exercises.find(
    ex => ex.exerciseId === plannedExercise.exerciseId
  );

  if (!exerciseLog) return null;

  const sets = exerciseLog.sets;
  const { repRangeMax } = plannedExercise;

  // Check if all sets hit top of range
  const allSetsHitTop = sets.every(set => set.reps >= repRangeMax);

  if (allSetsHitTop) {
    return {
      exerciseId: plannedExercise.exerciseId,
      currentWeight: 0,
      suggestedWeight: 0,
      reason: `Consistently hitting ${repRangeMax}+ reps. Consider weighted variation or harder progression.`,
      confidence: 'medium',
    };
  }

  return {
    exerciseId: plannedExercise.exerciseId,
    currentWeight: 0,
    suggestedWeight: 0,
    reason: `Keep building toward ${repRangeMax} reps per set.`,
    confidence: 'high',
  };
}
