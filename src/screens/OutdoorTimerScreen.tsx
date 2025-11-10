/**
 * Outdoor Timer Screen
 * For outdoor legs/core day with intervals and optional GPS
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import {
  OutdoorSession,
  OutdoorInterval,
  CoreExercise,
} from '../models/types';
import { saveOutdoorSession } from '../services/storage';
import * as Haptics from 'expo-haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'OutdoorTimer'>;

const DEFAULT_WORK_DURATION = 45; // seconds
const DEFAULT_REST_DURATION = 15; // seconds
const DEFAULT_ROUNDS = 5;

const CORE_EXERCISES: CoreExercise[] = [
  { name: 'Plank', completed: false, duration: 60 },
  { name: 'Leg Raises', completed: false, reps: 15 },
  { name: 'Bicycle Crunches', completed: false, reps: 20 },
  { name: 'Mountain Climbers', completed: false, reps: 30 },
  { name: 'Russian Twists', completed: false, reps: 30 },
];

export default function OutdoorTimerScreen({ route, navigation }: Props) {
  const { date } = route.params;

  const [session, setSession] = useState<OutdoorSession | null>(null);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'work' | 'rest'>('idle');
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(DEFAULT_ROUNDS);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [coreExercises, setCoreExercises] = useState<CoreExercise[]>(CORE_EXERCISES);

  useEffect(() => {
    // Initialize session
    const newSession: OutdoorSession = {
      id: `outdoor-${date}-${Date.now()}`,
      date,
      startTime: new Date().toISOString(),
      intervals: [],
      coreCircuit: CORE_EXERCISES,
      gpsEnabled: false,
      completed: false,
    };
    setSession(newSession);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentPhase !== 'idle' && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handlePhaseComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentPhase, timeRemaining]);

  const handleStartIntervals = () => {
    setCurrentRound(1);
    setCurrentPhase('work');
    setTimeRemaining(DEFAULT_WORK_DURATION);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePhaseComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (currentPhase === 'work') {
      // Work phase done, start rest
      setCurrentPhase('rest');
      setTimeRemaining(DEFAULT_REST_DURATION);

      // Log completed interval
      if (session) {
        const newInterval: OutdoorInterval = {
          roundNumber: currentRound,
          workDuration: DEFAULT_WORK_DURATION,
          restDuration: DEFAULT_REST_DURATION,
          completed: true,
        };
        const updatedSession = {
          ...session,
          intervals: [...session.intervals, newInterval],
        };
        setSession(updatedSession);
        saveOutdoorSession(updatedSession);
      }
    } else if (currentPhase === 'rest') {
      // Rest phase done
      if (currentRound < totalRounds) {
        // Start next round
        setCurrentRound(currentRound + 1);
        setCurrentPhase('work');
        setTimeRemaining(DEFAULT_WORK_DURATION);
      } else {
        // All rounds complete
        setCurrentPhase('idle');
        Alert.alert('Intervals Complete', 'Great work! Now complete the core circuit.');
      }
    }
  };

  const handlePauseResume = () => {
    if (currentPhase === 'idle') {
      handleStartIntervals();
    } else {
      setCurrentPhase('idle');
    }
  };

  const handleAdjustRounds = (delta: number) => {
    setTotalRounds(Math.max(1, totalRounds + delta));
  };

  const toggleCoreExercise = (index: number) => {
    const updated = [...coreExercises];
    updated[index].completed = !updated[index].completed;
    setCoreExercises(updated);

    if (session) {
      const updatedSession = {
        ...session,
        coreCircuit: updated,
      };
      setSession(updatedSession);
      saveOutdoorSession(updatedSession);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFinishSession = async () => {
    if (!session) return;

    const finishedSession = {
      ...session,
      endTime: new Date().toISOString(),
      completed: true,
      coreCircuit: coreExercises,
      duration: Math.floor(
        (new Date().getTime() - new Date(session.startTime).getTime()) / 1000
      ),
    };

    await saveOutdoorSession(finishedSession);

    Alert.alert('Outdoor Session Complete', 'Excellent work today!', [
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
  };

  const completedCoreCount = coreExercises.filter((ex) => ex.completed).length;
  const allCoreComplete = completedCoreCount === coreExercises.length;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Interval Timer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interval Training</Text>

          {/* Rounds Selector */}
          <View style={styles.roundsSelector}>
            <TouchableOpacity
              style={styles.roundsButton}
              onPress={() => handleAdjustRounds(-1)}
              disabled={currentPhase !== 'idle'}
            >
              <Text style={styles.roundsButtonText}>−</Text>
            </TouchableOpacity>
            <View style={styles.roundsDisplay}>
              <Text style={styles.roundsValue}>{totalRounds}</Text>
              <Text style={styles.roundsLabel}>rounds</Text>
            </View>
            <TouchableOpacity
              style={styles.roundsButton}
              onPress={() => handleAdjustRounds(1)}
              disabled={currentPhase !== 'idle'}
            >
              <Text style={styles.roundsButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Timer Display */}
          <View
            style={[
              styles.timerDisplay,
              currentPhase === 'work' && styles.timerWork,
              currentPhase === 'rest' && styles.timerRest,
            ]}
          >
            {currentPhase !== 'idle' && (
              <>
                <Text style={styles.timerPhase}>
                  {currentPhase === 'work' ? 'WORK' : 'REST'}
                </Text>
                <Text style={styles.timerRound}>
                  Round {currentRound} / {totalRounds}
                </Text>
              </>
            )}
            <Text style={styles.timerValue}>
              {currentPhase === 'idle'
                ? 'Ready'
                : `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60)
                    .toString()
                    .padStart(2, '0')}`}
            </Text>
            <TouchableOpacity
              style={[
                styles.timerButton,
                currentPhase !== 'idle' && styles.timerButtonActive,
              ]}
              onPress={handlePauseResume}
            >
              <Text style={styles.timerButtonText}>
                {currentPhase === 'idle' ? 'Start' : 'Pause'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Intervals Progress */}
          {session && session.intervals.length > 0 && (
            <View style={styles.intervalsProgress}>
              <Text style={styles.intervalsLabel}>
                Completed: {session.intervals.length} / {totalRounds} rounds
              </Text>
            </View>
          )}
        </View>

        {/* Core Circuit Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Core Circuit</Text>
            <Text style={styles.coreProgress}>
              {completedCoreCount} / {coreExercises.length}
            </Text>
          </View>

          <View style={styles.coreList}>
            {coreExercises.map((exercise, index) => (
              <TouchableOpacity
                key={index}
                style={styles.coreItem}
                onPress={() => toggleCoreExercise(index)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.coreCheckbox,
                    exercise.completed && styles.coreCheckboxCompleted,
                  ]}
                >
                  {exercise.completed && <Text style={styles.coreCheckmark}>✓</Text>}
                </View>
                <View style={styles.coreInfo}>
                  <Text style={styles.coreName}>{exercise.name}</Text>
                  <Text style={styles.coreTarget}>
                    {exercise.duration
                      ? `${exercise.duration}s hold`
                      : `${exercise.reps} reps`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Finish Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.finishButton,
            !allCoreComplete && styles.finishButtonDisabled,
          ]}
          onPress={handleFinishSession}
          disabled={!allCoreComplete}
        >
          <Text style={styles.finishButtonText}>Finish Session</Text>
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
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  roundsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },
  roundsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundsButtonText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  roundsDisplay: {
    alignItems: 'center',
  },
  roundsValue: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  roundsLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  timerDisplay: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.gray300,
  },
  timerWork: {
    borderColor: colors.dayOutdoor,
    backgroundColor: '#F0FDF4',
  },
  timerRest: {
    borderColor: colors.warning,
    backgroundColor: '#FEF3C7',
  },
  timerPhase: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timerRound: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  timerValue: {
    fontSize: typography.fontSize['5xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  timerButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  timerButtonActive: {
    backgroundColor: colors.error,
  },
  timerButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  intervalsProgress: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  intervalsLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  coreProgress: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  coreList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  coreCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.gray300,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coreCheckboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  coreCheckmark: {
    color: colors.white,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
  },
  coreInfo: {
    flex: 1,
  },
  coreName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  coreTarget: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  finishButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  finishButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  finishButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
});
