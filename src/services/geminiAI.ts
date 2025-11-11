/**
 * Gemini AI Service
 * Analyzes workout sessions and provides insights using Google Gemini AI
 */

import { GymSession, OutdoorSession, UserProfile, Exercise, WorkoutPlan, DayPlan, PlannedExercise } from '../models/types';

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
  dayType: 'Push' | 'Pull' | 'Upper2' | 'Outdoor'
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
  const prompt = `You are a strength & conditioning coach. Adapt the current workout program based on a constraint.

CURRENT PROGRAM:
Push Day: ${currentPlan.plans.Push.exercises.length} exercises
Pull Day: ${currentPlan.plans.Pull.exercises.length} exercises
Upper2 Day: ${currentPlan.plans.Upper2.exercises.length} exercises

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
  // Prepare exercise data for AI
  const exercisesByMuscle: Record<string, Exercise[]> = {};
  exercises.forEach((ex) => {
    if (!exercisesByMuscle[ex.bodyPart]) {
      exercisesByMuscle[ex.bodyPart] = [];
    }
    exercisesByMuscle[ex.bodyPart].push(ex);
  });

  // Filter out excluded exercises
  const availableExercises = exercises.filter(
    (ex) => !userProfile.excludedExercises?.includes(ex.id)
  );

  // Group exercises by category for the AI
  const chestExercises = availableExercises.filter((ex) =>
    ex.bodyPart === 'chest' || ex.target.includes('pectoral')
  ).slice(0, 20); // Limit to top 20 per category

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

  // Build prompt for AI with actual exercise options
  let prompt = `You are an expert strength & conditioning coach with 20 years of experience. Design a personalized 3-day upper body training program.

USER PROFILE:
- Primary Goal: ${userProfile.primaryGoal || 'hypertrophy (muscle building)'}
- Experience Level: ${userProfile.experienceLevel || 'intermediate'}
${userProfile.injuries && userProfile.injuries.length > 0 ? `- Injuries/Limitations: ${userProfile.injuries.map((i) => `${i.bodyPart} (${i.type})`).join(', ')}` : ''}
${userProfile.mobilityIssues && userProfile.mobilityIssues.length > 0 ? `- Mobility Issues: ${userProfile.mobilityIssues.join(', ')}` : ''}

TRAINING SPLIT:
- Push Day: Chest, shoulders, triceps
- Pull Day: Back, biceps, rear delts
- Upper2 Day: Full upper body (balanced, hitting weak points)

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

PROGRAMMING PRINCIPLES:
1. Volume targets per muscle per week (across all 3 days):
   - Chest: 14-18 sets
   - Back: 12-16 sets
   - Shoulders (total): 12-15 sets
     * Front delts: covered by pressing (4-6 sets)
     * Side delts (LATERAL): 6-9 sets (REQUIRED - must include lateral raises!)
     * Rear delts: 4-6 sets (REQUIRED)
   - Triceps: 9-12 sets
   - Biceps: 8-10 sets

2. Rep Ranges: ${userProfile.primaryGoal === 'strength' ? 'Compounds: 4-6 reps, Accessories: 6-10 reps' : 'Compounds: 6-8 reps, Accessories: 8-12 reps, Lateral raises: 10-15 reps'}

3. Exercise Selection (STRICT REQUIREMENTS):

   PUSH DAY (6 exercises):
   a) Chest compound press (barbell or dumbbell) - 4 sets × 6-8 reps
   b) Chest incline or upper chest variation - 3 sets × 8-10 reps
   c) Chest isolation (fly, cable, etc.) - 3 sets × 10-12 reps
   d) Shoulder overhead press (barbell or dumbbell) - 3-4 sets × 6-8 reps
   e) LATERAL RAISE (cable, dumbbell, or machine) - 3 sets × 10-15 reps ⚠️ MANDATORY
   f) Triceps exercise - 3 sets × 8-12 reps

   PULL DAY (6 exercises):
   a) Horizontal pull (barbell row, dumbbell row, etc.) - 4 sets × 6-8 reps
   b) Vertical pull (pull-up, lat pulldown, etc.) - 3-4 sets × 6-10 reps
   c) Back accessory (row variation, pullover, etc.) - 3 sets × 8-12 reps
   d) Traps/upper back (shrug, face pull, etc.) - 3 sets × 8-12 reps
   e) Biceps compound (barbell curl, etc.) - 3 sets × 8-10 reps
   f) REAR DELT (rear delt fly, face pull, etc.) - 3 sets × 10-15 reps ⚠️ MANDATORY

   UPPER2 DAY (6 exercises - balanced mix):
   a) Shoulder press variation (different from Push day) - 3 sets × 8-12 reps
   b) Chest compound (dumbbell, machine, or bodyweight) - 3 sets × 8-12 reps
   c) Back compound (row or pull variation) - 3 sets × 8-12 reps
   d) LATERAL RAISE variation (different from Push) - 3 sets × 12-15 reps ⚠️ MANDATORY
   e) Biceps exercise - 3 sets × 10-12 reps
   f) Triceps exercise - 3 sets × 10-12 reps

