/**
 * Progress & Insights Screen
 * Shows weekly summary, trends, PRs, and adherence
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { colors, spacing, typography } from '../theme';
import {
  loadGymSessions,
  loadOutdoorSessions,
  loadHabits,
  loadExerciseCatalog,
} from '../services/storage';
import { GymSession, OutdoorSession, HabitsData, WeeklySummary } from '../models/types';

export default function ProgressScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      const [gymSessions, outdoorSessions, habits, catalog] = await Promise.all([
        loadGymSessions(),
        loadOutdoorSessions(),
        loadHabits(),
        loadExerciseCatalog(),
      ]);

      // Calculate this week's summary
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      const thisWeekGym = gymSessions.filter((s) => {
        const sessionDate = new Date(s.date);
        return sessionDate >= weekStart && sessionDate <= weekEnd;
      });

      const thisWeekOutdoor = outdoorSessions.filter((s) => {
        const sessionDate = new Date(s.date);
        return sessionDate >= weekStart && sessionDate <= weekEnd;
      });

      const sessionsCompleted = thisWeekGym.filter((s) => s.completed).length;
      const sessionsPlanned = 3; // Push, Pull, Upper2

      // Calculate total volume
      let totalVolume = 0;
      const volumeByMuscle: Record<string, number> = {};

      for (const session of thisWeekGym) {
        for (const exerciseLog of session.exercises) {
          const exercise = catalog?.exercises.find((ex) => ex.id === exerciseLog.exerciseId);
          if (!exercise) continue;

          for (const set of exerciseLog.sets) {
            const volume = set.weight * set.reps;
            totalVolume += volume;

            // Track by muscle
            const muscle = exercise.bodyPart;
            volumeByMuscle[muscle] = (volumeByMuscle[muscle] || 0) + volume;
          }
        }
      }

      // Calculate habits completion
      const thisWeekHabits = habits?.logs.filter((log) => {
        const logDate = new Date(log.date);
        return logDate >= weekStart && logDate <= weekEnd;
      }) || [];

      const habitsCompletion = thisWeekHabits.length > 0
        ? (thisWeekHabits.filter((log) => {
            const count = [
              log.sleep !== undefined,
              log.hydration !== undefined,
              log.stretching !== undefined,
              log.creatine !== undefined,
            ].filter(Boolean).length;
            return count >= 3;
          }).length / thisWeekHabits.length) * 100
        : 0;

      const summary: WeeklySummary = {
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekEnd, 'yyyy-MM-dd'),
        sessionsCompleted,
        sessionsPlanned,
        adherence: (sessionsCompleted / sessionsPlanned) * 100,
        outdoorCompleted: thisWeekOutdoor.some((s) => s.completed),
        totalVolume,
        volumeByMuscle,
        prs: [],
        habitsCompletion,
      };

      setWeeklySummary(summary);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading progress:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProgressData();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading progress...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Weekly Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>This Week</Text>
        {weeklySummary && (
          <>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Sessions</Text>
              <Text style={styles.statValue}>
                {weeklySummary.sessionsCompleted} / {weeklySummary.sessionsPlanned}
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Adherence</Text>
              <Text style={[styles.statValue, { color: getAdherenceColor(weeklySummary.adherence) }]}>
                {Math.round(weeklySummary.adherence)}%
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Outdoor Day</Text>
              <Text style={styles.statValue}>
                {weeklySummary.outdoorCompleted ? '✓ Complete' : '○ Pending'}
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Volume</Text>
              <Text style={styles.statValue}>
                {Math.round(weeklySummary.totalVolume).toLocaleString()}kg
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Habits</Text>
              <Text style={[styles.statValue, { color: getAdherenceColor(weeklySummary.habitsCompletion) }]}>
                {Math.round(weeklySummary.habitsCompletion)}%
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Volume by Muscle */}
      {weeklySummary && Object.keys(weeklySummary.volumeByMuscle).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Volume by Muscle Group</Text>
          {Object.entries(weeklySummary.volumeByMuscle)
            .sort(([, a], [, b]) => b - a)
            .map(([muscle, volume]) => (
              <View key={muscle} style={styles.muscleRow}>
                <Text style={styles.muscleName}>{muscle}</Text>
                <View style={styles.muscleBarContainer}>
                  <View
                    style={[
                      styles.muscleBar,
                      {
                        width: `${(volume / Math.max(...Object.values(weeklySummary.volumeByMuscle))) * 100}%`,
                      },
                    ]}
                  />
                  <Text style={styles.muscleVolume}>{Math.round(volume)}kg</Text>
                </View>
              </View>
            ))}
        </View>
      )}

      {/* Insights */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Insights</Text>
        {weeklySummary && (
          <>
            {weeklySummary.sessionsCompleted === weeklySummary.sessionsPlanned && (
              <Text style={styles.insight}>
                ✓ Perfect adherence this week! Keep it up.
              </Text>
            )}
            {weeklySummary.outdoorCompleted && (
              <Text style={styles.insight}>
                ✓ Outdoor session completed. Great for recovery.
              </Text>
            )}
            {weeklySummary.habitsCompletion >= 80 && (
              <Text style={styles.insight}>
                ✓ Strong habit adherence supporting your training.
              </Text>
            )}
            {weeklySummary.sessionsCompleted < weeklySummary.sessionsPlanned && (
              <Text style={styles.insight}>
                ○ {weeklySummary.sessionsPlanned - weeklySummary.sessionsCompleted} session(s) remaining this week.
              </Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function getAdherenceColor(percentage: number): string {
  if (percentage >= 80) return colors.success;
  if (percentage >= 50) return colors.warning;
  return colors.error;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  statLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  muscleRow: {
    marginBottom: spacing.md,
  },
  muscleName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textTransform: 'capitalize',
  },
  muscleBarContainer: {
    position: 'relative',
    height: 24,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  muscleBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  muscleVolume: {
    position: 'absolute',
    right: spacing.sm,
    top: 4,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  insight: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.base * 1.5,
    marginBottom: spacing.xs,
  },
});
