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
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import {
  loadGymSessions,
  loadOutdoorSessions,
  loadHabits,
  loadExerciseCatalog,
} from '../services/storage';
import { GymSession, OutdoorSession, HabitsData, WeeklySummary } from '../models/types';
import {
  generateWeeklyReport,
  getMotivationalMessage,
} from '../services/geminiAI';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProgressScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [motivationalMessage, setMotivationalMessage] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [gymSessions, setGymSessions] = useState<GymSession[]>([]);
  const [outdoorSessions, setOutdoorSessions] = useState<OutdoorSession[]>([]);

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      const [loadedGymSessions, loadedOutdoorSessions, habits, catalog] = await Promise.all([
        loadGymSessions(),
        loadOutdoorSessions(),
        loadHabits(),
        loadExerciseCatalog(),
      ]);

      setGymSessions(loadedGymSessions);
      setOutdoorSessions(loadedOutdoorSessions);

      // Calculate this week's summary
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      const thisWeekGym = loadedGymSessions.filter((s) => {
        const sessionDate = new Date(s.date);
        return sessionDate >= weekStart && sessionDate <= weekEnd;
      });

      const thisWeekOutdoor = loadedOutdoorSessions.filter((s) => {
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

  const generateAIInsights = async () => {
    try {
      setLoadingAI(true);

      // Get this week's sessions
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      const thisWeekSessions = [
        ...gymSessions.filter((s) => {
          const sessionDate = new Date(s.date);
          return sessionDate >= weekStart && sessionDate <= weekEnd;
        }),
        ...outdoorSessions.filter((s) => {
          const sessionDate = new Date(s.date);
          return sessionDate >= weekStart && sessionDate <= weekEnd;
        }),
      ];

      if (thisWeekSessions.length === 0) {
        setAiInsights('No sessions completed this week yet. Start your first workout to get AI insights!');
        setMotivationalMessage('Every journey starts with a single step. Let\'s make today count!');
        setLoadingAI(false);
        return;
      }

      // Generate weekly report and motivational message in parallel
      const [weeklyReport, motivationMsg] = await Promise.all([
        generateWeeklyReport(thisWeekSessions),
        getMotivationalMessage([...gymSessions, ...outdoorSessions].slice(-5)),
      ]);

      setAiInsights(weeklyReport);
      setMotivationalMessage(motivationMsg);
      setLoadingAI(false);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      setAiInsights('Unable to generate AI insights at this time. Please try again later.');
      setLoadingAI(false);
    }
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
      {/* Session History Button */}
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate('SessionHistory')}
      >
        <View style={styles.historyButtonContent}>
          <Ionicons name="calendar" size={24} color={colors.primary} />
          <View style={styles.historyButtonText}>
            <Text style={styles.historyButtonTitle}>View Session History</Text>
            <Text style={styles.historyButtonSubtitle}>
              Review, edit, and manage your past workouts
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

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

      {/* AI-Powered Insights */}
      <View style={styles.card}>
        <View style={styles.aiHeaderRow}>
          <Text style={styles.cardTitle}>AI Coach Insights</Text>
          <TouchableOpacity
            style={[styles.aiButton, loadingAI && styles.aiButtonDisabled]}
            onPress={generateAIInsights}
            disabled={loadingAI}
          >
            {loadingAI ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.aiButtonText}>Generate</Text>
            )}
          </TouchableOpacity>
        </View>

        {motivationalMessage && (
          <View style={styles.motivationCard}>
            <Text style={styles.motivationText}>{motivationalMessage}</Text>
          </View>
        )}

        {aiInsights && (
          <View style={styles.aiInsightsContainer}>
            <Text style={styles.aiInsightsText}>{aiInsights}</Text>
          </View>
        )}

        {!aiInsights && !loadingAI && (
          <Text style={styles.aiPlaceholder}>
            Tap "Generate" to get AI-powered analysis of your weekly training and personalized recommendations.
          </Text>
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
  aiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  aiButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  motivationCard: {
    backgroundColor: colors.primary + '15',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  motivationText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: typography.fontSize.base * 1.5,
  },
  aiInsightsContainer: {
    backgroundColor: colors.gray100,
    padding: spacing.md,
    borderRadius: 8,
  },
  aiInsightsText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    lineHeight: typography.fontSize.base * 1.6,
  },
  aiPlaceholder: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  historyButtonText: {
    flex: 1,
  },
  historyButtonTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  historyButtonSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * 1.4,
  },
});