4. Progression: Double progression (increase reps within range first, then add weight)

${userProfile.injuries && userProfile.injuries.length > 0 ? `
SAFETY CONSIDERATIONS:
${userProfile.injuries.map((i) => `- ${i.bodyPart}: ${i.restrictions?.join(', ') || 'Modify as needed'}`).join('\n')}
` : ''}

TASK:
Design the complete 3-day program by selecting exercises from the available database. For each exercise, return ONLY the exercise ID (not the full name).

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
  ],
  "overallRationale": "Brief explanation of program design philosophy",
  "progressionScheme": "How to progress week to week"
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- Use actual exercise IDs from the database
- Each day MUST have exactly 6 exercises (following the structure above)
- Order exercises from most taxing to least (compounds first)
- Balance push/pull volume across the week
- MANDATORY: Include lateral raises on Push (exercise e) and Upper2 (exercise d) days
- MANDATORY: Include rear delt work on Pull day (exercise f)`;

  try {
    console.log('[AI] Sending request to Gemini API...');
    const aiResponse = await callGeminiAPI(prompt);
    console.log('[AI] Received response from Gemini API');
    console.log('[AI] Raw AI response (first 500 chars):', aiResponse.substring(0, 500));

    // Parse JSON response
    // Remove markdown code blocks if present
    let jsonString = aiResponse.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    console.log('[AI] Parsing JSON response...');
    const programData = JSON.parse(jsonString);
    console.log('[AI] Parsed program data:', {
      hasPush: !!programData.Push,
      hasPull: !!programData.Pull,
      hasUpper2: !!programData.Upper2,
      pushCount: programData.Push?.length,
      pullCount: programData.Pull?.length,
      upper2Count: programData.Upper2?.length,
    });

    // Build WorkoutPlan object
    const pushDayPlan: DayPlan = {
      dayType: 'Push',
      exercises: programData.Push.map((ex: any, index: number) => ({
        exerciseId: ex.exerciseId,
        order: index,
        targetSets: ex.targetSets,
        repRangeMin: ex.repRangeMin,
        repRangeMax: ex.repRangeMax,
        notes: ex.rationale,
      })),
    };

    const pullDayPlan: DayPlan = {
      dayType: 'Pull',
      exercises: programData.Pull.map((ex: any, index: number) => ({
        exerciseId: ex.exerciseId,
        order: index,
        targetSets: ex.targetSets,
        repRangeMin: ex.repRangeMin,
        repRangeMax: ex.repRangeMax,
        notes: ex.rationale,
      })),
    };

    const upper2DayPlan: DayPlan = {
      dayType: 'Upper2',
      exercises: programData.Upper2.map((ex: any, index: number) => ({
        exerciseId: ex.exerciseId,
        order: index,
        targetSets: ex.targetSets,
        repRangeMin: ex.repRangeMin,
        repRangeMax: ex.repRangeMax,
        notes: ex.rationale,
      })),
    };

    const workoutPlan: WorkoutPlan = {
      id: `ai-generated-${Date.now()}`,
      name: `AI Generated Program - ${userProfile.primaryGoal || 'Hypertrophy'}`,
      plans: {
        Push: pushDayPlan,
        Pull: pullDayPlan,
        Upper2: upper2DayPlan,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[AI] Built final WorkoutPlan object:', {
      id: workoutPlan.id,
      name: workoutPlan.name,
      pushExercises: workoutPlan.plans.Push.exercises.length,
      pullExercises: workoutPlan.plans.Pull.exercises.length,
      upper2Exercises: workoutPlan.plans.Upper2.exercises.length,
    });

    return workoutPlan;
  } catch (error) {
    console.error('Error generating workout program:', error);
    throw new Error('Failed to generate workout program. Please try again.');
  }
}
