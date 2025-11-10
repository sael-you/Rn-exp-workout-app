/**
 * Session Runner Screen
 * For gym days (Push, Pull, Upper2) - log sets with weight and reps
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import {
  GymSession,
  ExerciseLog,
  SetLog,
  WorkoutPlan,
  Exercise,
  PlannedExercise,
} from '../models/types';
import {
  loadWorkoutPlan,
  saveGymSession,
  loadGymSessions,
  loadExerciseCatalog,
} from '../services/storage';
import { getBestSet } from '../services/progression';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionRunner'>;

export default function SessionRunnerScreen({ route, navigation }: Props) {
  const { dayType, date } = route.params;

  const [session, setSession] = useState<GymSession | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);

  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            // Haptic feedback would go here
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

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

      // Create or load session
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

      setSession(newSession);
    } catch (error) {
      console.error('Error initializing session:', error);
    }
  };

  const handleLogSet = async () => {
    if (!session || !weight || !reps) {
      Alert.alert('Missing Data', 'Please enter both weight and reps');
      return;
    }

    const currentExercise = exercises[currentExerciseIndex];
    const newSet: SetLog = {
      id: `${Date.now()}`,
      weight: parseFloat(weight),
      reps: parseInt(reps, 10),
      timestamp: new Date().toISOString(),
    };

    // Update session with new set
    const updatedSession = { ...session };
    const exerciseLog = updatedSession.exercises.find(
      (ex) => ex.exerciseId === currentExercise.id
    );

    if (exerciseLog) {
      exerciseLog.sets.push(newSet);
      exerciseLog.bestSet = getBestSet(exerciseLog.sets);
    }

    setSession(updatedSession);
    await saveGymSession(updatedSession);

    // Clear inputs and start rest timer
    setWeight('');
    setReps('');
    setRestTimer(90); // 90 seconds default
    setIsResting(true);
  };

  const handleNextExercise = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setIsResting(false);
      setRestTimer(0);
    } else {
      handleFinishSession();
    }
  };

  const handlePreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(currentExerciseIndex - 1);
    }
  };

  const handleFinishSession = async () => {
    if (!session) return;

    const finishedSession = {
      ...session,
      endTime: new Date().toISOString(),
      completed: true,
      duration: Math.floor(
        (new Date().getTime() - new Date(session.startTime).getTime()) / 1000
      ),
    };

    await saveGymSession(finishedSession);

    Alert.alert('Session Complete', 'Great work today!', [
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
  };

  if (!session || exercises.length === 0) {
    return (
      <View style={styles.container}>
        <Text>Loading session...</Text>
      </View>
    );
  }

  const currentExercise = exercises[currentExerciseIndex];
  const currentLog = session.exercises.find(
    (ex) => ex.exerciseId === currentExercise.id
  );
  const plannedExercise = plan?.plans[dayType].exercises.find(
    (pe) => pe.exerciseId === currentExercise.id
  );

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${((currentExerciseIndex + 1) / exercises.length) * 100}%`,
            },
          ]}
        />
      </View>

      <ScrollView style={styles.content}>
        {/* Exercise Info */}
        <View style={styles.exerciseHeader}>
          <Text style={styles.exerciseNumber}>
            Exercise {currentExerciseIndex + 1} of {exercises.length}
          </Text>
          <Text style={styles.exerciseName}>{currentExercise.name}</Text>
          <Text style={styles.exerciseTarget}>
            Target: {currentExercise.target} • {currentExercise.equipment}
          </Text>
          {plannedExercise && (
            <Text style={styles.repRange}>
              {plannedExercise.targetSets} sets × {plannedExercise.repRangeMin}-
              {plannedExercise.repRangeMax} reps
            </Text>
          )}
        </View>

        {/* Previous Sets */}
        {currentLog && currentLog.sets.length > 0 && (
          <View style={styles.setsContainer}>
            <Text style={styles.setsTitle}>Completed Sets</Text>
            {currentLog.sets.map((set, index) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={styles.setNumber}>Set {index + 1}</Text>
                <Text style={styles.setText}>
                  {set.weight}kg × {set.reps} reps
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Log New Set */}
        <View style={styles.logSection}>
          <Text style={styles.logTitle}>Log Set</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.gray400}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reps</Text>
              <TextInput
                style={styles.input}
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.gray400}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.logButton}
            onPress={handleLogSet}
            disabled={!weight || !reps}
          >
            <Text style={styles.logButtonText}>Log Set</Text>
          </TouchableOpacity>
        </View>

        {/* Rest Timer */}
        {isResting && (
          <View style={styles.restTimer}>
            <Text style={styles.restTimerLabel}>Rest</Text>
            <Text style={styles.restTimerValue}>
              {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonSecondary]}
          onPress={handlePreviousExercise}
          disabled={currentExerciseIndex === 0}
        >
          <Text style={styles.navButtonSecondaryText}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonPrimary]}
          onPress={handleNextExercise}
        >
          <Text style={styles.navButtonPrimaryText}>
            {currentExerciseIndex === exercises.length - 1 ? 'Finish' : 'Next Exercise'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray200,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  exerciseHeader: {
    marginBottom: spacing.lg,
  },
  exerciseNumber: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  exerciseName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  exerciseTarget: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  repRange: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  setsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  setsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  setNumber: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  setText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  logSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  logTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  logButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  logButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  restTimer: {
    backgroundColor: colors.success,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  restTimerLabel: {
    fontSize: typography.fontSize.base,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  restTimerValue: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  navButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  navButtonPrimary: {
    backgroundColor: colors.primary,
  },
  navButtonSecondary: {
    backgroundColor: colors.gray200,
  },
  navButtonPrimaryText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  navButtonSecondaryText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
});
