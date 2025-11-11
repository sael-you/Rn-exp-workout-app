/**
 * Exercise Database Service
 * Fetches and processes exercises from Free Exercise DB (GitHub)
 */

import { Exercise, ExerciseCatalog } from '../models/types';
import { saveExerciseCatalog, loadExerciseCatalog } from './storage';

const EXERCISE_DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// Raw exercise format from Free Exercise DB
interface RawExercise {
  id: string;
  name: string;
  force?: string; // push, pull, static
  level?: string; // beginner, intermediate, expert
  mechanic?: string; // compound, isolation
  equipment?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string;
  images?: string[];
}

/**
 * Fetch exercises from GitHub
 */
export async function fetchExercisesFromGitHub(): Promise<Exercise[]> {
  try {
    const response = await fetch(EXERCISE_DB_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch exercises: ${response.status}`);
    }

    const rawExercises: RawExercise[] = await response.json();
    return rawExercises.map(transformExercise);
  } catch (error) {
    console.error('Error fetching exercises from GitHub:', error);
    throw error;
  }
}

/**
 * Transform raw exercise to our format
 */
function transformExercise(raw: RawExercise): Exercise {
  // Determine body part from primary muscles
  const bodyPart = determineBodyPart(raw.primaryMuscles);
  const target = raw.primaryMuscles?.[0] || 'unknown';

  // Get all image URLs if available
  const imageUrls = raw.images
    ? raw.images.map(img => `${IMAGE_BASE_URL}${img}`)
    : [];

  // First image for backward compatibility
  const imageUrl = imageUrls[0];

  return {
    id: raw.id,
    name: raw.name,
    bodyPart,
    target,
    equipment: raw.equipment || 'bodyweight',
    imageUrl,
    imageUrls,
    secondaryMuscles: raw.secondaryMuscles,
    instructions: raw.instructions,
  };
}

/**
 * Determine body part category from muscle groups
 */
function determineBodyPart(muscles?: string[]): string {
  if (!muscles || muscles.length === 0) return 'other';

  const muscle = muscles[0].toLowerCase();

  if (muscle.includes('chest') || muscle.includes('pectorals')) return 'chest';
  if (muscle.includes('back') || muscle.includes('lats')) return 'back';
  if (muscle.includes('shoulder') || muscle.includes('deltoid')) return 'shoulders';
  if (muscle.includes('biceps')) return 'arms';
  if (muscle.includes('triceps')) return 'arms';
  if (muscle.includes('forearm')) return 'arms';
  if (muscle.includes('quadriceps') || muscle.includes('hamstring') || muscle.includes('glutes')) return 'legs';
  if (muscle.includes('calves')) return 'legs';
  if (muscle.includes('abdominal') || muscle.includes('abs')) return 'core';
  if (muscle.includes('traps')) return 'back';

  return 'other';
}

/**
 * Initialize exercise catalog (fetch and cache)
 */
export async function initializeExerciseCatalog(): Promise<ExerciseCatalog> {
  // Try loading from cache first
  const cached = await loadExerciseCatalog();

  // If cache exists and is less than 30 days old, use it
  if (cached) {
    const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    if (cacheAge < thirtyDays) {
      console.log('Using cached exercise catalog');
      return cached;
    }
  }

  // Fetch fresh data
  console.log('Fetching fresh exercise catalog from GitHub...');
  const exercises = await fetchExercisesFromGitHub();

  const catalog: ExerciseCatalog = {
    exercises,
    lastUpdated: new Date().toISOString(),
  };

  // Cache it
  await saveExerciseCatalog(catalog);

  return catalog;
}

/**
 * Get exercises by filter criteria
 */
export function filterExercises(
  exercises: Exercise[],
  filters: {
    bodyPart?: string;
    equipment?: string;
    target?: string;
    force?: 'push' | 'pull';
  }
): Exercise[] {
  return exercises.filter(exercise => {
    if (filters.bodyPart && exercise.bodyPart !== filters.bodyPart) return false;
    if (filters.equipment && exercise.equipment !== filters.equipment) return false;
    if (filters.target && exercise.target !== filters.target) return false;
    return true;
  });
}

/**
 * Get exercises suitable for Push day
 */
export function getPushExercises(exercises: Exercise[]): Exercise[] {
  const pushMuscles = ['chest', 'shoulders', 'arms'];
  const pushTargets = ['pectorals', 'chest', 'anterior deltoid', 'middle deltoid', 'triceps'];

  return exercises.filter(ex =>
    pushMuscles.includes(ex.bodyPart) ||
    pushTargets.some(target => ex.target.toLowerCase().includes(target))
  );
}

/**
 * Get exercises suitable for Pull day
 */
export function getPullExercises(exercises: Exercise[]): Exercise[] {
  const pullMuscles = ['back', 'arms'];
  const pullTargets = ['lats', 'middle back', 'lower back', 'traps', 'biceps', 'forearms'];

  return exercises.filter(ex =>
    (pullMuscles.includes(ex.bodyPart) && !ex.target.toLowerCase().includes('triceps')) ||
    pullTargets.some(target => ex.target.toLowerCase().includes(target))
  );
}

/**
 * Get exercises suitable for Upper2 day (mix of compound movements)
 */
export function getUpper2Exercises(exercises: Exercise[]): Exercise[] {
  const upperMuscles = ['chest', 'back', 'shoulders', 'arms'];
  return exercises.filter(ex => upperMuscles.includes(ex.bodyPart));
}

/**
 * Get exercises suitable for Outdoor day (legs, core, bodyweight)
 */
export function getOutdoorExercises(exercises: Exercise[]): Exercise[] {
  const outdoorMuscles = ['legs', 'core'];
  const bodyweightEquipment = ['bodyweight', 'body only', 'none'];

  return exercises.filter(ex =>
    outdoorMuscles.includes(ex.bodyPart) ||
    (bodyweightEquipment.includes(ex.equipment.toLowerCase()) &&
     (ex.bodyPart === 'legs' || ex.bodyPart === 'core'))
  );
}

/**
 * Get stretch exercises for a specific day type
 */
export function getStretchExercises(
  exercises: Exercise[],
  dayType: 'Push' | 'Pull' | 'Upper2' | 'Legs' | 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Outdoor'
): Exercise[] {
  // Filter exercises that have "stretch" in the name
  const allStretches = exercises.filter(ex =>
    ex.name.toLowerCase().includes('stretch')
  );

  // Map day types to relevant body parts for stretching
  const bodyPartMapping: Record<string, string[]> = {
    Push: ['chest', 'shoulders', 'arms'],
    Pull: ['back', 'arms'],
    Upper2: ['chest', 'back', 'shoulders', 'arms'],
    Legs: ['legs'],
    Chest: ['chest', 'shoulders'],
    Back: ['back', 'arms'],
    Shoulders: ['shoulders', 'arms'],
    Arms: ['arms'],
    Outdoor: ['legs', 'core'],
  };

  const relevantBodyParts = bodyPartMapping[dayType] || [];

  // Filter stretches by relevant body parts
  const relevantStretches = allStretches.filter(ex =>
    relevantBodyParts.some(part =>
      ex.bodyPart.toLowerCase().includes(part) ||
      ex.target.toLowerCase().includes(part) ||
      ex.name.toLowerCase().includes(part)
    )
  );

  // Limit to 5-8 stretches per session
  return relevantStretches.slice(0, 6);
}

/**
 * Search exercises by name
 */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const lowerQuery = query.toLowerCase();
  return exercises.filter(ex =>
    ex.name.toLowerCase().includes(lowerQuery) ||
    ex.target.toLowerCase().includes(lowerQuery) ||
    ex.bodyPart.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get exercise by ID
 */
export function getExerciseById(exercises: Exercise[], id: string): Exercise | undefined {
  return exercises.find(ex => ex.id === id);
}
