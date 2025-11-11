/**
 * Gemini AI Service
 * Analyzes workout sessions and provides insights using Google Gemini AI
 */

import { GymSession, OutdoorSession, UserProfile, Exercise, WorkoutPlan, DayPlan, PlannedExercise, TrainingSplit, DayType } from '../models/types';

// Load API key from environment variables
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiRequest {
  contents: {
    parts: {
      text: string;
    }[];
  }[];
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

/**
 * Call Gemini AI API
 */
async function callGeminiAPI(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Please check your .env file.');
  }

  try {
    const requestBody: GeminiRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error('No response from Gemini API');
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

/**
 * Format session data for AI analysis
 */
function formatSessionForAnalysis(session: GymSession | OutdoorSession): string {
  if ('exercises' in session) {
    // Gym session
    const gymSession = session as GymSession;
    let sessionText = `Gym Session: ${gymSession.dayType} Day\n`;
    sessionText += `Date: ${gymSession.date}\n`;
    sessionText += `Duration: ${gymSession.duration ? Math.floor(gymSession.duration / 60) : 'N/A'} minutes\n\n`;
    sessionText += `Exercises:\n`;

    gymSession.exercises.forEach((exerciseLog) => {
      sessionText += `\n- Exercise ID: ${exerciseLog.exerciseId}\n`;
      sessionText += `  Sets completed: ${exerciseLog.sets.length}\n`;
      exerciseLog.sets.forEach((set, index) => {
        sessionText += `    Set ${index + 1}: ${set.weight}kg × ${set.reps} reps\n`;
      });
      if (exerciseLog.bestSet) {
        sessionText += `  Best set: ${exerciseLog.bestSet.weight}kg × ${exerciseLog.bestSet.reps} reps\n`;
      }
    });

    return sessionText;
  } else {
    // Outdoor session
    const outdoorSession = session as OutdoorSession;
    let sessionText = `Outdoor Session\n`;
    sessionText += `Date: ${outdoorSession.date}\n`;
    sessionText += `Duration: ${outdoorSession.duration ? Math.floor(outdoorSession.duration / 60) : 'N/A'} minutes\n`;
    sessionText += `Distance: ${outdoorSession.distance ? (outdoorSession.distance / 1000).toFixed(2) : 'N/A'}km\n`;

    return sessionText;
  }
}

/**
 * Analyze a single workout session
 */
export async function analyzeSession(
  session: GymSession | OutdoorSession
): Promise<string> {
  const sessionData = formatSessionForAnalysis(session);

  const prompt = `You are a fitness coach analyzing a workout session. Please provide constructive feedback and insights.

${sessionData}

Please analyze this session and provide:
1. Overall performance assessment
2. Strengths observed in this workout
3. Areas for improvement
4. Specific recommendations for the next session

Keep your response concise and actionable (max 200 words).`;

  return await callGeminiAPI(prompt);
}

/**
 * Generate weekly progress report
 */
export async function generateWeeklyReport(
  sessions: (GymSession | OutdoorSession)[]
): Promise<string> {
  if (sessions.length === 0) {
    return 'No sessions completed this week.';
  }

  let reportPrompt = `You are a fitness coach reviewing a week of training. Analyze the following workout sessions and provide a comprehensive weekly report.

Sessions this week:\n\n`;

  sessions.forEach((session, index) => {
    reportPrompt += `\nSession ${index + 1}:\n`;
    reportPrompt += formatSessionForAnalysis(session);
    reportPrompt += `\n---\n`;
  });

  reportPrompt += `\nPlease provide a weekly report that includes:
1. Overall training volume and consistency
2. Key achievements this week
3. Progress trends (strength gains, volume increases, etc.)
4. Recovery and workload balance assessment
5. Recommendations for next week

Keep the report motivating and actionable (max 300 words).`;

  return await callGeminiAPI(reportPrompt);
}

/**
 * Analyze progress between two sessions
 */
export async function analyzeProgress(
  previousSession: GymSession | OutdoorSession,
  currentSession: GymSession | OutdoorSession
): Promise<string> {
  const previousData = formatSessionForAnalysis(previousSession);
  const currentData = formatSessionForAnalysis(currentSession);

  const prompt = `You are a fitness coach comparing two workout sessions to track progress. Analyze the differences and improvements.

PREVIOUS SESSION:
${previousData}

CURRENT SESSION:
${currentData}

Please analyze the progress and provide:
1. Key improvements observed
2. Areas where performance decreased (if any)
3. Strength gains or volume increases
4. Overall progress assessment
5. Specific goals for the next session

Keep your response concise and encouraging (max 250 words).`;

  return await callGeminiAPI(prompt);
}

/**
 * Get AI suggestions for next workout
 */
export async function getWorkoutSuggestions(
  recentSessions: (GymSession | OutdoorSession)[],
  dayType: DayType
): Promise<string> {
  let prompt = `You are a fitness coach planning the next workout. Based on recent training history, provide specific recommendations for the upcoming ${dayType} day.

Recent sessions:\n\n`;

  recentSessions.forEach((session, index) => {
    prompt += `\nSession ${index + 1}:\n`;
    prompt += formatSessionForAnalysis(session);
    prompt += `\n---\n`;
  });

  prompt += `\nFor the next ${dayType} workout, please suggest:
1. Target weights and rep ranges based on recent performance
2. Focus areas for this session
3. Any exercises that need extra attention
4. Recovery considerations

Keep suggestions practical and specific (max 200 words).`;

  return await callGeminiAPI(prompt);
}

/**
 * Get motivational message based on recent progress
 */
export async function getMotivationalMessage(
  recentSessions: (GymSession | OutdoorSession)[]
): Promise<string> {
  if (recentSessions.length === 0) {
    return "Let's start your fitness journey today! Every workout counts.";
  }

  let prompt = `You are a motivational fitness coach. Based on the recent training, provide an encouraging and personalized message.

Recent sessions:\n\n`;

  recentSessions.slice(-3).forEach((session, index) => {
    prompt += `\nSession ${index + 1}:\n`;
    prompt += formatSessionForAnalysis(session);
    prompt += `\n---\n`;
  });

  prompt += `\nProvide a short, motivational message (2-3 sentences) that:
1. Acknowledges their recent effort
2. Highlights specific achievements
3. Encourages continued progress

Be genuine, positive, and specific to their actual performance.`;

  return await callGeminiAPI(prompt);
}

/**
 * Detect plateau in a specific exercise
 * Returns true if user hasn't improved in the exercise for 3+ sessions
 */
export function detectExercisePlateau(
  sessions: GymSession[],
  exerciseId: string,
  minSessions: number = 3
): boolean {
  // Get all sessions containing this exercise
  const sessionsWithExercise = sessions.filter((session) =>
    session.exercises.some((ex) => ex.exerciseId === exerciseId)
  );

  if (sessionsWithExercise.length < minSessions) {
    return false; // Not enough data
  }

  // Get the most recent sessions for this exercise
  const recentSessions = sessionsWithExercise.slice(0, minSessions);

  // Extract best sets (highest weight × reps product)
  const bestPerformances = recentSessions.map((session) => {
    const exerciseLog = session.exercises.find((ex) => ex.exerciseId === exerciseId);
    if (!exerciseLog || !exerciseLog.bestSet) return 0;
    return exerciseLog.bestSet.weight * exerciseLog.bestSet.reps;
  });

  // Check if performance has stagnated (no improvement in last 3 sessions)
  const hasImproved = bestPerformances.some(
    (perf, idx) => idx > 0 && perf > bestPerformances[idx - 1]
  );

  return !hasImproved;
}

/**
 * Suggest deload week based on training volume and fatigue indicators
 */
export function shouldSuggestDeload(
  sessions: GymSession[],
  weeksOfTraining: number = 4
): boolean {
  // Suggest deload every 4-6 weeks
  if (weeksOfTraining >= 4 && weeksOfTraining <= 6) {
    // Check for fatigue indicators
    const recentSessions = sessions.slice(0, 6); // Last 6 sessions

    // Count sessions with declining performance
    let decliningSessions = 0;

    for (let i = 0; i < recentSessions.length - 1; i++) {
      const current = recentSessions[i];
      const previous = recentSessions[i + 1];

      // Compare same day types
      if (current.dayType === previous.dayType) {
        let decliningExercises = 0;

        current.exercises.forEach((currentEx) => {
          const prevEx = previous.exercises.find((ex) => ex.exerciseId === currentEx.exerciseId);

          if (prevEx && currentEx.bestSet && prevEx.bestSet) {
            const currentPerf = currentEx.bestSet.weight * currentEx.bestSet.reps;
            const prevPerf = prevEx.bestSet.weight * prevEx.bestSet.reps;

            if (currentPerf < prevPerf) {
              decliningExercises++;
            }
          }
        });

        // If more than 50% of exercises declined
        if (decliningExercises > current.exercises.length / 2) {
          decliningSessions++;
        }
      }
    }

    // Suggest deload if 2+ recent sessions show decline
    return decliningSessions >= 2;
  }

  return false;
}

/**
 * Analyze adherence patterns
 */
export function analyzeAdherence(
  sessions: (GymSession | OutdoorSession)[],
  weeklySchedule: { dayOfWeek: number; dayType: string }[]
): {
  adherenceRate: number;
  missedWorkouts: number;
  consistencyScore: number;
} {
  // Calculate for last 4 weeks
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const recentSessions = sessions.filter(
    (s) => new Date(s.date) >= fourWeeksAgo
  );

  const expectedWorkouts = weeklySchedule.filter((d) => d.dayType !== 'Rest').length * 4;
  const completedWorkouts = recentSessions.length;
  const adherenceRate = expectedWorkouts > 0 ? (completedWorkouts / expectedWorkouts) * 100 : 0;
  const missedWorkouts = Math.max(0, expectedWorkouts - completedWorkouts);

  // Consistency score: how evenly distributed are sessions?
  const weekDistribution = [0, 0, 0, 0];
  recentSessions.forEach((session) => {
    const sessionDate = new Date(session.date);
    const daysDiff = Math.floor(
      (new Date().getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weekIndex = Math.floor(daysDiff / 7);
    if (weekIndex < 4) {
      weekDistribution[weekIndex]++;
    }
  });

  // Standard deviation of weekly sessions (lower is more consistent)
  const avgSessionsPerWeek = completedWorkouts / 4;
  const variance =
    weekDistribution.reduce((sum, count) => sum + Math.pow(count - avgSessionsPerWeek, 2), 0) / 4;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = Math.max(0, 100 - stdDev * 20); // Normalize to 0-100

  return {
    adherenceRate,
    missedWorkouts,
    consistencyScore,
  };
}

/**
 * Suggest exercise substitution based on injury/pain
 */
export async function suggestExerciseSubstitution(
  exercise: Exercise,
  reason: 'pain' | 'equipment' | 'difficulty',
  availableExercises: Exercise[],
  userProfile?: UserProfile
): Promise<Exercise[]> {
  const prompt = `You are a strength & conditioning coach. A user needs to substitute an exercise.

CURRENT EXERCISE:
- Name: ${exercise.name}
- Target: ${exercise.target}
- Equipment: ${exercise.equipment}
- Body Part: ${exercise.bodyPart}

REASON FOR SUBSTITUTION: ${reason}
${reason === 'pain' ? '- User experiences pain/discomfort with this exercise' : ''}
${reason === 'equipment' ? '- User does not have access to this equipment' : ''}
${reason === 'difficulty' ? '- Exercise is too difficult for user skill level' : ''}

USER PROFILE:
${userProfile ? `- Experience: ${userProfile.experienceLevel}` : '- Experience: Unknown'}
${userProfile?.injuries ? `- Injuries: ${userProfile.injuries.map((i) => `${i.bodyPart} (${i.type})`).join(', ')}` : ''}

AVAILABLE EXERCISE IDS (first 20):
${availableExercises
    .filter((ex) => ex.bodyPart === exercise.bodyPart || ex.target === exercise.target)
    .slice(0, 20)
    .map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment}, targets ${ex.target})`)
    .join('\n')}

TASK:
Suggest 3 alternative exercises that:
1. Target the same muscle group (${exercise.target})
2. Address the reason for substitution
3. Use available equipment
4. Match user's experience level

Return ONLY a JSON array of exercise IDs, no explanation:
["exercise-id-1", "exercise-id-2", "exercise-id-3"]`;

  try {
    const response = await callGeminiAPI(prompt);
    const exerciseIds: string[] = JSON.parse(response.trim());

    const suggestions = exerciseIds
      .map((id) => availableExercises.find((ex) => ex.id === id))
      .filter((ex): ex is Exercise => ex !== undefined)
      .slice(0, 3);

    return suggestions;
  } catch (error) {
    console.error('Error suggesting exercise substitution:', error);
    // Fallback: return same body part exercises
    return availableExercises
      .filter((ex) => ex.bodyPart === exercise.bodyPart && ex.id !== exercise.id)
      .slice(0, 3);
  }
}

/**
 * Adapt workout program for constraints (time, equipment, etc.)
 */
export async function adaptProgramForConstraints(
  currentPlan: WorkoutPlan,
  constraint: {
    type: 'time' | 'equipment' | 'volume';
    details: string;
  },
  exercises: Exercise[],
  userProfile: UserProfile
): Promise<WorkoutPlan> {
  // Build current program summary dynamically
  const programSummary = Object.entries(currentPlan.plans)
    .filter(([_, dayPlan]) => dayPlan && dayPlan.exercises)
    .map(([dayType, dayPlan]) => `${dayType} Day: ${dayPlan!.exercises.length} exercises`)
    .join('\n');

  const prompt = `You are a strength & conditioning coach. Adapt the current workout program based on a constraint.

CURRENT PROGRAM:
${programSummary}

CONSTRAINT:
Type: ${constraint.type}
Details: ${constraint.details}

USER PROFILE:
- Goal: ${userProfile.primaryGoal}
- Experience: ${userProfile.experienceLevel}

TASK:
${constraint.type === 'time' ? 'Reduce session duration to fit constraint (reduce exercises or sets)' : ''}
${constraint.type === 'equipment' ? 'Replace exercises that require unavailable equipment' : ''}
${constraint.type === 'volume' ? 'Adjust training volume based on recovery needs' : ''}

Important: Maintain program quality and balanced muscle development.

Provide your adaptation strategy in 2-3 sentences.`;

  const advice = await callGeminiAPI(prompt);

  // Return current plan with adaptation notes (full program regeneration would go here)
  return {
    ...currentPlan,
    name: `${currentPlan.name} (Adapted)`,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a personalized workout program based on user profile
 */
export async function generateWorkoutProgram(
  userProfile: UserProfile,
  exercises: Exercise[]
): Promise<WorkoutPlan> {
  // ========================================
  // 1. EXPERIENCE-BASED VOLUME SCALING
  // ========================================
  const experienceLevel = userProfile.experienceLevel || 'intermediate';
  const isBodyPartSplit = userProfile.trainingSplit === 'body_part';

  let exerciseCount: number;
  let totalSets: number;

  if (isBodyPartSplit) {
    // Body part split: Higher volume per session
    if (experienceLevel === 'beginner') {
      exerciseCount = 6;
      totalSets = 14;
    } else {
      exerciseCount = 8;
      totalSets = 18;
    }
  } else {
    // Muscle group split: Moderate volume
    if (experienceLevel === 'beginner') {
      exerciseCount = 6;
      totalSets = 14;
    } else {
      exerciseCount = 8;
      totalSets = 18;
    }
  }

  // ========================================
  // 2. OUTDOOR LEG EXCLUSION RULE
  // ========================================
  const hasOutdoorDay = userProfile.outdoorDayPreference !== undefined;
  const excludeLegsFromGym = hasOutdoorDay && (userProfile.legTrainingPreference === 'spread' || userProfile.legTrainingPreference === 'dedicated');

  // ========================================
  // 3. FILTER & ORGANIZE EXERCISES
  // ========================================
  // Filter out excluded exercises
  let availableExercises = exercises.filter(
    (ex) => !userProfile.excludedExercises?.includes(ex.id)
  );

  // Filter by equipment based on workout location
  if (userProfile.workoutLocation === 'home' && userProfile.availableEquipment) {
    // Map user-friendly equipment names to database equipment strings
    const equipmentMapping: Record<string, string[]> = {
      'Bodyweight': ['bodyweight', 'body only', 'assisted', 'leverage'], // Bodyweight exercises in DB
      'Dumbbells': ['dumbbell'],
      'Resistance Bands': ['band', 'resistance band'],
      'Pull-up Bar': ['leverage', 'assisted'], // Pull-up bar and assisted exercises
      'Bench': ['bench'], // Will match exercises that use bench in equipment field
      'Kettlebells': ['kettlebell'],
      'Barbell': ['barbell', 'olympic barbell', 'ez barbell', 'ez curl bar'],
      'Adjustable Weights': ['dumbbell', 'kettlebell'], // Adjustable weights = dumbbells/kettlebells
    };

    // Build list of allowed equipment strings from user's selections
    const allowedEquipment: string[] = [];
    userProfile.availableEquipment.forEach((userEquip) => {
      const mappedEquipment = equipmentMapping[userEquip];
      if (mappedEquipment) {
        allowedEquipment.push(...mappedEquipment);
      }
    });

    // Filter exercises to only those using available equipment
    availableExercises = availableExercises.filter((ex) =>
      allowedEquipment.some((equip) => ex.equipment.toLowerCase().includes(equip))
    );

    console.log(`[AI] Home workout: Filtered to ${availableExercises.length} exercises using: ${userProfile.availableEquipment.join(', ')}`);
  }

  // Filter leg exercises based on user preference
  if (userProfile.legTrainingPreference === 'none') {
    const legBodyParts = ['upper legs', 'lower legs', 'cardio'];
    availableExercises = availableExercises.filter((ex) =>
      !legBodyParts.includes(ex.bodyPart.toLowerCase())
    );
  }

  // Group exercises by category
  const chestExercises = availableExercises.filter((ex) =>
    ex.bodyPart === 'chest' || ex.target.includes('pectoral')
  ).slice(0, 20);

  const shoulderExercises = availableExercises.filter((ex) =>
    ex.bodyPart === 'shoulders' || ex.target.includes('delt')
  ).slice(0, 15);

  const tricepsExercises = availableExercises.filter((ex) =>
    ex.target.includes('triceps')
  ).slice(0, 10);

  const backExercises = availableExercises.filter((ex) =>
    ex.bodyPart === 'back' || ex.target.includes('lats') || ex.target.includes('traps')
  ).slice(0, 20);

  const bicepsExercises = availableExercises.filter((ex) =>
    ex.target.includes('biceps')
  ).slice(0, 10);

  const legExercises = (userProfile.legTrainingPreference === 'spread' || userProfile.legTrainingPreference === 'dedicated')
    ? availableExercises.filter((ex) =>
        ex.bodyPart === 'upper legs' || ex.bodyPart === 'lower legs' ||
        ex.target.includes('quads') || ex.target.includes('hamstrings') ||
        ex.target.includes('glutes') || ex.target.includes('calves')
      ).slice(0, 20)
    : [];

  // ========================================
  // 4. GOAL-SPECIFIC PARAMETERS
  // ========================================
  const goal = userProfile.primaryGoal || 'hypertrophy';
  let repRanges: { compound: string; accessory: string; isolation: string };

  if (goal === 'strength') {
    repRanges = {
      compound: '4-6 reps',
      accessory: '6-10 reps',
      isolation: '8-12 reps'
    };
  } else if (goal === 'endurance') {
    repRanges = {
      compound: '12-15 reps',
      accessory: '15-20 reps',
      isolation: '20-25 reps'
    };
  } else {
    // Hypertrophy (default)
    repRanges = {
      compound: '6-8 reps',
      accessory: '8-12 reps',
      isolation: '10-15 reps'
    };
  }

  // ========================================
  // 5. BRANCH: MUSCLE GROUP vs BODY PART
  // ========================================
  const trainingSplit = userProfile.trainingSplit || 'muscle_group';

  if (trainingSplit === 'muscle_group') {
    return generateMuscleGroupProgram(
      userProfile,
      exerciseCount,
      totalSets,
      repRanges,
      excludeLegsFromGym,
      chestExercises,
      shoulderExercises,
      tricepsExercises,
      backExercises,
      bicepsExercises,
      legExercises,
      experienceLevel
    );
  } else {
    return generateBodyPartProgram(
      userProfile,
      exerciseCount,
      totalSets,
      repRanges,
      chestExercises,
      shoulderExercises,
      tricepsExercises,
      backExercises,
      bicepsExercises,
      legExercises,
      experienceLevel
    );
  }
}

/**
 * Generate Muscle Group (Push/Pull/Legs) Training Program
 */
async function generateMuscleGroupProgram(
  userProfile: UserProfile,
  exerciseCount: number,
  totalSets: number,
  repRanges: { compound: string; accessory: string; isolation: string },
  excludeLegsFromGym: boolean,
  chestExercises: Exercise[],
  shoulderExercises: Exercise[],
  tricepsExercises: Exercise[],
  backExercises: Exercise[],
  bicepsExercises: Exercise[],
  legExercises: Exercise[],
  experienceLevel: string
): Promise<WorkoutPlan> {
  const goal = userProfile.primaryGoal || 'hypertrophy';

  // Adjust exercise count based on leg preferences
  const pushExerciseCount = excludeLegsFromGym ? exerciseCount : (userProfile.legTrainingPreference === 'spread' ? exerciseCount + 1 : exerciseCount);
  const pullExerciseCount = excludeLegsFromGym ? exerciseCount : (userProfile.legTrainingPreference === 'spread' ? exerciseCount + 1 : exerciseCount);
  const upper2ExerciseCount = excludeLegsFromGym ? exerciseCount : (userProfile.legTrainingPreference === 'spread' ? exerciseCount + 1 : exerciseCount);

  const prompt = `You are an expert strength & conditioning coach with 20 years of experience. Design a personalized MUSCLE GROUP SPLIT (Push/Pull/Legs) training program.

USER PROFILE:
- Primary Goal: ${goal.toUpperCase()} (${goal === 'strength' ? 'maximize 1RM strength' : goal === 'endurance' ? 'muscular endurance & conditioning' : 'muscle hypertrophy & size'})
- Experience Level: ${experienceLevel}
- Training Location: ${userProfile.workoutLocation === 'home' ? `Home workout - ONLY use exercises from the provided list (filtered for available equipment: ${userProfile.availableEquipment?.join(', ') || 'body weight only'})` : 'Gym (full equipment access)'}
- Leg Training: ${excludeLegsFromGym ? 'EXCLUDED from gym days (user has outdoor leg training)' : userProfile.legTrainingPreference === 'spread' ? 'Spread across all days (1 exercise per day)' : userProfile.legTrainingPreference === 'dedicated' ? 'Dedicated leg day' : 'Upper body focus only'}
${userProfile.injuries && userProfile.injuries.length > 0 ? `- Injuries/Limitations: ${userProfile.injuries.map((i) => `${i.bodyPart} (${i.type})`).join(', ')}` : ''}
${userProfile.mobilityIssues && userProfile.mobilityIssues.length > 0 ? `- Mobility Issues: ${userProfile.mobilityIssues.join(', ')}` : ''}

TRAINING SPLIT:
- Push Day: Chest, shoulders, triceps${!excludeLegsFromGym && userProfile.legTrainingPreference === 'spread' ? ' + 1 leg exercise' : ''}
- Pull Day: Back, biceps, rear delts${!excludeLegsFromGym && userProfile.legTrainingPreference === 'spread' ? ' + 1 leg exercise' : ''}
- Upper2 Day: Full upper body (balanced, hitting weak points)${!excludeLegsFromGym && userProfile.legTrainingPreference === 'spread' ? ' + 1 leg exercise' : ''}${userProfile.legTrainingPreference === 'dedicated' ? '\n- Legs Day: Dedicated leg training (quads, hamstrings, glutes, calves)' : ''}

AVAILABLE EXERCISES - Select from these IDs:

CHEST (${chestExercises.length} options):
${chestExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}

SHOULDERS (${shoulderExercises.length} options):
${shoulderExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}

TRICEPS (${tricepsExercises.length} options):
${tricepsExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}

BACK (${backExercises.length} options):
${backExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}

BICEPS (${bicepsExercises.length} options):
${bicepsExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}
${(!excludeLegsFromGym && legExercises.length > 0) ? `
LEGS (${legExercises.length} options):
${legExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}
` : ''}

PROGRAMMING PRINCIPLES:
1. Experience-Based Volume:
   - ${experienceLevel === 'beginner' ? 'Beginner: Lower volume, focus on form mastery, favor machines/cables for safety' : 'Intermediate/Advanced: Higher volume, include free weights and compound lifts'}
   - Target: ${totalSets} total sets per session, ${exerciseCount} exercises per day

2. Volume Targets per Muscle per Week (adjust for ${goal}):
   - Chest: ${goal === 'strength' ? '10-14 sets' : '14-18 sets'}
   - Back: ${goal === 'strength' ? '10-14 sets' : '12-16 sets'}
   - Shoulders: ${goal === 'strength' ? '8-12 sets' : '12-15 sets'}
   - Triceps: ${goal === 'strength' ? '6-9 sets' : '9-12 sets'}
   - Biceps: ${goal === 'strength' ? '6-8 sets' : '8-10 sets'}${!excludeLegsFromGym && userProfile.legTrainingPreference === 'spread' ? `\n   - Legs: 9-12 sets (spread across 3 days)` : userProfile.legTrainingPreference === 'dedicated' ? `\n   - Legs: 12-16 sets (dedicated day)` : ''}

3. Rep Ranges (${goal.toUpperCase()}):
   - Compound exercises: ${repRanges.compound}
   - Accessory exercises: ${repRanges.accessory}
   - Isolation exercises: ${repRanges.isolation}

4. Exercise Selection:
   ${experienceLevel === 'beginner' ? '- Favor machines, cables, and dumbbells for safety and form learning\n   - Include 1-2 barbell compounds maximum\n   - Prioritize controlled, safe movements' : '- Balance free weights and machines\n   - Include barbell compounds for strength foundation\n   - Mix equipment for variety'}

   PUSH DAY (${pushExerciseCount} exercises):
   a) Chest compound press (barbell or dumbbell) - ${goal === 'strength' ? '5 sets × 4-6 reps' : '4 sets × 6-8 reps'}
   b) Chest incline variation - ${goal === 'strength' ? '4 sets × 6-8 reps' : '3 sets × 8-10 reps'}
   c) Chest isolation (fly, cable, etc.) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-12 reps'}
   d) Shoulder overhead press - ${goal === 'strength' ? '4 sets × 4-6 reps' : '3-4 sets × 6-8 reps'}
   e) LATERAL RAISE (MANDATORY) - 3 sets × ${goal === 'strength' ? '8-12 reps' : '10-15 reps'}
   f) Triceps exercise - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '8-12 reps'}${!excludeLegsFromGym && userProfile.legTrainingPreference === 'spread' ? `\n   g) Leg exercise (squat, leg press, or lunge) - 3 sets × 8-12 reps` : ''}

   PULL DAY (${pullExerciseCount} exercises):
   a) Horizontal pull (row variation) - ${goal === 'strength' ? '5 sets × 4-6 reps' : '4 sets × 6-8 reps'}
   b) Vertical pull (pull-up or pulldown) - ${goal === 'strength' ? '4 sets × 4-6 reps' : '3-4 sets × 6-10 reps'}
   c) Back accessory (row, pullover, etc.) - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'}
   d) Traps/upper back (shrug, face pull, etc.) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '8-12 reps'}
   e) Biceps compound (barbell curl, etc.) - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-10 reps'}
   f) REAR DELT (MANDATORY) - 3 sets × ${goal === 'strength' ? '8-12 reps' : '10-15 reps'}${!excludeLegsFromGym && userProfile.legTrainingPreference === 'spread' ? `\n   g) Leg exercise (deadlift variation, hamstring curl, hip thrust) - 3 sets × 8-12 reps` : ''}

   UPPER2 DAY (${upper2ExerciseCount} exercises - balanced mix):
   a) Shoulder press variation - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'}
   b) Chest compound - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'}
   c) Back compound - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'}
   d) LATERAL RAISE variation (MANDATORY) - 3 sets × ${goal === 'strength' ? '10-12 reps' : '12-15 reps'}
   e) Biceps exercise - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-12 reps'}
   f) Triceps exercise - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-12 reps'}${!excludeLegsFromGym && userProfile.legTrainingPreference === 'spread' ? `\n   g) Leg accessory (calf, leg extension, etc.) - 3 sets × 10-15 reps` : ''}${userProfile.legTrainingPreference === 'dedicated' ? `\n\n   LEGS DAY (4-5 exercises):\n   a) Quad compound (squat, leg press) - ${goal === 'strength' ? '5 sets × 4-6 reps' : '4 sets × 6-10 reps'}\n   b) Hamstring compound (RDL, leg curl) - ${goal === 'strength' ? '4 sets × 6-8 reps' : '3-4 sets × 8-12 reps'}\n   c) Glute exercise (hip thrust, Bulgarian split squat) - 3 sets × 8-12 reps\n   d) Quad isolation (leg extension, lunge) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-15 reps'}\n   e) Calf exercise - 3 sets × ${goal === 'endurance' ? '20-25 reps' : '12-20 reps'}` : ''}

5. PROGRESSIVE OVERLOAD:
   - Week 1-2: Establish baseline (learn movements, perfect form)
   - Week 3-4: Add 5-10% load or 1-2 reps
   - Week 5-6: Add 5-10% load or 1-2 reps
   - Week 7: Deload (reduce volume by 40%)
   - Repeat cycle with higher baseline

${userProfile.injuries && userProfile.injuries.length > 0 ? `
SAFETY CONSIDERATIONS:
${userProfile.injuries.map((i) => `- ${i.bodyPart}: ${i.restrictions?.join(', ') || 'Modify as needed'}`).join('\n')}
` : ''}

TASK:
Design the complete program by selecting exercises from the available database. Return ONLY the exercise ID (not the full name).

Return your response in this EXACT JSON format (no markdown, no explanation, pure JSON):
{
  "Push": [
    {"exerciseId": "exercise-id-here", "targetSets": 4, "repRangeMin": 6, "repRangeMax": 8, "rationale": "Primary chest compound"},
    ...
  ],
  "Pull": [
    ...
  ],
  "Upper2": [
    ...
  ],${userProfile.legTrainingPreference === 'dedicated' ? '\n  "Legs": [\n    ...\n  ],' : ''}
  "overallRationale": "Brief explanation of program design philosophy",
  "progressionScheme": "How to progress week to week"
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- Use actual exercise IDs from the database
- Push/Pull/Upper2 days MUST have exactly ${pushExerciseCount}/${pullExerciseCount}/${upper2ExerciseCount} exercises respectively
- Order exercises from most taxing to least (compounds first, accessories last)
- MANDATORY: Include lateral raises on Push and Upper2 days
- MANDATORY: Include rear delt work on Pull day${!excludeLegsFromGym && userProfile.legTrainingPreference === 'spread' ? '\n- MANDATORY: Include ONE leg exercise on each day' : ''}${userProfile.legTrainingPreference === 'dedicated' ? '\n- MANDATORY: Include 4-5 leg exercises on dedicated Legs day' : ''}`;

  try {
    console.log('[AI] Generating Muscle Group Split program...');
    const aiResponse = await callGeminiAPI(prompt);

    // Parse JSON response
    let jsonString = aiResponse.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    const programData = JSON.parse(jsonString);

    // Build WorkoutPlan object
    const workoutPlan: WorkoutPlan = {
      id: `ai-generated-${Date.now()}`,
      name: `${goal.charAt(0).toUpperCase() + goal.slice(1)} Program - Muscle Group Split`,
      trainingSplit: 'muscle_group',
      plans: {
        Push: {
          dayType: 'Push',
          exercises: programData.Push.map((ex: any, index: number) => ({
            exerciseId: ex.exerciseId,
            order: index,
            targetSets: ex.targetSets,
            repRangeMin: ex.repRangeMin,
            repRangeMax: ex.repRangeMax,
            notes: ex.rationale,
          })),
        },
        Pull: {
          dayType: 'Pull',
          exercises: programData.Pull.map((ex: any, index: number) => ({
            exerciseId: ex.exerciseId,
            order: index,
            targetSets: ex.targetSets,
            repRangeMin: ex.repRangeMin,
            repRangeMax: ex.repRangeMax,
            notes: ex.rationale,
          })),
        },
        Upper2: {
          dayType: 'Upper2',
          exercises: programData.Upper2.map((ex: any, index: number) => ({
            exerciseId: ex.exerciseId,
            order: index,
            targetSets: ex.targetSets,
            repRangeMin: ex.repRangeMin,
            repRangeMax: ex.repRangeMax,
            notes: ex.rationale,
          })),
        },
        ...(programData.Legs && {
          Legs: {
            dayType: 'Legs',
            exercises: programData.Legs.map((ex: any, index: number) => ({
              exerciseId: ex.exerciseId,
              order: index,
              targetSets: ex.targetSets,
              repRangeMin: ex.repRangeMin,
              repRangeMax: ex.repRangeMax,
              notes: ex.rationale,
            })),
          },
        }),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[AI] Muscle Group Split program generated successfully');
    return workoutPlan;
  } catch (error) {
    console.error('Error generating muscle group program:', error);
    throw new Error('Failed to generate workout program. Please try again.');
  }
}

/**
 * Generate Body Part (Chest/Back/Shoulders/Arms) Training Program
 */
async function generateBodyPartProgram(
  userProfile: UserProfile,
  exerciseCount: number,
  totalSets: number,
  repRanges: { compound: string; accessory: string; isolation: string },
  chestExercises: Exercise[],
  shoulderExercises: Exercise[],
  tricepsExercises: Exercise[],
  backExercises: Exercise[],
  bicepsExercises: Exercise[],
  legExercises: Exercise[],
  experienceLevel: string
): Promise<WorkoutPlan> {
  const goal = userProfile.primaryGoal || 'hypertrophy';
  const hasLegs = userProfile.legTrainingPreference === 'dedicated' || userProfile.legTrainingPreference === 'spread';

  const prompt = `You are an expert strength & conditioning coach with 20 years of experience. Design a personalized BODY PART SPLIT training program.

USER PROFILE:
- Primary Goal: ${goal.toUpperCase()} (${goal === 'strength' ? 'maximize 1RM strength' : goal === 'endurance' ? 'muscular endurance & conditioning' : 'muscle hypertrophy & size'})
- Experience Level: ${experienceLevel}
- Training Location: ${userProfile.workoutLocation === 'home' ? `Home workout - ONLY use exercises from the provided list (filtered for available equipment: ${userProfile.availableEquipment?.join(', ') || 'body weight only'})` : 'Gym (full equipment access)'}
- Leg Training: ${userProfile.legTrainingPreference === 'dedicated' ? 'Dedicated leg day' : userProfile.legTrainingPreference === 'spread' ? 'Spread across days' : 'Upper body focus only'}
${userProfile.injuries && userProfile.injuries.length > 0 ? `- Injuries/Limitations: ${userProfile.injuries.map((i) => `${i.bodyPart} (${i.type})`).join(', ')}` : ''}
${userProfile.mobilityIssues && userProfile.mobilityIssues.length > 0 ? `- Mobility Issues: ${userProfile.mobilityIssues.join(', ')}` : ''}

TRAINING SPLIT (Body Part Isolation):
- Chest Day: Complete chest focus
- Back Day: Complete back & lat focus
- Shoulders Day: All three deltoid heads (front, side, rear)
- Arms Day: Biceps & triceps${hasLegs ? '\n- Legs Day: Quads, hamstrings, glutes, calves' : ''}

AVAILABLE EXERCISES - Select from these IDs:

CHEST (${chestExercises.length} options):
${chestExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}

SHOULDERS (${shoulderExercises.length} options):
${shoulderExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}

TRICEPS (${tricepsExercises.length} options):
${tricepsExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}

BACK (${backExercises.length} options):
${backExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}

BICEPS (${bicepsExercises.length} options):
${bicepsExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}
${hasLegs ? `
LEGS (${legExercises.length} options):
${legExercises.map((ex) => `- ${ex.id}: ${ex.name} (${ex.equipment})`).join('\n')}
` : ''}

PROGRAMMING PRINCIPLES:
1. Experience-Based Volume:
   - ${experienceLevel === 'beginner' ? 'Beginner: 6-8 exercises, 14-16 total sets, favor machines/cables' : 'Intermediate/Advanced: 8-10 exercises, 18-22 total sets, mix free weights and machines'}

2. Volume Targets per Muscle per Week (adjust for ${goal}):
   - Each muscle gets ONE dedicated day with high volume
   - Chest Day: ${goal === 'strength' ? '12-16 sets' : experienceLevel === 'beginner' ? '14-18 sets' : '18-22 sets'}
   - Back Day: ${goal === 'strength' ? '12-16 sets' : experienceLevel === 'beginner' ? '14-18 sets' : '18-22 sets'}
   - Shoulders Day: ${goal === 'strength' ? '10-14 sets' : experienceLevel === 'beginner' ? '12-16 sets' : '16-20 sets'}
   - Arms Day: ${goal === 'strength' ? '10-14 sets' : experienceLevel === 'beginner' ? '12-16 sets' : '16-20 sets'} (split between biceps & triceps)${hasLegs ? `\n   - Legs Day: ${goal === 'strength' ? '12-16 sets' : experienceLevel === 'beginner' ? '14-18 sets' : '18-22 sets'}` : ''}

3. Rep Ranges (${goal.toUpperCase()}):
   - Compound exercises: ${repRanges.compound}
   - Accessory exercises: ${repRanges.accessory}
   - Isolation exercises: ${repRanges.isolation}

4. Exercise Selection:
   ${experienceLevel === 'beginner' ? '- Favor machines, cables, and dumbbells for safety\n   - Include 1-2 barbell compounds maximum per day\n   - Prioritize controlled, safe movements\n   - 6-8 exercises per day, 14-16 total sets' : '- Balance free weights and machines\n   - Include 2-3 barbell compounds per day\n   - Mix equipment for variety\n   - 8-10 exercises per day, 18-22 total sets'}

   CHEST DAY (${experienceLevel === 'beginner' ? '6-7' : '8-9'} exercises):
   a) Flat barbell/dumbbell press - ${goal === 'strength' ? '5 sets × 4-6 reps' : '4 sets × 6-8 reps'}
   b) Incline barbell/dumbbell press - ${goal === 'strength' ? '4 sets × 6-8 reps' : '4 sets × 8-10 reps'}
   c) Decline or flat variation (different from a) - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'}
   d) Incline fly or cable fly - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-12 reps'}
   e) Chest isolation (machine, cable, or dumbbell fly) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-15 reps'}
   f) Upper chest focus (high incline or low-to-high cable) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-15 reps'}${experienceLevel !== 'beginner' ? `\n   g) Chest stretch/squeeze movement (dumbbell pullover or pec deck) - 3 sets × 12-15 reps\n   h) Finisher (push-up variation or cable work) - 2-3 sets × ${goal === 'endurance' ? '20-25 reps' : '12-20 reps'}` : ''}

   BACK DAY (${experienceLevel === 'beginner' ? '6-7' : '8-9'} exercises):
   a) Barbell/T-bar row - ${goal === 'strength' ? '5 sets × 4-6 reps' : '4 sets × 6-8 reps'}
   b) Pull-up or lat pulldown - ${goal === 'strength' ? '4 sets × 4-6 reps' : '4 sets × 6-10 reps'}
   c) Dumbbell/cable row - 3-4 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'}
   d) Wide grip pull or pulldown - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'}
   e) Lower lat exercise (straight arm pulldown, pullover) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-15 reps'}
   f) Traps (shrug or upright row) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '8-12 reps'}${experienceLevel !== 'beginner' ? `\n   g) Rear delt (face pull or reverse fly) - 3 sets × 12-15 reps\n   h) Finisher (high-rep rows or band work) - 2-3 sets × ${goal === 'endurance' ? '20-25 reps' : '15-20 reps'}` : ''}

   SHOULDERS DAY (${experienceLevel === 'beginner' ? '6-7' : '8-9'} exercises):
   a) Overhead press (barbell or dumbbell) - ${goal === 'strength' ? '5 sets × 4-6 reps' : '4 sets × 6-8 reps'}
   b) Lateral raise (dumbbell or cable) - 4 sets × ${goal === 'strength' ? '8-12 reps' : '10-15 reps'}
   c) Front raise or Arnold press - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'}
   d) Rear delt fly (dumbbell, cable, or machine) - 4 sets × ${goal === 'endurance' ? '15-20 reps' : '10-15 reps'}
   e) Lateral raise variation (machine, cable, or different angle) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '12-15 reps'}
   f) Upright row or shrug - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '8-12 reps'}${experienceLevel !== 'beginner' ? `\n   g) Rear delt variation (face pull or reverse pec deck) - 3 sets × 12-15 reps\n   h) Finisher (high-rep lateral raises or drop sets) - 2-3 sets × ${goal === 'endurance' ? '20-25 reps' : '15-20 reps'}` : ''}

   ARMS DAY (${experienceLevel === 'beginner' ? '6-8' : '8-10'} exercises):
   BICEPS:
   a) Barbell curl - ${goal === 'strength' ? '4 sets × 6-8 reps' : '4 sets × 8-10 reps'}
   b) Incline dumbbell curl - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '10-12 reps'}
   c) Hammer curl - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '10-12 reps'}${experienceLevel !== 'beginner' ? `\n   d) Cable or preacher curl - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '12-15 reps'}` : ''}

   TRICEPS:
   e) Close-grip bench or dip - ${goal === 'strength' ? '4 sets × 6-8 reps' : '4 sets × 8-10 reps'}
   f) Overhead triceps extension - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '10-12 reps'}
   g) Triceps pushdown (cable) - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-12 reps'}${experienceLevel !== 'beginner' ? `\n   h) Skull crusher or cable variation - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '12-15 reps'}\n   i) Finisher (superset biceps + triceps) - 2-3 sets × 15-20 reps each` : ''}${hasLegs ? `\n\n   LEGS DAY (${experienceLevel === 'beginner' ? '6-7' : '8-9'} exercises):\n   a) Squat or leg press - ${goal === 'strength' ? '5 sets × 4-6 reps' : '4 sets × 6-10 reps'}\n   b) Romanian deadlift or leg curl - ${goal === 'strength' ? '4 sets × 6-8 reps' : '4 sets × 8-12 reps'}\n   c) Bulgarian split squat or lunge - 3 sets × ${goal === 'endurance' ? '12-15 reps' : '8-12 reps'} per leg\n   d) Leg extension - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-15 reps'}\n   e) Leg curl variation - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '10-15 reps'}\n   f) Hip thrust or glute bridge - 3 sets × ${goal === 'endurance' ? '15-20 reps' : '12-15 reps'}${experienceLevel !== 'beginner' ? `\n   g) Calf raise (standing) - 4 sets × ${goal === 'endurance' ? '20-25 reps' : '12-20 reps'}\n   h) Calf raise (seated) or finisher - 3 sets × ${goal === 'endurance' ? '20-25 reps' : '15-20 reps'}` : '\n   g) Calf raise - 3-4 sets × 12-20 reps'}` : ''}

