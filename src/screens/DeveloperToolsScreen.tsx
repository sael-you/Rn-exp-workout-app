/**
 * Developer Tools Screen
 * Load test data scenarios and test AI coach functionality
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import {
  generateSteadyProgressSessions,
  generatePlateauSessions,
  generateOvertrainingSessions,
  generateInconsistentSessions,
  generateRapidProgressSessions,
  generateDeloadNeededSessions,
  generateMixedProgressSessions,
  generateOutdoorSessions,
} from '../services/testDataGenerators';
import {
  saveGymSession,
  saveOutdoorSession,
  clearAllData,
  loadGymSessions,
  loadOutdoorSessions,
  loadWorkoutPlan,
  saveWorkoutPlan,
} from '../services/storage';
import {
  detectExercisePlateau,
  shouldSuggestDeload,
  analyzeAdherence,
} from '../services/geminiAI';
import {
  analyzeSessionAndUpdateRecommendations,
  checkForAutoDeload,
  checkForExerciseSwap,
  resetProgressionState,
} from '../services/aiProgression';
import { useModal } from '../contexts/ModalContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DeveloperToolsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    gymSessions: number;
    outdoorSessions: number;
  } | null>(null);
  const { showSuccess, showError, showWarning, showConfirm, showModal } = useModal();

  const loadStats = async () => {
    const [gym, outdoor] = await Promise.all([
      loadGymSessions(),
      loadOutdoorSessions(),
    ]);
    setStats({
      gymSessions: gym.length,
      outdoorSessions: outdoor.length,
    });
  };

  React.useEffect(() => {
    loadStats();
  }, []);

  const importScenario = async (
    scenarioName: string,
    generator: () => any[]
  ) => {
    try {
      setLoading(true);

      // Save workout plan before clearing (needed for AI progression system)
      const existingPlan = await loadWorkoutPlan();

      // Clear existing data first
      await clearAllData();

      // Restore workout plan
      if (existingPlan) {
        await saveWorkoutPlan(existingPlan);
      }

      // Generate and import sessions
      const sessions = generator();

      for (const session of sessions) {
        if ('exercises' in session) {
          await saveGymSession(session);
        } else {
          await saveOutdoorSession(session);
        }
      }

      await loadStats();

      showSuccess(
        'Success',
        `Loaded ${sessions.length} sessions for "${scenarioName}" scenario.\n\nWorkout plan preserved.\n\nNow test AI Progression System!`
      );
    } catch (error) {
      console.error('Error importing scenario:', error);
      showError('Error', 'Failed to import test data');
    } finally {
      setLoading(false);
    }
  };

  const testDetectionAlgorithms = async () => {
    try {
      setLoading(true);

      const gymSessions = await loadGymSessions();

      if (gymSessions.length === 0) {
        showWarning('No Data', 'Load a test scenario first!');
        setLoading(false);
        return;
      }

      // Test plateau detection
      const benchPressId = 'Barbell_Bench_Press_-_Medium_Grip';
      const hasPlateau = detectExercisePlateau(gymSessions, benchPressId, 3);

      // Test deload suggestion
      const needsDeload = shouldSuggestDeload(gymSessions, 5);

      // Test adherence analysis
      const weeklySchedule = [
        { dayOfWeek: 1, dayType: 'Push' },
        { dayOfWeek: 3, dayType: 'Pull' },
        { dayOfWeek: 5, dayType: 'Upper2' },
      ];
      const adherence = analyzeAdherence(gymSessions, weeklySchedule);

      showModal({
        type: 'success',
        title: 'Detection Results',
        message:
          `Sessions loaded: ${gymSessions.length}\n\n` +
          `Plateau detected (Bench Press): ${hasPlateau ? 'YES ⚠️' : 'NO ✅'}\n\n` +
          `Deload needed: ${needsDeload ? 'YES 😴' : 'NO 💪'}\n\n` +
          `Adherence rate: ${adherence.adherenceRate.toFixed(1)}%\n` +
          `Consistency: ${adherence.consistencyScore.toFixed(1)}%\n` +
          `Missed workouts: ${adherence.missedWorkouts}`,
      });
    } catch (error) {
      console.error('Error testing algorithms:', error);
      showError('Error', 'Failed to run tests');
    } finally {
      setLoading(false);
    }
  };

  const testAIProgressionSystem = async () => {
    try {
      setLoading(true);

      const gymSessions = await loadGymSessions();

      if (gymSessions.length === 0) {
        showWarning('No Data', 'Load a test scenario first!');
        setLoading(false);
        return;
      }

      // Reset progression state to start fresh
      await resetProgressionState();

      // Analyze ALL sessions sequentially to build progression state
      const allInsights: any[] = [];

      // Sort sessions by date (oldest first)
      const sortedSessions = [...gymSessions].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      for (const session of sortedSessions) {
        const insights = await analyzeSessionAndUpdateRecommendations(session);
        allInsights.push(...insights);
      }

      // Test auto-deload check
      const deloadInsights = await checkForAutoDeload();

      // Test exercise swap check
      const swapCheck = await checkForExerciseSwap();

      // Collect all auto-adjustments
      const autoAdjustments = allInsights.filter(i => i.type === 'auto_adjustment');
      const progressions = autoAdjustments.filter(a => a.message.includes('💪'));
      const deloads = autoAdjustments.filter(a => a.message.includes('🔄'));
      const reductions = autoAdjustments.filter(a => a.message.includes('⚠️'));

      showModal({
        type: 'success',
        title: 'AI Progression Test Results',
        message:
          `📊 Sessions analyzed: ${sortedSessions.length}\n\n` +
          `🤖 Total auto-adjustments: ${autoAdjustments.length}\n` +
          `   💪 Weight increases: ${progressions.length}\n` +
          `   🔄 Deloads: ${deloads.length}\n` +
          `   ⚠️ Reductions: ${reductions.length}\n\n` +
          (autoAdjustments.length > 0
            ? 'Recent adjustments:\n' + autoAdjustments.slice(-5).map(i => `• ${i.message}`).join('\n') + '\n\n'
            : 'No auto-adjustments triggered\n\n') +
          `🔄 Additional deload insights: ${deloadInsights.length}\n\n` +
          `⚡ Exercises needing swap: ${swapCheck.exerciseIds.length}\n` +
          (swapCheck.needsSwap
            ? swapCheck.exerciseIds.map(id => `• ${id.replace(/_/g, ' ')}`).join('\n')
            : 'No exercises need swapping'),
      });
    } catch (error) {
      console.error('Error testing AI progression:', error);
      showError('Error', 'Failed to test AI progression system:\n\n' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllData = () => {
    showConfirm(
      'Clear All Data?',
      'This will delete all workouts, progress, and settings. Are you sure?',
      async () => {
        setLoading(true);
        await clearAllData();
        await loadStats();
        setLoading(false);
        showSuccess('Done', 'All data cleared');
      }
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔧 Developer Tools</Text>
          <Text style={styles.headerSubtitle}>
            Load test scenarios and test AI analysis
          </Text>
        </View>

        {/* Current Stats */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Current Data</Text>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>Gym Sessions:</Text>
              <Text style={styles.statsValue}>{stats.gymSessions}</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>Outdoor Sessions:</Text>
              <Text style={styles.statsValue}>{stats.outdoorSessions}</Text>
            </View>
          </View>
        )}

        {/* Test Scenarios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Load Test Scenarios</Text>
          <Text style={styles.sectionSubtitle}>
            Each scenario simulates 4-5 weeks of training data
          </Text>

          <ScenarioButton
            title="Steady Progress"
            description="5% improvement per week (healthy progress)"
            emoji="📈"
            onPress={() =>
              importScenario('Steady Progress', () => generateSteadyProgressSessions(4))
            }
            disabled={loading}
          />

          <ScenarioButton
            title="Plateau Detected"
            description="Stuck at same weights for 3+ weeks"
            emoji="⚠️"
            onPress={() =>
              importScenario('Plateau', () => generatePlateauSessions(5))
            }
            disabled={loading}
          />

          <ScenarioButton
            title="Overtraining"
            description="Performance declining over time"
            emoji="😰"
            onPress={() =>
              importScenario('Overtraining', () => generateOvertrainingSessions(5))
            }
            disabled={loading}
          />

          <ScenarioButton
            title="Inconsistent Training"
            description="Missing workouts, sporadic schedule"
            emoji="📉"
            onPress={() =>
              importScenario('Inconsistent', () => generateInconsistentSessions(4))
            }
            disabled={loading}
          />

          <ScenarioButton
            title="Rapid Progress"
            description="Beginner gains (10% per week)"
            emoji="🚀"
            onPress={() =>
              importScenario('Rapid Progress', () => generateRapidProgressSessions(3))
            }
            disabled={loading}
          />

          <ScenarioButton
            title="Deload Needed"
            description="5 weeks hard training, showing fatigue"
            emoji="😴"
            onPress={() =>
              importScenario('Deload Needed', () => generateDeloadNeededSessions(5))
            }
            disabled={loading}
          />

          <ScenarioButton
            title="Mixed Progress"
            description="Some exercises improving, others stuck"
            emoji="🔀"
            onPress={() =>
              importScenario('Mixed Progress', () => generateMixedProgressSessions(4))
            }
            disabled={loading}
          />
        </View>

        {/* Testing Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testing Tools</Text>

          <TouchableOpacity
            style={[styles.toolButton, styles.testButton]}
            onPress={testDetectionAlgorithms}
            disabled={loading}
          >
            <Text style={styles.toolButtonIcon}>🧪</Text>
            <View style={styles.toolButtonTextContainer}>
              <Text style={styles.toolButtonText}>Run Detection Tests</Text>
              <Text style={styles.toolButtonSubtext}>
                Test plateau, deload, and adherence detection
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, styles.primaryButton]}
            onPress={testAIProgressionSystem}
            disabled={loading}
          >
            <Text style={styles.toolButtonIcon}>🚀</Text>
            <View style={styles.toolButtonTextContainer}>
              <Text style={styles.toolButtonText}>Test AI Progression System</Text>
              <Text style={styles.toolButtonSubtext}>
                Test autonomous weight recommendations and auto-adjustments
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, styles.aiButton]}
            onPress={() => navigation.navigate('AICoach')}
            disabled={loading}
          >
            <Text style={styles.toolButtonIcon}>🤖</Text>
            <View style={styles.toolButtonTextContainer}>
              <Text style={styles.toolButtonText}>Open AI Coach</Text>
              <Text style={styles.toolButtonSubtext}>
                Request weekly check-in or analysis
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, styles.dangerButton]}
            onPress={handleClearAllData}
            disabled={loading}
          >
            <Text style={styles.toolButtonIcon}>🗑️</Text>
            <View style={styles.toolButtonTextContainer}>
              <Text style={styles.toolButtonText}>Clear All Data</Text>
              <Text style={styles.toolButtonSubtext}>
                Reset app to fresh state
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface ScenarioButtonProps {
  title: string;
  description: string;
  emoji: string;
  onPress: () => void;
  disabled: boolean;
}

function ScenarioButton({ title, description, emoji, onPress, disabled }: ScenarioButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.scenarioButton, disabled && styles.scenarioButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.scenarioEmoji}>{emoji}</Text>
      <View style={styles.scenarioTextContainer}>
        <Text style={styles.scenarioTitle}>{title}</Text>
        <Text style={styles.scenarioDescription}>{description}</Text>
      </View>
      <Text style={styles.scenarioArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statsLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  statsValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  scenarioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  scenarioButtonDisabled: {
    opacity: 0.5,
  },
  scenarioEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  scenarioTextContainer: {
    flex: 1,
  },
  scenarioTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  scenarioDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  scenarioArrow: {
    fontSize: 24,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  testButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  primaryButton: {
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.success,
  },
  aiButton: {
    backgroundColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.error,
  },
  toolButtonIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  toolButtonTextContainer: {
    flex: 1,
  },
  toolButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  toolButtonSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  loadingOverlay: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
});
