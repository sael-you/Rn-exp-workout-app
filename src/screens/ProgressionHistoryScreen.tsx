/**
 * Progression History Screen
 * Shows exercise progression over time with volume chart and auto-adjustments timeline
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import { Exercise, GymSession, ExerciseRecommendation } from '../models/types';
import { loadGymSessions } from '../services/storage';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'ProgressionHistory'>;

interface ProgressionDataPoint {
  date: string;
  volume: number;
  weight: number;
  reps: number;
  sessionId: string;
}

const PROGRESSION_STATE_KEY = '@upper_outdoor/progression_state';

async function loadProgressionState() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const jsonValue = await AsyncStorage.getItem(PROGRESSION_STATE_KEY);
    if (jsonValue) {
      return JSON.parse(jsonValue);
    }
  } catch (error) {
    console.error('Error loading progression state:', error);
  }
  return {
    recommendations: [],
    lastAnalysis: new Date().toISOString(),
    autoAdjustmentsEnabled: true,
  };
}

export default function ProgressionHistoryScreen({ route, navigation }: Props) {
  const { exercise, dayType } = route.params;
  const [progressionData, setProgressionData] = useState<ProgressionDataPoint[]>([]);
  const [currentRecommendation, setCurrentRecommendation] = useState<ExerciseRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgressionData();
  }, []);

  const loadProgressionData = async () => {
    try {
      setLoading(true);

      // Load all gym sessions
      const allSessions = await loadGymSessions();

      // Filter sessions for this day type
      const relevantSessions = allSessions.filter(
        (s) => s.dayType === dayType && s.completed
      );

      // Extract progression data for this exercise
      const data: ProgressionDataPoint[] = [];

      for (const session of relevantSessions) {
        const exerciseLog = session.exercises.find(
          (ex) => ex.exerciseId === exercise.id
        );

        if (exerciseLog && exerciseLog.bestSet) {
          data.push({
            date: session.date,
            volume: exerciseLog.bestSet.weight * exerciseLog.bestSet.reps,
            weight: exerciseLog.bestSet.weight,
            reps: exerciseLog.bestSet.reps,
            sessionId: session.id,
          });
        }
      }

      // Sort by date (oldest first)
      data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setProgressionData(data);

      // Load current AI recommendation
      const progressionState = await loadProgressionState();
      const rec = progressionState.recommendations.find(
        (r: ExerciseRecommendation) =>
          r.exerciseId === exercise.id && r.dayType === dayType
      );
      setCurrentRecommendation(rec || null);
    } catch (error) {
      console.error('Error loading progression data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderVolumeChart = () => {
    if (progressionData.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No workout data yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Complete a few sessions to see your progression
          </Text>
        </View>
      );
    }

    const maxVolume = Math.max(...progressionData.map((d) => d.volume));
    const chartHeight = 200;
    const screenWidth = Dimensions.get('window').width - spacing.lg * 2;
    const barWidth = Math.max(20, screenWidth / progressionData.length - 8);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Volume Progression (kg × reps)</Text>
        <View style={styles.chart}>
          <View style={styles.chartBars}>
            {progressionData.map((dataPoint, index) => {
              const barHeight = (dataPoint.volume / maxVolume) * chartHeight;
              const isLatest = index === progressionData.length - 1;

              return (
                <View key={index} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <Text style={styles.volumeLabel}>{dataPoint.volume}</Text>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          width: barWidth,
                          backgroundColor: isLatest ? colors.success : colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.dateLabel} numberOfLines={1}>
                    {format(new Date(dataPoint.date), 'MM/dd')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderCurrentRecommendation = () => {
    if (!currentRecommendation) {
      return (
        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationTitle}>Current AI Recommendation</Text>
          <Text style={styles.recommendationText}>
            No AI recommendation yet. Complete a workout to get started.
          </Text>
        </View>
      );
    }

    const sourceLabels = {
      baseline: '📊 Based on your history',
      progression: '💪 Progressive overload',
      deload: '🔄 Deload week',
      plateau_recovery: '⚡ Rebuilding strength',
    };

    return (
      <View style={styles.recommendationCard}>
        <Text style={styles.recommendationTitle}>Current AI Recommendation</Text>
        <View style={styles.recommendationContent}>
          <View style={styles.recommendationStats}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Weight</Text>
              <Text style={styles.statValue}>{currentRecommendation.weight}kg</Text>
            </View>
            <Text style={styles.statSeparator}>×</Text>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Reps</Text>
              <Text style={styles.statValue}>{currentRecommendation.reps}</Text>
            </View>
            <Text style={styles.statSeparator}>=</Text>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Volume</Text>
              <Text style={styles.statValue}>
                {currentRecommendation.weight * currentRecommendation.reps}
              </Text>
            </View>
          </View>
          <View style={styles.recommendationSource}>
            <Text style={styles.recommendationSourceText}>
              {sourceLabels[currentRecommendation.source]}
            </Text>
          </View>
          <View style={styles.recommendationMetadata}>
            <Text style={styles.metadataText}>
              Sessions at this weight: {currentRecommendation.sessionsAtWeight}
            </Text>
            {currentRecommendation.plateauDetected && (
              <Text style={styles.plateauWarning}>⚠️ Plateau detected</Text>
            )}
            {currentRecommendation.deloadScheduled && (
              <Text style={styles.deloadInfo}>🔄 Deload scheduled</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderSessionHistory = () => {
    if (progressionData.length === 0) {
      return null;
    }

    return (
      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>Session History</Text>
        {progressionData.slice().reverse().map((dataPoint, index) => {
          const actualIndex = progressionData.length - 1 - index;
          const isImprovement = actualIndex > 0 && dataPoint.volume > progressionData[actualIndex - 1].volume;
          const isPR = dataPoint.volume === Math.max(...progressionData.map(d => d.volume));

          return (
            <View key={index} style={styles.historyRow}>
              <View style={styles.historyDate}>
                <Text style={styles.historyDateText}>
                  {format(new Date(dataPoint.date), 'MMM dd, yyyy')}
                </Text>
                {isPR && (
                  <View style={styles.prBadge}>
                    <Text style={styles.prBadgeText}>PR</Text>
                  </View>
                )}
              </View>
              <View style={styles.historyStats}>
                <Text style={styles.historyStatsText}>
                  {dataPoint.weight}kg × {dataPoint.reps} reps = {dataPoint.volume} volume
                </Text>
                {isImprovement && (
                  <Text style={styles.improvementIndicator}>📈</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading progression data...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Exercise Info */}
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseTarget}>
          {exercise.target} • {exercise.equipment}
        </Text>
      </View>

      {/* Current AI Recommendation */}
      {renderCurrentRecommendation()}

      {/* Volume Chart */}
      {renderVolumeChart()}

      {/* Session History */}
      {renderSessionHistory()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  exerciseInfo: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
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
    textTransform: 'capitalize',
  },
  recommendationCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  recommendationTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  recommendationContent: {
    gap: spacing.md,
  },
  recommendationStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  statSeparator: {
    fontSize: typography.fontSize.xl,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
    paddingHorizontal: spacing.xs,
  },
  recommendationSource: {
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  recommendationSourceText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  recommendationMetadata: {
    gap: spacing.xs,
  },
  metadataText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  plateauWarning: {
    fontSize: typography.fontSize.sm,
    color: colors.warning,
    fontWeight: typography.fontWeight.semibold,
  },
  deloadInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.info,
    fontWeight: typography.fontWeight.semibold,
  },
  recommendationText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  chartContainer: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  chartTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  chart: {
    overflow: 'hidden',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 240,
    gap: 4,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 220,
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 10,
  },
  volumeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  dateLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    transform: [{ rotate: '-45deg' }],
    width: 40,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  historyContainer: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  historyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  historyRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingVertical: spacing.md,
  },
  historyDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  historyDateText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
    marginRight: spacing.sm,
  },
  prBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 4,
  },
  prBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
  historyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyStatsText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  improvementIndicator: {
    fontSize: typography.fontSize.lg,
  },
});