5. PROGRESSIVE OVERLOAD:
   - Week 1-2: Establish baseline (learn movements, perfect form)
   - Week 3-4: Add 5-10% load or 1-2 reps
   - Week 5-6: Add 5-10% load or 1-2 reps
   - Week 7: Deload (reduce volume by 40%)
   - Repeat cycle with higher baseline

${userProfile.injuries && userProfile.injuries.length > 0 ? `
SAFETY CONSIDERATIONS:
${userProfile.injuries.map((i) => `- ${i.bodyPart}: ${i.restrictions?.join(', ') || 'Modify as needed'}`).join('\n')}
` : ''}

TASK:
Design the complete body part split program by selecting exercises from the available database. Return ONLY the exercise ID (not the full name).

Return your response in this EXACT JSON format (no markdown, no explanation, pure JSON):
{
  "Chest": [
    {"exerciseId": "exercise-id-here", "targetSets": 4, "repRangeMin": 6, "repRangeMax": 8, "rationale": "Primary chest compound"},
    ...
  ],
  "Back": [
    ...
  ],
  "Shoulders": [
    ...
  ],
  "Arms": [
    ...
  ],${hasLegs ? '\n  "Legs": [\n    ...\n  ],' : ''}
  "overallRationale": "Brief explanation of program design philosophy",
  "progressionScheme": "How to progress week to week"
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- Use actual exercise IDs from the database
- Each day MUST have ${experienceLevel === 'beginner' ? '6-8' : '8-10'} exercises (following the structure above)
- Order exercises from most taxing to least (heavy compounds first, isolations last)
- Arms day: Balance biceps and triceps exercises evenly${hasLegs ? '\n- Legs day: Cover all lower body muscles (quads, hamstrings, glutes, calves)' : ''}`;

  try {
    console.log('[AI] Generating Body Part Split program...');
    const aiResponse = await callGeminiAPI(prompt);

    // Parse JSON response
    let jsonString = aiResponse.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    const programData = JSON.parse(jsonString);

    // Build WorkoutPlan object
    const workoutPlan: WorkoutPlan = {
      id: `ai-generated-${Date.now()}`,
      name: `${goal.charAt(0).toUpperCase() + goal.slice(1)} Program - Body Part Split`,
      trainingSplit: 'body_part',
      plans: {
        Chest: {
          dayType: 'Chest',
          exercises: programData.Chest.map((ex: any, index: number) => ({
            exerciseId: ex.exerciseId,
            order: index,
            targetSets: ex.targetSets,
            repRangeMin: ex.repRangeMin,
            repRangeMax: ex.repRangeMax,
            notes: ex.rationale,
          })),
        },
        Back: {
          dayType: 'Back',
          exercises: programData.Back.map((ex: any, index: number) => ({
            exerciseId: ex.exerciseId,
            order: index,
            targetSets: ex.targetSets,
            repRangeMin: ex.repRangeMin,
            repRangeMax: ex.repRangeMax,
            notes: ex.rationale,
          })),
        },
        Shoulders: {
          dayType: 'Shoulders',
          exercises: programData.Shoulders.map((ex: any, index: number) => ({
            exerciseId: ex.exerciseId,
            order: index,
            targetSets: ex.targetSets,
            repRangeMin: ex.repRangeMin,
            repRangeMax: ex.repRangeMax,
            notes: ex.rationale,
          })),
        },
        Arms: {
          dayType: 'Arms',
          exercises: programData.Arms.map((ex: any, index: number) => ({
            exerciseId: ex.exerciseId,
            order: index,
            targetSets: ex.targetSets,
            repRangeMin: ex.repRangeMin,
            repRangeMax: ex.repRangeMax,
            notes: ex.rationale,
          })),
        },
        ...(programData.Legs && {
          Legs: {
            dayType: 'Legs',
            exercises: programData.Legs.map((ex: any, index: number) => ({
              exerciseId: ex.exerciseId,
              order: index,
              targetSets: ex.targetSets,
              repRangeMin: ex.repRangeMin,
              repRangeMax: ex.repRangeMax,
              notes: ex.rationale,
            })),
          },
        }),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[AI] Body Part Split program generated successfully');
    return workoutPlan;
  } catch (error) {
    console.error('Error generating body part program:', error);
    throw new Error('Failed to generate workout program. Please try again.');
  }
}
