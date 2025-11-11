/**
 * Session Runner Screen
 * For gym days (Push, Pull, Upper2) - log sets with weight and reps
 * Grid/list view with exercise selection
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, getDayTypeDisplayName } from '../theme';
import { useModal } from '../contexts/ModalContext';
import {
  GymSession,
  WorkoutPlan,
  Exercise,
} from '../models/types';
import {
  loadWorkoutPlan,
  saveGymSession,
  loadExerciseCatalog,
  loadGymSessions,
} from '../services/storage';
import { analyzeSession } from '../services/geminiAI';
import { analyzeSessionAndUpdateRecommendations } from '../services/aiProgression';
import { getBestSet } from '../services/progression';
import { getStretchExercises } from '../services/exerciseDB';
import StretchRoutineModal from '../components/StretchRoutineModal';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionRunner'>;

export default function SessionRunnerScreen({ route, navigation }: Props) {
  const { dayType, date } = route.params;
  const { showModal, showError } = useModal();

  const [session, setSession] = useState<GymSession | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [stretchExercises, setStretchExercises] = useState<Exercise[]>([]);
  const [showStretchModal, setShowStretchModal] = useState(false);
  const [finishedSessionData, setFinishedSessionData] = useState<GymSession | null>(null);
  const [sessionQuality, setSessionQuality] = useState('Session Complete');
  const [autoAdjustmentMessage, setAutoAdjustmentMessage] = useState('');
  const [autoAdjustmentCount, setAutoAdjustmentCount] = useState(0);

  useEffect(() => {
    initializeSession();
  }, []);

  // Refresh session when screen comes back into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reload session data when returning from ExerciseDetail
      initializeSession();
    });

    return unsubscribe;
  }, [navigation]);

  const initializeSession = async () => {
    try {
      // Load workout plan
      const workoutPlan = await loadWorkoutPlan();
      if (!workoutPlan) return;
      setPlan(workoutPlan);

      // Load exercise catalog
      const catalog = await loadExerciseCatalog();
      if (!catalog) return;

      // Get exercises for this day
      const dayPlan = workoutPlan.plans[dayType];
      const dayExercises = dayPlan.exercises
        .sort((a, b) => a.order - b.order)
        .map((pe) => catalog.exercises.find((ex) => ex.id === pe.exerciseId))
        .filter(Boolean) as Exercise[];

      setExercises(dayExercises);

      // Load stretch exercises for post-workout
      const stretches = getStretchExercises(catalog.exercises, dayType);
      setStretchExercises(stretches);

      // Load existing sessions
      const existingSessions = await loadGymSessions();

      // Try to find existing session for this day
      const existingSession = existingSessions.find(
        (s) => s.dayType === dayType && s.date === date && !s.completed
      );

      if (existingSession) {
        // Use existing session
        setSession(existingSession);
      } else {
        // Create new session
        const newSession: GymSession = {
          id: `${dayType}-${date}-${Date.now()}`,
          dayType,
          date,
          startTime: new Date().toISOString(),
          exercises: dayPlan.exercises.map((pe) => ({
            exerciseId: pe.exerciseId,
            sets: [],
          })),
          completed: false,
        };

        await saveGymSession(newSession);
        setSession(newSession);
      }
    } catch (error) {
      console.error('Error initializing session:', error);
    }
  };

  const handleExercisePress = (exercise: Exercise) => {
    if (!session || !plan) return;

    const plannedExercise = plan.plans[dayType].exercises.find(
      (pe) => pe.exerciseId === exercise.id
    );

    if (plannedExercise) {
      navigation.navigate('ExerciseDetail', {
        exercise,
        session,
        plannedExercise,
      });
    }
  };

  const showAIAnalysisOption = (
    finishedSession: GymSession,
    sessionQuality: string,
    autoAdjustmentMessage: string,
    adjustmentCount: number
  ) => {
    const mainMessage = adjustmentCount > 0
      ? `${autoAdjustmentMessage}\n\nWould you like detailed AI analysis of your workout?`
      : 'Would you like detailed AI analysis of your workout?';

    showModal({
      type: 'success',
      title: sessionQuality,
      message: mainMessage,
      buttons: [
        {
          text: 'Get AI Analysis',
          style: 'primary',
          onPress: async () => {
            try {
              showModal({
                type: 'info',
                title: 'AI Analysis',
                message: 'Analyzing your workout...',
                dismissable: false,
              });
              const analysis = await analyzeSession(finishedSession);
              showModal({
                type: 'success',
                title: 'AI Coach Feedback',
                message: analysis,
                buttons: [
                  { text: 'Done', onPress: () => navigation.goBack(), style: 'primary' },
                ],
              });
            } catch (error) {
              showError(
                'Error',
                'Unable to generate AI analysis. Please check the Progress tab for weekly insights.'
              );
              setTimeout(() => navigation.goBack(), 1500);
            }
          },
        },
        {
          text: 'Done',
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
      ],
    });
  };

  const handleFinishSession = async () => {
    if (!session) return;

    // Calculate bestSet for each exercise
    const exercisesWithBestSet = session.exercises.map(exerciseLog => ({
      ...exerciseLog,
      bestSet: getBestSet(exerciseLog.sets),
    }));

    const finishedSession = {
      ...session,
      exercises: exercisesWithBestSet,
      endTime: new Date().toISOString(),
      completed: true,
      duration: Math.floor(
        (new Date().getTime() - new Date(session.startTime).getTime()) / 1000
      ),
    };

    await saveGymSession(finishedSession);

    // Run autonomous AI analysis in background
    try {
      const insights = await analyzeSessionAndUpdateRecommendations(finishedSession);

      // Build enhanced auto-adjustment message
      let autoAdjustmentMessage = '';
      const autoAdjustments = insights.filter(i => i.type === 'auto_adjustment');

      if (autoAdjustments.length > 0) {
        // Categorize adjustments
        const increases = autoAdjustments.filter(a => a.message.includes('💪'));
        const deloads = autoAdjustments.filter(a => a.message.includes('🔄'));
        const reductions = autoAdjustments.filter(a => a.message.includes('⚠️'));

        // Build detailed message
        autoAdjustmentMessage = '\n\n━━━━━━━━━━━━━━━━━━━━━\n';
        autoAdjustmentMessage += `🤖 AI Auto-Adjustments (${autoAdjustments.length})\n`;
        autoAdjustmentMessage += '━━━━━━━━━━━━━━━━━━━━━\n\n';

        if (increases.length > 0) {
          autoAdjustmentMessage += `💪 Weight Increases (${increases.length}):\n`;
          increases.forEach(i => {
            const shortMsg = i.message.replace(/💪\s+/, '').replace(/_/g, ' ');
            autoAdjustmentMessage += `   • ${shortMsg}\n`;
          });
          autoAdjustmentMessage += '\n';
        }

        if (deloads.length > 0) {
          autoAdjustmentMessage += `🔄 Deload Weeks (${deloads.length}):\n`;
          deloads.forEach(i => {
            const shortMsg = i.message.replace(/🔄\s+/, '').replace(/_/g, ' ');
            autoAdjustmentMessage += `   • ${shortMsg}\n`;
          });
          autoAdjustmentMessage += '\n';
        }

        if (reductions.length > 0) {
          autoAdjustmentMessage += `⚠️ Weight Reductions (${reductions.length}):\n`;
          reductions.forEach(i => {
            const shortMsg = i.message.replace(/⚠️\s+/, '').replace(/_/g, ' ');
            autoAdjustmentMessage += `   • ${shortMsg}\n`;
          });
          autoAdjustmentMessage += '\n';
        }

        autoAdjustmentMessage += '━━━━━━━━━━━━━━━━━━━━━';
      }

      // Determine session quality for title
      const increases = autoAdjustments.filter(a => a.message.includes('💪'));
      const quality = increases.length > 0
        ? `🎉 Great Session!`
        : 'Session Complete';

      // Build main message
      const mainMessage = autoAdjustments.length > 0
        ? `Great work today! AI has automatically adjusted ${autoAdjustments.length} exercise${autoAdjustments.length > 1 ? 's' : ''} for your next workout.${autoAdjustmentMessage}\n\nWould you like detailed AI analysis?`
        : 'Great work today! Your workout has been saved.\n\nWould you like detailed AI analysis?';

      // Store finished session data and auto-adjustments for later
      setFinishedSessionData(finishedSession);
      setSessionQuality(quality);
      setAutoAdjustmentMessage(autoAdjustmentMessage);
      setAutoAdjustmentCount(autoAdjustments.length);

      // Show stretching prompt
      if (stretchExercises.length > 0) {
        showModal({
          type: 'success',
          title: quality,
          message: `Great work today! ${autoAdjustments.length > 0 ? `AI adjusted ${autoAdjustments.length} exercise${autoAdjustments.length > 1 ? 's' : ''} for next time.\n\n` : '\n'}Stretching is recommended after each workout to reduce soreness and improve flexibility.\n\nWould you like to stretch now?`,
          buttons: [
            {
              text: `Start Stretching (${Math.ceil(stretchExercises.length * 30 / 60)} min)`,
              style: 'primary',
              onPress: () => {
                setShowStretchModal(true);
              },
            },
            {
              text: 'Skip Stretching',
              style: 'cancel',
              onPress: () => {
                // Skip to AI analysis option
                showAIAnalysisOption(finishedSession, quality, autoAdjustmentMessage, autoAdjustments.length);
              },
            },
          ],
        });
      } else {
        // No stretches available, go directly to AI analysis
        showAIAnalysisOption(finishedSession, quality, autoAdjustmentMessage, autoAdjustments.length);
      }
    } catch (error) {
      console.error('Error running autonomous AI analysis:', error);

      // Store finished session for later use
      setFinishedSessionData(finishedSession);

      // Fall back to simple stretching prompt
      if (stretchExercises.length > 0) {
        showModal({
          type: 'success',
          title: 'Session Complete',
          message: 'Great work today!\n\nStretching is recommended after each workout. Would you like to stretch now?',
          buttons: [
            {
              text: `Start Stretching (${Math.ceil(stretchExercises.length * 30 / 60)} min)`,
              style: 'primary',
              onPress: () => {
                setShowStretchModal(true);
              },
            },
            {
              text: 'Skip for Now',
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
          ],
        });
      } else {
        // No stretches, just show completion
        showModal({
          type: 'success',
          title: 'Session Complete',
          message: 'Great work today!',
          buttons: [
            {
              text: 'Done',
              style: 'primary',
              onPress: () => navigation.goBack(),
            },
          ],
        });
      }
    }
  };

  const isExerciseCompleted = (exercise: Exercise): boolean => {
    if (!session || !plan) return false;

    const plannedExercise = plan.plans[dayType].exercises.find(
      (pe) => pe.exerciseId === exercise.id
    );
    const exerciseLog = session.exercises.find((ex) => ex.exerciseId === exercise.id);

    if (!plannedExercise || !exerciseLog) return false;

    return exerciseLog.sets.length >= plannedExercise.targetSets;
  };

  const getCompletedSetsCount = (exercise: Exercise): number => {
    if (!session) return 0;
    const exerciseLog = session.exercises.find((ex) => ex.exerciseId === exercise.id);
    return exerciseLog?.sets.length || 0;
  };

  const getTargetSetsCount = (exercise: Exercise): number => {
    if (!plan) return 0;
    const plannedExercise = plan.plans[dayType].exercises.find(
      (pe) => pe.exerciseId === exercise.id
    );
    return plannedExercise?.targetSets || 0;
  };

  const handleStretchComplete = () => {
    setShowStretchModal(false);

    // Show AI analysis option after stretching
    if (finishedSessionData) {
      // Get auto-adjustments for message (we'll need to recalculate or store them)
      showModal({
        type: 'success',
        title: 'Nice work!',
        message: 'Stretching complete! Would you like detailed AI analysis of your workout?',
        buttons: [
          {
            text: 'Get AI Analysis',
            style: 'primary',
            onPress: async () => {
              try {
                showModal({
                  type: 'info',
                  title: 'AI Analysis',
                  message: 'Analyzing your workout...',
                  dismissable: false,
                });
                const analysis = await analyzeSession(finishedSessionData);
                showModal({
                  type: 'success',
                  title: 'AI Coach Feedback',
                  message: analysis,
                  buttons: [
                    { text: 'Done', onPress: () => navigation.goBack(), style: 'primary' },
                  ],
                });
              } catch (error) {
                showError(
                  'Error',
                  'Unable to generate AI analysis. Please check the Progress tab for weekly insights.'
                );
                setTimeout(() => navigation.goBack(), 1500);
              }
            },
          },
          {
            text: 'Done',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ],
      });
    } else {
      navigation.goBack();
    }
  };

  const handleStretchSkip = () => {
    setShowStretchModal(false);

    // Show AI analysis option when user skips stretching from within the modal
    if (finishedSessionData) {
      showAIAnalysisOption(
        finishedSessionData,
        sessionQuality,
        autoAdjustmentMessage,
        autoAdjustmentCount
      );
    } else {
      navigation.goBack();
    }
  };

  if (!session || exercises.length === 0) {
    return (
      <View style={styles.container}>
        <Text>Loading session...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{getDayTypeDisplayName(dayType)} Day</Text>
        <TouchableOpacity
          style={styles.finishButton}
          onPress={handleFinishSession}
        >
          <Text style={styles.finishButtonText}>Finish Session</Text>
        </TouchableOpacity>
      </View>

      {/* Exercise Grid */}
      <ScrollView style={styles.content} contentContainerStyle={styles.gridContainer}>
        {exercises.map((exercise) => {
          const completed = isExerciseCompleted(exercise);
          const completedSets = getCompletedSetsCount(exercise);
          const targetSets = getTargetSetsCount(exercise);

          return (
            <TouchableOpacity
              key={exercise.id}
              style={[
                styles.exerciseCard,
                completed && styles.exerciseCardCompleted,
              ]}
              onPress={() => handleExercisePress(exercise)}
              activeOpacity={0.7}
            >
              {exercise.imageUrl && (
                <Image
                  source={{ uri: exercise.imageUrl }}
                  style={styles.exerciseCardImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.exerciseCardContent}>
                <Text style={styles.exerciseCardName} numberOfLines={2}>
                  {exercise.name}
                </Text>
                <Text style={styles.exerciseCardTarget} numberOfLines={1}>
                  {exercise.target}
                </Text>
                <View style={styles.exerciseCardProgress}>
                  <Text style={styles.exerciseCardSets}>
                    {completedSets}/{targetSets} sets
                  </Text>
                  {completed && (
                    <Text style={styles.exerciseCardCheckmark}>✓</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stretch Routine Modal */}
      <StretchRoutineModal
        visible={showStretchModal}
        stretches={stretchExercises}
        onComplete={handleStretchComplete}
        onSkip={handleStretchSkip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  finishButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  finishButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  content: {
    flex: 1,
  },
  gridContainer: {
    padding: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  exerciseCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  exerciseCardCompleted: {
    borderColor: colors.success,
  },
  exerciseCardImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.gray100,
  },
  exerciseCardContent: {
    padding: spacing.md,
  },
  exerciseCardName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    minHeight: 40,
  },
  exerciseCardTarget: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: spacing.sm,
  },
  exerciseCardProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseCardSets: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  exerciseCardCheckmark: {
    fontSize: 20,
    color: colors.success,
    fontWeight: typography.fontWeight.bold,
  },
});
