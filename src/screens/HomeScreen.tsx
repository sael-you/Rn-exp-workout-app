/**
 * Home / Today Screen
 * Shows today's day type, habits, streaks, and Start button
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { format } from 'date-fns';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, getDayTypeColor } from '../theme';
import { DayType, WeeklyProgram, StreakData, HabitLog } from '../models/types';
import {
  loadWeeklyProgram,
  loadStreaks,
  loadHabits,
  saveWeeklyProgram,
  saveStreaks,
  saveHabits,
} from '../services/storage';
import { initializeExerciseCatalog } from '../services/exerciseDB';
import { generateDefaultPlan } from '../services/defaultPlan';
import { saveWorkoutPlan } from '../services/storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [todayType, setTodayType] = useState<DayType>('Rest');
  const [streaks, setStreaks] = useState<StreakData | null>(null);
  const [todayHabits, setTodayHabits] = useState<HabitLog | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize exercise catalog
      await initializeExerciseCatalog();

      // Load or create weekly program
      let program = await loadWeeklyProgram();
      if (!program) {
        program = createDefaultWeeklyProgram();
        await saveWeeklyProgram(program);
      }

      // Load or create workout plan
      const catalog = await initializeExerciseCatalog();
      const plan = generateDefaultPlan(catalog.exercises);
      await saveWorkoutPlan(plan);

      // Determine today's day type
      const today = new Date().getDay();
      const todayTraining = program.trainingDays.find(
        (d) => d.dayOfWeek === today && d.enabled
      );
      setTodayType(todayTraining?.dayType || 'Rest');

      // Load streaks
      let streakData = await loadStreaks();
      if (!streakData) {
        streakData = {
          training: { current: 0, longest: 0, lastUpdated: new Date().toISOString() },
          outdoor: { current: 0, longest: 0, lastUpdated: new Date().toISOString() },
          habits: { current: 0, longest: 0, lastUpdated: new Date().toISOString() },
        };
        await saveStreaks(streakData);
      }
      setStreaks(streakData);

      // Load today's habits
      const habits = await loadHabits();
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const todayLog = habits?.logs.find((log) => log.date === todayDate);
      setTodayHabits(todayLog || null);

      setLoading(false);
    } catch (error) {
      console.error('Error initializing app:', error);
      setLoading(false);
    }
  };

  const createDefaultWeeklyProgram = (): WeeklyProgram => {
    return {
      trainingDays: [
        { id: '1', dayOfWeek: 1, dayType: 'Push', enabled: true },
        { id: '2', dayOfWeek: 3, dayType: 'Pull', enabled: true },
        { id: '3', dayOfWeek: 5, dayType: 'Upper2', enabled: true },
        { id: '4', dayOfWeek: 0, dayType: 'Outdoor', enabled: true },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleStartSession = () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    if (todayType === 'Outdoor') {
      navigation.navigate('OutdoorTimer', { date: today });
    } else if (todayType !== 'Rest') {
      navigation.navigate('SessionRunner', {
        dayType: todayType as 'Push' | 'Pull' | 'Upper2',
        date: today,
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing your workout...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date Header */}
      <View style={styles.header}>
        <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>

      {/* Today's Day Type Card */}
      <View style={[styles.dayCard, { borderLeftColor: getDayTypeColor(todayType) }]}>
        <View style={styles.dayCardHeader}>
          <Text style={styles.dayCardLabel}>Today's Workout</Text>
          <View
            style={[styles.dayTypeBadge, { backgroundColor: getDayTypeColor(todayType) }]}
          >
            <Text style={styles.dayTypeBadgeText}>{todayType}</Text>
          </View>
        </View>

        {todayType === 'Rest' ? (
          <Text style={styles.restMessage}>
            Rest day. Focus on recovery and habits.
          </Text>
        ) : (
          <>
            <Text style={styles.dayCardDescription}>
              {getDayDescription(todayType)}
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartSession}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>Start Session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Streaks Section */}
      {streaks && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Streaks</Text>
          <View style={styles.streaksContainer}>
            <StreakChip
              label="Training"
              current={streaks.training.current}
              unit="weeks"
              color={colors.primary}
            />
            <StreakChip
              label="Outdoor"
              current={streaks.outdoor.current}
              unit="weeks"
              color={colors.dayOutdoor}
            />
            <StreakChip
              label="Habits"
              current={streaks.habits.current}
              unit="days"
              color={colors.success}
            />
          </View>
        </View>
      )}

      {/* Daily Habits Quick Check */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Habits</Text>
        <View style={styles.habitsCard}>
          <HabitCheckItem
            label="Sleep"
            completed={todayHabits?.sleep !== undefined}
            value={todayHabits?.sleep ? `${todayHabits.sleep}h` : undefined}
          />
          <HabitCheckItem
            label="Hydration"
            completed={todayHabits?.hydration !== undefined}
            value={todayHabits?.hydration ? `${todayHabits.hydration}L` : undefined}
          />
          <HabitCheckItem
            label="Stretching"
            completed={todayHabits?.stretching !== undefined}
            value={todayHabits?.stretching ? `${todayHabits.stretching}min` : undefined}
          />
          <HabitCheckItem
            label="Creatine"
            completed={todayHabits?.creatine === true}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function getDayDescription(dayType: DayType): string {
  switch (dayType) {
    case 'Push':
      return 'Chest, shoulders, and triceps';
    case 'Pull':
      return 'Back and biceps';
    case 'Upper2':
      return 'Full upper body mix';
    case 'Outdoor':
      return 'Legs, core, and cardio';
    default:
      return '';
  }
}

function StreakChip({
  label,
  current,
  unit,
  color,
}: {
  label: string;
  current: number;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.streakChip}>
      <Text style={styles.streakLabel}>{label}</Text>
      <Text style={[styles.streakValue, { color }]}>
        {current} {unit}
      </Text>
    </View>
  );
}

function HabitCheckItem({
  label,
  completed,
  value,
}: {
  label: string;
  completed: boolean;
  value?: string;
}) {
  return (
    <View style={styles.habitItem}>
      <View
        style={[
          styles.habitCheckbox,
          completed && styles.habitCheckboxCompleted,
        ]}
      >
        {completed && <Text style={styles.habitCheckmark}>✓</Text>}
      </View>
      <Text style={styles.habitLabel}>{label}</Text>
      {value && <Text style={styles.habitValue}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  header: {
    marginBottom: spacing.lg,
  },
  dateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderLeftWidth: 4,
    marginBottom: spacing.lg,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dayCardLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: typography.fontWeight.semibold,
  },
  dayTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  dayTypeBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  dayCardDescription: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  restMessage: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  startButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  streaksContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  streakChip: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  streakLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  streakValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  habitsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  habitCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray300,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  habitCheckboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  habitCheckmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
  },
  habitLabel: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  habitValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});
