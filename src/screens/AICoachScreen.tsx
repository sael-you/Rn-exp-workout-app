/**
 * AI Coach Screen
 * Central hub for AI insights, progress analysis, and program adaptations
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import {
  loadAICoachData,
  loadGymSessions,
  loadOutdoorSessions,
  loadUserProfile,
  loadWorkoutPlan,
  addPerformanceInsight,
  saveAICoachData,
  loadExerciseCatalog,
  saveWorkoutPlan,
} from '../services/storage';
import {
  generateWeeklyReport,
  analyzeProgress,
  getWorkoutSuggestions,
  suggestExerciseSubstitution,
  adaptProgramForConstraints,
  detectExercisePlateau,
} from '../services/geminiAI';
import { GymSession, OutdoorSession, PerformanceInsight, Exercise } from '../models/types';
import { format, subWeeks, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { useModal } from '../contexts/ModalContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AICoachScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { showModal, showSuccess, showError, showWarning, showConfirm } = useModal();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [coachData, profile] = await Promise.all([
      loadAICoachData(),
      loadUserProfile(),
    ]);
    if (coachData) {
      setInsights(coachData.discoveredInsights || []);
      setLastCheckIn(coachData.lastWeeklyCheckIn || null);
    }
    setUserProfile(profile);
    setLoading(false);
  };

  const handleWeeklyCheckIn = async () => {
    try {
      setAnalyzing(true);

      // Get sessions from the past week
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

      const [gymSessions, outdoorSessions] = await Promise.all([
        loadGymSessions(),
        loadOutdoorSessions(),
      ]);

      const weekSessions = [
        ...gymSessions.filter((s) =>
          isWithinInterval(new Date(s.date), { start: weekStart, end: weekEnd })
        ),
        ...outdoorSessions.filter((s) =>
          isWithinInterval(new Date(s.date), { start: weekStart, end: weekEnd })
        ),
      ];

      if (weekSessions.length === 0) {
        showWarning(
          'No Sessions This Week',
          'Complete at least one workout this week to get AI analysis.'
        );
        setAnalyzing(false);
        return;
      }

      // Generate weekly report
      const report = await generateWeeklyReport(weekSessions);

      // Save as insight
      const insight: PerformanceInsight = {
        type: 'weekly_review',
        message: report,
        discoveredAt: new Date().toISOString(),
        relatedExercises: [],
      };

      await addPerformanceInsight(insight);
      await loadData();

      showSuccess('Weekly Check-In Complete', 'Your AI coach has analyzed your progress!');
    } catch (error) {
      console.error('Error during weekly check-in:', error);
      showError('Error', 'Failed to analyze weekly progress. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeSpecificExercise = async () => {
    try {
      setAnalyzing(true);
      const gymSessions = await loadGymSessions();

      if (gymSessions.length < 2) {
        showWarning('Not Enough Data', 'Complete at least 2 workouts to analyze specific exercises.');
        setAnalyzing(false);
        return;
      }

      // Get most common exercises from recent sessions
      const exerciseFrequency: Record<string, number> = {};
      gymSessions.slice(0, 5).forEach(session => {
        session.exercises.forEach(ex => {
          exerciseFrequency[ex.exerciseId] = (exerciseFrequency[ex.exerciseId] || 0) + 1;
        });
      });

      const topExercises = Object.entries(exerciseFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      if (topExercises.length === 0) {
        showWarning('No Data', 'No exercises found in recent sessions.');
        setAnalyzing(false);
        return;
      }

      // Analyze first top exercise
      const exerciseId = topExercises[0];
      const exerciseSessions = gymSessions.filter(s =>
        s.exercises.some(ex => ex.exerciseId === exerciseId)
      );

      if (exerciseSessions.length < 2) {
        showWarning('Not Enough Data', 'Not enough data for this exercise.');
        setAnalyzing(false);
        return;
      }

      // Calculate progress
      const recent = exerciseSessions[0].exercises.find(ex => ex.exerciseId === exerciseId);
      const previous = exerciseSessions[1].exercises.find(ex => ex.exerciseId === exerciseId);

      if (!recent?.bestSet || !previous?.bestSet) {
        showWarning('No Data', 'Not enough set data for comparison.');
        setAnalyzing(false);
        return;
      }

      const recentVolume = recent.bestSet.weight * recent.bestSet.reps;
      const previousVolume = previous.bestSet.weight * previous.bestSet.reps;
      const progress = ((recentVolume - previousVolume) / previousVolume) * 100;

      const hasPlateau = detectExercisePlateau(gymSessions, exerciseId, 3);

      const analysisMessage = `${exerciseId.replace(/_/g, ' ')}:\n\n` +
        `Recent best: ${recent.bestSet.weight}kg × ${recent.bestSet.reps} reps\n` +
        `Previous: ${previous.bestSet.weight}kg × ${previous.bestSet.reps} reps\n` +
        `Progress: ${progress > 0 ? '+' : ''}${progress.toFixed(1)}%\n\n` +
        (hasPlateau
          ? '⚠️ Plateau detected. Consider deload or variation.\n\n'
          : '✅ Good progress!\n\n') +
        `Total sessions: ${exerciseSessions.length}`;

      const insight: PerformanceInsight = {
        type: hasPlateau ? 'plateau_detected' : 'progress_analysis',
        message: analysisMessage,
        discoveredAt: new Date().toISOString(),
        relatedExercises: [exerciseId],
      };

      await addPerformanceInsight(insight);
      await loadData();
      setAnalyzing(false);

      showSuccess('Exercise Analysis Complete', 'Check your recent insights below!');
    } catch (error) {
      console.error('Error analyzing exercise:', error);
      showError('Error', 'Failed to analyze exercise.');
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeProgramEffectiveness = async () => {
    try {
      setAnalyzing(true);
      const [gymSessions, userProfile, workoutPlan] = await Promise.all([
        loadGymSessions(),
        loadUserProfile(),
        loadWorkoutPlan(),
      ]);

      if (!userProfile || !workoutPlan) {
        showError('Error', 'Unable to load program data.');
        setAnalyzing(false);
        return;
      }

      if (gymSessions.length < 4) {
        showWarning('Not Enough Data', 'Complete at least 4 workouts to analyze program effectiveness.');
        setAnalyzing(false);
        return;
      }

      // Calculate adherence
      const recentSessions = gymSessions.slice(0, 12);
      const dayTypeCount: Record<string, number> = {};
      recentSessions.forEach(s => {
        dayTypeCount[s.dayType] = (dayTypeCount[s.dayType] || 0) + 1;
      });

      const totalPlannedDays = Object.keys(workoutPlan.plans).filter(k => k !== 'Outdoor').length;
      const adherenceRate = (recentSessions.length / (4 * 3)) * 100; // 4 weeks, 3 days per week

      // Check for overall progress
      let totalVolumeIncrease = 0;
      let exercisesAnalyzed = 0;

      for (const session of recentSessions.slice(0, 3)) {
        for (const ex of session.exercises) {
          const olderSession = gymSessions.slice(3).find(s =>
            s.dayType === session.dayType &&
            s.exercises.some(e => e.exerciseId === ex.exerciseId)
          );

          if (olderSession) {
            const olderEx = olderSession.exercises.find(e => e.exerciseId === ex.exerciseId);
            if (ex.bestSet && olderEx?.bestSet) {
              const recentVol = ex.bestSet.weight * ex.bestSet.reps;
              const olderVol = olderEx.bestSet.weight * olderEx.bestSet.reps;
              totalVolumeIncrease += ((recentVol - olderVol) / olderVol) * 100;
              exercisesAnalyzed++;
            }
          }
        }
      }

      const avgProgress = exercisesAnalyzed > 0 ? totalVolumeIncrease / exercisesAnalyzed : 0;

      const effectivenessMessage =
        `Program: ${workoutPlan.name}\n` +
        `Goal: ${userProfile.primaryGoal}\n\n` +
        `ADHERENCE: ${adherenceRate.toFixed(1)}%\n` +
        (adherenceRate >= 80 ? '✅ Excellent consistency!\n' :
         adherenceRate >= 60 ? '⚠️ Good, but could improve\n' :
         '❌ Need better consistency\n') +
        `\nSessions completed: ${recentSessions.length} (last 4 weeks)\n\n` +
        `PROGRESS: ${avgProgress > 0 ? '+' : ''}${avgProgress.toFixed(1)}%\n` +
        (avgProgress >= 5 ? '✅ Strong progress!\n' :
         avgProgress >= 2 ? '✅ Steady progress\n' :
         avgProgress >= 0 ? '⚠️ Slow progress\n' :
         '❌ Declining performance\n') +
        `\nRECOMMENDATION:\n` +
        (adherenceRate < 70 ? '• Focus on consistency first\n' : '') +
        (avgProgress < 2 ? '• Consider deload week\n• Review nutrition and recovery\n' : '') +
        (avgProgress >= 5 ? '• Keep up the great work!\n• Consider progressive overload\n' : '');

      const insight: PerformanceInsight = {
        type: 'progress_analysis',
        message: effectivenessMessage,
        discoveredAt: new Date().toISOString(),
        relatedExercises: [],
      };

      await addPerformanceInsight(insight);
      await loadData();
      setAnalyzing(false);

      showSuccess('Program Analysis Complete', 'Check your recent insights below!');
    } catch (error) {
      console.error('Error analyzing program:', error);
      showError('Error', 'Failed to analyze program effectiveness.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRequestAnalysis = async () => {
    showModal({
      type: 'info',
      title: 'Request AI Analysis',
      message: 'What would you like me to analyze?',
      buttons: [
        {
          text: 'Overall Progress',
          onPress: () => analyzeOverallProgress(),
          style: 'primary',
        },
        {
          text: 'Specific Exercise',
          onPress: analyzeSpecificExercise,
          style: 'default',
        },
        {
          text: 'Program Effectiveness',
          onPress: analyzeProgramEffectiveness,
          style: 'default',
        },
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
      ],
    });
  };

  const analyzeOverallProgress = async () => {
    try {
      setAnalyzing(true);

      const gymSessions = await loadGymSessions();
      if (gymSessions.length < 2) {
        showWarning(
          'Not Enough Data',
          'Complete at least 2 workouts to get progress analysis.'
        );
        setAnalyzing(false);
        return;
      }

      // Compare most recent session with previous
      const recentSession = gymSessions[0];
      const previousSession = gymSessions.find(
        (s) => s.dayType === recentSession.dayType && s.id !== recentSession.id
      );

      if (!previousSession) {
        showWarning(
          'Not Enough Data',
          `No previous ${recentSession.dayType} session found for comparison.`
        );
        setAnalyzing(false);
        return;
      }

      const analysis = await analyzeProgress(previousSession, recentSession);

      const insight: PerformanceInsight = {
        type: 'progress_analysis',
        message: analysis,
        discoveredAt: new Date().toISOString(),
        relatedExercises: [],
      };

      await addPerformanceInsight(insight);
      await loadData();

      showSuccess('Analysis Complete', 'Check your recent insights below!');
    } catch (error) {
      console.error('Error analyzing progress:', error);
      showError('Error', 'Failed to analyze progress. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePainInjuryReport = async () => {
    try {
      // Load necessary data
      const [workoutPlan, catalog, userProfile] = await Promise.all([
        loadWorkoutPlan(),
        loadExerciseCatalog(),
        loadUserProfile(),
      ]);

      if (!workoutPlan || !catalog || !userProfile) {
        showError('Error', 'Unable to load workout data. Please ensure your profile is set up.');
        return;
      }

      // Get all exercises from the plan (works for both muscle group and body part splits)
      const allPlannedExercises = Object.values(workoutPlan.plans)
        .filter(dayPlan => dayPlan && dayPlan.exercises)
        .flatMap(dayPlan => dayPlan!.exercises);

      if (allPlannedExercises.length === 0) {
        showWarning('No Exercises', 'Your workout plan has no exercises to substitute.');
        return;
      }

      // Show exercise selection modal
      const exerciseOptions = allPlannedExercises.map((pe) => {
        const ex = catalog.exercises.find((e) => e.id === pe.exerciseId);
        return ex ? { id: ex.id, name: ex.name } : null;
      }).filter(Boolean);

      // For now, use first exercise as example (in production, show a picker)
      const firstExercise = catalog.exercises.find(
        (e) => e.id === allPlannedExercises[0].exerciseId
      );

      if (!firstExercise) return;

      setAnalyzing(true);
      const suggestions = await suggestExerciseSubstitution(
        firstExercise,
        'pain',
        catalog.exercises,
        userProfile
      );

      setAnalyzing(false);

      if (suggestions.length > 0) {
        const suggestionText = suggestions
          .map((ex, idx) => `${idx + 1}. ${ex.name} (${ex.equipment})`)
          .join('\n');

        showModal({
          type: 'success',
          title: 'Exercise Alternatives',
          message: `For ${firstExercise.name}, try these alternatives:\n\n${suggestionText}\n\nGo to Settings > Edit Plan to make changes.`,
          buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
        });
      } else {
        showWarning('No Alternatives', 'Could not find suitable alternatives at this time.');
      }
    } catch (error) {
      console.error('Error suggesting substitution:', error);
      showError('Error', 'Failed to suggest exercise alternatives.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleEquipmentChange = async () => {
    try {
      setAnalyzing(true);
      const [workoutPlan, catalog, userProfile] = await Promise.all([
        loadWorkoutPlan(),
        loadExerciseCatalog(),
        loadUserProfile(),
      ]);

      if (!workoutPlan || !catalog || !userProfile) {
        showError('Error', 'Unable to load workout data.');
        setAnalyzing(false);
        return;
      }

      const adaptedPlan = await adaptProgramForConstraints(
        workoutPlan,
        { type: 'equipment', details: 'User equipment has changed' },
        catalog.exercises,
        userProfile
      );

      await saveWorkoutPlan(adaptedPlan);
      setAnalyzing(false);

      showSuccess(
        'Program Adapted',
        'Your workout program has been adapted for equipment changes. Check Settings to review.'
      );
    } catch (error) {
      console.error('Error adapting for equipment:', error);
      showError('Error', 'Failed to adapt program.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTimeConstraints = async () => {
    try {
      setAnalyzing(true);
      const [workoutPlan, catalog, userProfile] = await Promise.all([
        loadWorkoutPlan(),
        loadExerciseCatalog(),
        loadUserProfile(),
      ]);

      if (!workoutPlan || !catalog || !userProfile) {
        showError('Error', 'Unable to load workout data.');
        setAnalyzing(false);
        return;
      }

      const adaptedPlan = await adaptProgramForConstraints(
        workoutPlan,
        { type: 'time', details: 'User needs shorter workout sessions' },
        catalog.exercises,
        userProfile
      );

      await saveWorkoutPlan(adaptedPlan);
      setAnalyzing(false);

      showSuccess(
        'Volume Adjusted',
        'Your workout volume has been adjusted for time constraints. Check Settings to review.'
      );
    } catch (error) {
      console.error('Error adapting for time:', error);
      showError('Error', 'Failed to adjust volume.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePlateauDetection = async () => {
    try {
      setAnalyzing(true);
      const gymSessions = await loadGymSessions();

      if (gymSessions.length < 3) {
        showWarning(
          'Not Enough Data',
          'Complete at least 3 workouts to detect plateaus.'
        );
        setAnalyzing(false);
        return;
      }

      // Check for plateaus in common exercises
      const commonExercises = [
        'Barbell_Bench_Press_-_Medium_Grip',
        'Barbell_Squat',
        'Barbell_Deadlift',
        'Pull-up',
      ];

      let plateausDetected: string[] = [];
      for (const exerciseId of commonExercises) {
        const hasPlateau = detectExercisePlateau(gymSessions, exerciseId, 3);
        if (hasPlateau) {
          plateausDetected.push(exerciseId.replace(/_/g, ' '));
        }
      }

      setAnalyzing(false);

      if (plateausDetected.length > 0) {
        const plateauText = plateausDetected.map((ex, idx) => `${idx + 1}. ${ex}`).join('\n');

        showModal({
          type: 'warning',
          title: 'Plateaus Detected',
          message: `No progress in:\n\n${plateauText}\n\nConsider:\n• Deload week (reduce weight by 10%)\n• Change rep ranges\n• Add variation exercises`,
          buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
        });

        // Save plateau insight
        const insight: PerformanceInsight = {
          type: 'plateau_detected',
          message: `Plateau detected in: ${plateausDetected.join(', ')}. Consider deload or exercise variation.`,
          discoveredAt: new Date().toISOString(),
          relatedExercises: plateausDetected,
        };
        await addPerformanceInsight(insight);
        await loadData();
      } else {
        showSuccess(
          'No Plateaus',
          'Great progress! No plateaus detected in your main lifts.'
        );
      }
    } catch (error) {
      console.error('Error detecting plateau:', error);
      showError('Error', 'Failed to analyze for plateaus.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReportIssue = () => {
    showModal({
      type: 'info',
      title: 'Report Issue',
      message: 'What issue would you like to report?',
      buttons: [
        {
          text: 'Pain/Injury',
          onPress: handlePainInjuryReport,
          style: 'default',
        },
        {
          text: 'Equipment Change',
          onPress: handleEquipmentChange,
          style: 'default',
        },
        {
          text: 'Time Constraints',
          onPress: handleTimeConstraints,
          style: 'default',
        },
        {
          text: 'Not Progressing',
          onPress: handlePlateauDetection,
          style: 'default',
        },
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
      ],
    });
  };

  const handleClearInsights = () => {
    showConfirm(
      'Clear All Insights?',
      'This will delete all AI analysis history. This action cannot be undone.',
      async () => {
        const coachData = await loadAICoachData();
        const updated = {
          ...coachData,
          discoveredInsights: [],
          lastWeeklyCheckIn: coachData?.lastWeeklyCheckIn,
          lastMonthlyReview: coachData?.lastMonthlyReview,
          userProfile: coachData?.userProfile || {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
        };
        await saveAICoachData(updated);
        await loadData();
        showSuccess('Cleared', 'All insights have been cleared.');
      }
    );
  };

  // Format AI text into better readable sections
  const formatInsightText = (text: string) => {
    const sections: { type: 'heading' | 'bullet' | 'text'; content: string }[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect headings (lines ending with :, in caps, or starting with ##)
      if (
        trimmed.match(/^(#+)\s/) ||
        (trimmed.endsWith(':') && trimmed.length < 40) ||
        (trimmed === trimmed.toUpperCase() && trimmed.length < 50)
      ) {
        sections.push({ type: 'heading', content: trimmed.replace(/^#+\s/, '').replace(/:$/, '') });
      }
      // Detect bullet points
      else if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+[\.)]\s/)) {
        sections.push({ type: 'bullet', content: trimmed.replace(/^[-•*]\s/, '').replace(/^\d+[\.)]\s/, '') });
      }
      // Regular text
      else {
        sections.push({ type: 'text', content: trimmed });
      }
    }

    return sections;
  };

  const renderInsightCard = (insight: PerformanceInsight, index: number) => {
    const getInsightIcon = (type: string) => {
      switch (type) {
        case 'weekly_review':
          return '📊';
        case 'progress_analysis':
          return '📈';
        case 'plateau_detected':
          return '⚠️';
        case 'strength_gain':
          return '💪';
        case 'volume_increase':
          return '🔥';
        default:
          return '🤖';
      }
    };

    const getInsightTitle = (type: string) => {
      switch (type) {
        case 'weekly_review':
          return 'Weekly Review';
        case 'progress_analysis':
          return 'Progress Analysis';
        case 'plateau_detected':
          return 'Plateau Detected';
        case 'strength_gain':
          return 'Strength Gain';
        case 'volume_increase':
          return 'Volume Increase';
        default:
          return 'AI Insight';
      }
    };

    const formattedSections = formatInsightText(insight.message);

    return (
      <View key={index} style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Text style={styles.insightIcon}>{getInsightIcon(insight.type)}</Text>
          <View style={styles.insightHeaderText}>
            <Text style={styles.insightTitle}>{getInsightTitle(insight.type)}</Text>
            <Text style={styles.insightDate}>
              {format(new Date(insight.discoveredAt), 'MMM d, yyyy • h:mm a')}
            </Text>
          </View>
        </View>

        <View style={styles.insightContent}>
          {formattedSections.map((section, idx) => {
            if (section.type === 'heading') {
              return (
                <Text key={idx} style={styles.insightHeading}>
                  {section.content}
                </Text>
              );
            } else if (section.type === 'bullet') {
              return (
                <View key={idx} style={styles.bulletContainer}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.bulletText}>{section.content}</Text>
                </View>
              );
            } else {
              return (
                <Text key={idx} style={styles.insightParagraph}>
                  {section.content}
                </Text>
              );
            }
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading AI Coach...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🤖 AI Coach</Text>
          <Text style={styles.headerSubtitle}>
            Your intelligent training companion
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryAction, styles.programCoachAction]}
            onPress={() => navigation.navigate('ProfileSetup')}
          >
            <Text style={styles.actionIcon}>🎯</Text>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionButtonText}>
                {userProfile ? 'Update AI Program' : 'Generate AI Program'}
              </Text>
              <Text style={styles.actionButtonSubtext}>
                {userProfile
                  ? 'Regenerate personalized workout plan'
                  : 'Create personalized workout plan'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.primaryAction]}
            onPress={handleWeeklyCheckIn}
            disabled={analyzing}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionButtonText}>Weekly Check-In</Text>
              <Text style={styles.actionButtonSubtext}>
                Get AI analysis of your week
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={handleRequestAnalysis}
              disabled={analyzing}
            >
              <Text style={styles.actionIcon}>🔍</Text>
              <Text style={styles.actionButtonText}>Request Analysis</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={handleReportIssue}
              disabled={analyzing}
            >
              <Text style={styles.actionIcon}>⚠️</Text>
              <Text style={styles.actionButtonText}>Report Issue</Text>
            </TouchableOpacity>
          </View>
        </View>

        {analyzing && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.analyzingText}>AI is analyzing your data...</Text>
          </View>
        )}

        {/* Recent Insights */}
        <View style={styles.insightsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Insights</Text>
            {insights.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearInsights}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {insights.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💡</Text>
              <Text style={styles.emptyTitle}>No Insights Yet</Text>
              <Text style={styles.emptyText}>
                Complete your workouts and request a weekly check-in to get AI-powered insights
                about your progress!
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.insightsCount}>
                Showing {insights.length} {insights.length === 1 ? 'insight' : 'insights'} (max 20)
              </Text>
              <View style={styles.insightsList}>
                {insights.map((insight, index) => renderInsightCard(insight, index))}
              </View>
            </>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How AI Coach Works</Text>
          <Text style={styles.infoText}>
            • Weekly check-ins analyze your training consistency and progress{'\n'}
            • Request analysis anytime for specific insights{'\n'}
            • Report issues to get exercise alternatives{'\n'}
            • AI adapts your program based on progress{'\n'}
            • All analysis happens on-demand (no automatic changes)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  actionsSection: {
    marginBottom: spacing.xl,
  },
  actionButton: {
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  programCoachAction: {
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.success + '40',
  },
  secondaryAction: {
    backgroundColor: colors.gray100,
    flex: 1,
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  actionButtonSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  analyzingText: {
    marginLeft: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  insightsSection: {
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
  clearButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.gray100,
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    fontWeight: typography.fontWeight.medium,
  },
  insightsCount: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  insightsList: {
    gap: spacing.md,
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  insightIcon: {
    fontSize: 36,
    marginRight: spacing.md,
  },
  insightHeaderText: {
    flex: 1,
  },
  insightTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  insightDate: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  insightContent: {
    gap: spacing.sm,
  },
  insightHeading: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  insightParagraph: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    lineHeight: typography.fontSize.base * 1.6,
    marginBottom: spacing.xs,
  },
  bulletContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  bulletPoint: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    lineHeight: typography.fontSize.base * 1.5,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.gray100,
    borderRadius: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
  },
  infoCard: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * 1.6,
  },
});
