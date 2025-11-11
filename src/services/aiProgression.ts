/**
 * AI Progression Service
 * Autonomous workout progression system that learns from user performance
 */

import {
  GymSession,
  ExerciseRecommendation,
  ProgressionState,
  SetLog,
  AIRecommendation,
  WorkoutPlan,
  Exercise,
  PerformanceInsight,
} from '../models/types';
import { loadGymSessions, loadWorkoutPlan, loadExerciseCatalog } from './storage';
import { detectExercisePlateau } from './geminiAI';

// ============================================================================
// Constants
// ============================================================================

const PROGRESSION_INCREMENT = 2.5; // kg
const DELOAD_PERCENTAGE = 0.9; // 10% reduction
const PLATEAU_THRESHOLD = 3; // sessions without progress
const MIN_SESSIONS_FOR_RECOMMENDATION = 1;

// ============================================================================
// Get Recommendation for Exercise/Set
// ============================================================================

/**
 * Get AI recommendation for the next set of an exercise
 */
export async function getSetRecommendation(
  exerciseId: string,
  dayType: GymSession['dayType'],
  setNumber: number,
  currentSessionSets: SetLog[]
): Promise<AIRecommendation> {
  try {
    // Load progression state
    const progressionState = await loadProgressionState();
    const existingRec = progressionState.recommendations.find(
      r => r.exerciseId === exerciseId && r.dayType === dayType
    );

    // If we have a recommendation, use it
    if (existingRec) {
      return {
        weight: existingRec.weight,
        reps: existingRec.reps,
        source: existingRec.source,
      };
    }

    // Otherwise, calculate baseline from history
    return await calculateBaselineRecommendation(exerciseId, dayType);
  } catch (error) {
    console.error('Error getting set recommendation:', error);
    // Fallback to plan target
    const plan = await loadWorkoutPlan();
    if (plan) {
      const plannedEx = plan.plans[dayType]?.exercises.find(pe => pe.exerciseId === exerciseId);
      if (plannedEx) {
        return {
          weight: 0, // User must set initial
          reps: Math.floor((plannedEx.repRangeMin + plannedEx.repRangeMax) / 2),
          source: 'baseline',
        };
      }
    }
    throw error;
  }
}

/**
 * Calculate baseline recommendation from user's history
 */
async function calculateBaselineRecommendation(
  exerciseId: string,
  dayType: GymSession['dayType']
): Promise<AIRecommendation> {
  const sessions = await loadGymSessions();
  const plan = await loadWorkoutPlan();

  // Find last time user did this exercise
  const relevantSessions = sessions.filter(s => s.dayType === dayType);

  for (const session of relevantSessions) {
    const exerciseLog = session.exercises.find(ex => ex.exerciseId === exerciseId);
    if (exerciseLog && exerciseLog.bestSet) {
      // Use their previous best set as baseline
      return {
        weight: exerciseLog.bestSet.weight,
        reps: exerciseLog.bestSet.reps,
        source: 'baseline',
      };
    }
  }

  // No history found, use plan target
  if (plan) {
    const plannedEx = plan.plans[dayType]?.exercises.find(pe => pe.exerciseId === exerciseId);
    if (plannedEx) {
      return {
        weight: 0, // User sets initial weight
        reps: Math.floor((plannedEx.repRangeMin + plannedEx.repRangeMax) / 2),
        source: 'baseline',
      };
    }
  }

  throw new Error('Cannot calculate baseline recommendation');
}

// ============================================================================
// Post-Session Analysis
// ============================================================================

/**
 * Analyze completed session and update recommendations
 * This is the autonomous AI that runs after every workout
 */
export async function analyzeSessionAndUpdateRecommendations(
  session: GymSession
): Promise<PerformanceInsight[]> {
  const insights: PerformanceInsight[] = [];

  try {
    const progressionState = await loadProgressionState();
    const allSessions = await loadGymSessions();
    const plan = await loadWorkoutPlan();

    if (!plan) return insights;

    // Analyze each exercise in the session
    for (const exerciseLog of session.exercises) {
      const { exerciseId } = exerciseLog;

      // Get planned exercise
      const plannedEx = plan.plans[session.dayType]?.exercises.find(
        pe => pe.exerciseId === exerciseId
      );
      if (!plannedEx) continue;

      // Find or create recommendation
      let rec = progressionState.recommendations.find(
        r => r.exerciseId === exerciseId && r.dayType === session.dayType
      );

      if (!rec) {
        // First time doing this exercise - create baseline
        if (exerciseLog.bestSet) {
          rec = {
            exerciseId,
            dayType: session.dayType,
            weight: exerciseLog.bestSet.weight,
            reps: exerciseLog.bestSet.reps,
            lastUpdated: new Date().toISOString(),
            source: 'baseline',
            sessionsAtWeight: 1,
            plateauDetected: false,
            deloadScheduled: false,
          };
          progressionState.recommendations.push(rec);
        }
        continue;
      }

      // Calculate performance
      const userBestSet = exerciseLog.bestSet;
      if (!userBestSet) continue;

      const recommendedVolume = rec.weight * rec.reps;
      const actualVolume = userBestSet.weight * userBestSet.reps;
      const performanceRatio = actualVolume / recommendedVolume;

      // Decision logic
      if (performanceRatio >= 1.15) {
        // User exceeded by 15%+ → Increase weight
        const oldWeight = rec.weight;
        const newWeight = rec.weight + PROGRESSION_INCREMENT;
        rec.weight = newWeight;
        rec.sessionsAtWeight = 0;
        rec.source = 'progression';
        rec.plateauDetected = false;
        rec.lastUpdated = new Date().toISOString();

        insights.push({
          type: 'auto_adjustment',
          message: `💪 ${exerciseId.replace(/_/g, ' ')}: Increased to ${newWeight}kg (you crushed ${oldWeight}kg!)`,
          discoveredAt: new Date().toISOString(),
          relatedExercises: [exerciseId],
        });

      } else if (performanceRatio >= 1.0) {
        // Hit target → Maintain
        rec.sessionsAtWeight += 1;
        rec.lastUpdated = new Date().toISOString();

        // Check for plateau
        if (rec.sessionsAtWeight >= PLATEAU_THRESHOLD) {
          rec.plateauDetected = true;

          if (!rec.deloadScheduled) {
            // Schedule deload
            const deloadWeight = Math.round(rec.weight * DELOAD_PERCENTAGE * 2) / 2;
            rec.weight = deloadWeight;
            rec.source = 'deload';
            rec.deloadScheduled = true;
            rec.sessionsAtWeight = 0;
            rec.lastUpdated = new Date().toISOString();

            insights.push({
              type: 'auto_adjustment',
              message: `🔄 ${exerciseId.replace(/_/g, ' ')}: Deload to ${deloadWeight}kg (recovery week to break plateau)`,
              discoveredAt: new Date().toISOString(),
              relatedExercises: [exerciseId],
            });
          }
        }

      } else if (performanceRatio >= 0.85) {
        // Close but didn't quite hit → Maintain for one more session
        rec.sessionsAtWeight += 1;
        rec.lastUpdated = new Date().toISOString();

      } else {
        // Failed significantly → Reduce weight
        const oldWeight = rec.weight;
        const newWeight = Math.max(
          rec.weight - PROGRESSION_INCREMENT,
          userBestSet.weight // Never go below what they actually did
        );
        rec.weight = newWeight;
        rec.sessionsAtWeight = 0;
        rec.source = 'plateau_recovery';
        rec.lastUpdated = new Date().toISOString();

        insights.push({
          type: 'auto_adjustment',
          message: `⚠️ ${exerciseId.replace(/_/g, ' ')}: Reduced to ${newWeight}kg (from ${oldWeight}kg to rebuild)`,
          discoveredAt: new Date().toISOString(),
          relatedExercises: [exerciseId],
        });
      }
    }

    // Save updated state
    progressionState.lastAnalysis = new Date().toISOString();
    await saveProgressionState(progressionState);

    return insights;
  } catch (error) {
    console.error('Error in post-session analysis:', error);
    return insights;
  }
}

// ============================================================================
// Deload & Exercise Swap Detection
// ============================================================================

/**
 * Check if any exercises need auto-deload
 */
export async function checkForAutoDeload(): Promise<PerformanceInsight[]> {
  const insights: PerformanceInsight[] = [];

  try {
    const progressionState = await loadProgressionState();
    const sessions = await loadGymSessions();

    for (const rec of progressionState.recommendations) {
      // Check plateau using existing function
      const hasPlateau = detectExercisePlateau(sessions, rec.exerciseId, PLATEAU_THRESHOLD);

      if (hasPlateau && !rec.deloadScheduled && !rec.plateauDetected) {
        // Trigger deload
        const deloadWeight = Math.round(rec.weight * DELOAD_PERCENTAGE * 2) / 2;
        rec.weight = deloadWeight;
        rec.source = 'deload';
        rec.deloadScheduled = true;
        rec.plateauDetected = true;
        rec.sessionsAtWeight = 0;
        rec.lastUpdated = new Date().toISOString();

        insights.push({
          type: 'auto_adjustment',
          message: `🔄 Auto-Deload: ${rec.exerciseId.replace(/_/g, ' ')} → ${deloadWeight}kg (breaking through plateau)`,
          discoveredAt: new Date().toISOString(),
          relatedExercises: [rec.exerciseId],
        });
      }
    }

    await saveProgressionState(progressionState);
    return insights;
  } catch (error) {
    console.error('Error checking for auto-deload:', error);
    return insights;
  }
}

/**
 * Check if any exercises need to be swapped
 * (Plateau persists even after deload)
 */
export async function checkForExerciseSwap(): Promise<{ needsSwap: boolean; exerciseIds: string[] }> {
  try {
    const progressionState = await loadProgressionState();
    const sessions = await loadGymSessions();
    const needsSwap: string[] = [];

    for (const rec of progressionState.recommendations) {
      // If deload was done but plateau still exists
      if (rec.deloadScheduled && rec.sessionsAtWeight >= PLATEAU_THRESHOLD) {
        needsSwap.push(rec.exerciseId);
      }
    }

    return { needsSwap: needsSwap.length > 0, exerciseIds: needsSwap };
  } catch (error) {
    console.error('Error checking for exercise swap:', error);
    return { needsSwap: false, exerciseIds: [] };
  }
}

// ============================================================================
// Storage Helpers
// ============================================================================

const PROGRESSION_STATE_KEY = '@upper_outdoor/progression_state';

async function loadProgressionState(): Promise<ProgressionState> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const jsonValue = await AsyncStorage.getItem(PROGRESSION_STATE_KEY);

    if (jsonValue) {
      return JSON.parse(jsonValue);
    }
  } catch (error) {
    console.error('Error loading progression state:', error);
  }

  // Return default state
  return {
    recommendations: [],
    lastAnalysis: new Date().toISOString(),
    autoAdjustmentsEnabled: true,
  };
}

async function saveProgressionState(state: ProgressionState): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const jsonValue = JSON.stringify(state);
    await AsyncStorage.setItem(PROGRESSION_STATE_KEY, jsonValue);
  } catch (error) {
    console.error('Error saving progression state:', error);
    throw error;
  }
}

/**
 * Reset progression state (for testing or user request)
 */
export async function resetProgressionState(): Promise<void> {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.removeItem(PROGRESSION_STATE_KEY);
}
