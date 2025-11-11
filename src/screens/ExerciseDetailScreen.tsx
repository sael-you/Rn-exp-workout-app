/**
 * Exercise Detail Screen
 * Shows exercise details, animation, and allows logging sets
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import { useModal } from '../contexts/ModalContext';
import { Exercise, GymSession, SetLog, PlannedExercise, AIRecommendation } from '../models/types';
import { getBestSet } from '../services/progression';
import { saveGymSession, loadGymSessions } from '../services/storage';
import { getSetRecommendation } from '../services/aiProgression';
import { Audio } from 'expo-av';

// Import progression state functions for persisting overrides
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

async function saveProgressionState(state: any) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const jsonValue = JSON.stringify(state);
    await AsyncStorage.setItem(PROGRESSION_STATE_KEY, jsonValue);
  } catch (error) {
    console.error('Error saving progression state:', error);
    throw error;
  }
}

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseDetail'>;

export default function ExerciseDetailScreen({ route, navigation }: Props) {
  const { exercise, session, plannedExercise } = route.params;
  const { showModal, showWarning, showConfirm } = useModal();

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [localSession, setLocalSession] = useState(session);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideWeight, setOverrideWeight] = useState('');
  const [overrideReps, setOverrideReps] = useState('');

  // Load actual session from storage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessions = await loadGymSessions();
        const currentSession = sessions.find((s) => s.id === session.id);
        if (currentSession) {
          setLocalSession(currentSession);
        }
      } catch (error) {
        console.error('Error loading session:', error);
      }
    };
    loadSession();
  }, [session.id]);

  // Load AI recommendation for this exercise
  useEffect(() => {
    const loadRecommendation = async () => {
      try {
        const exerciseLog = localSession.exercises.find(
          (ex) => ex.exerciseId === exercise.id
        );
        const currentSets = exerciseLog?.sets || [];

        const recommendation = await getSetRecommendation(
          exercise.id,
          session.dayType,
          currentSets.length + 1,
          currentSets
        );
        setAiRecommendation(recommendation);
      } catch (error) {
        console.error('Error loading AI recommendation:', error);
      }
    };
    loadRecommendation();
  }, [exercise.id, session.dayType, localSession]);

  // Cycle through exercise images for animation effect
  useEffect(() => {
    if (!exercise.imageUrls || exercise.imageUrls.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % exercise.imageUrls!.length);
    }, 1000); // Change image every second

    return () => clearInterval(interval);
  }, [exercise]);

  // Rest timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  // Play sound when rest timer completes
  useEffect(() => {
    if (restTimer === 0 && !isResting) {
      playRestCompleteSound();
    }
  }, [restTimer, isResting]);

  const playRestCompleteSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' }
      );
      await sound.playAsync();
      // Unload sound after playing
      setTimeout(() => sound.unloadAsync(), 3000);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const handleLogSet = async () => {
    if (!weight || !reps) {
      return;
    }

    // Check if target sets already completed
    const exerciseLog = localSession.exercises.find(
      (ex) => ex.exerciseId === exercise.id
    );

    if (exerciseLog && exerciseLog.sets.length >= plannedExercise.targetSets) {
      showWarning(
        'Sets Complete',
        `You have completed all ${plannedExercise.targetSets} target sets for this exercise.`
      );
      return;
    }

    // Calculate performance ratio if AI recommendation exists
    const actualVolume = parseFloat(weight) * parseInt(reps, 10);
    const recommendedVolume = aiRecommendation
      ? aiRecommendation.weight * aiRecommendation.reps
      : actualVolume;
    const performanceRatio = recommendedVolume > 0
      ? actualVolume / recommendedVolume
      : undefined;

    const newSet: SetLog = {
      id: `${Date.now()}`,
      weight: parseFloat(weight),
      reps: parseInt(reps, 10),
      timestamp: new Date().toISOString(),
      aiRecommended: aiRecommendation || undefined,
      performanceRatio,
    };

    // Update session with new set
    const updatedSession = { ...localSession };
    const updatedExerciseLog = updatedSession.exercises.find(
      (ex) => ex.exerciseId === exercise.id
    );

    if (updatedExerciseLog) {
      updatedExerciseLog.sets.push(newSet);
      updatedExerciseLog.bestSet = getBestSet(updatedExerciseLog.sets);
    }

    setLocalSession(updatedSession);
    await saveGymSession(updatedSession);

    // Clear inputs
    setWeight('');
    setReps('');

    // Check if this was the last set
    const setsCompleted = updatedExerciseLog?.sets.length || 0;
    if (setsCompleted >= plannedExercise.targetSets) {
      // Exercise completed!
      showModal({
        type: 'success',
        title: 'Exercise Complete!',
        message: `Great work! You've completed all ${plannedExercise.targetSets} sets for ${exercise.name}.`,
        buttons: [
          {
            text: 'Continue to Next Exercise',
            onPress: () => navigation.goBack(),
            style: 'primary',
          },
        ],
      });
    } else {
      // Start rest timer for next set
      setRestTimer(90); // 90 seconds default
      setIsResting(true);
    }
  };

  const handleSkipRest = () => {
    setIsResting(false);
    setRestTimer(0);
  };

  const handleOpenOverride = () => {
    if (aiRecommendation) {
      setOverrideWeight(aiRecommendation.weight.toString());
      setOverrideReps(aiRecommendation.reps.toString());
      setShowOverrideModal(true);
    }
  };

  const handleSaveOverride = async () => {
    if (!overrideWeight || !overrideReps) return;

    const newRecommendation: AIRecommendation = {
      weight: parseFloat(overrideWeight),
      reps: parseInt(overrideReps, 10),
      source: 'baseline', // User override becomes new baseline
    };

    // Update local state
    setAiRecommendation(newRecommendation);
    setShowOverrideModal(false);

    // Persist to AsyncStorage
    try {
      const progressionState = await loadProgressionState();

      // Find or create recommendation for this exercise
      const existingRecIndex = progressionState.recommendations.findIndex(
        (r: any) => r.exerciseId === exercise.id && r.dayType === session.dayType
      );

      if (existingRecIndex >= 0) {
        // Update existing recommendation
        progressionState.recommendations[existingRecIndex] = {
          ...progressionState.recommendations[existingRecIndex],
          weight: newRecommendation.weight,
          reps: newRecommendation.reps,
          source: 'baseline',
          lastUpdated: new Date().toISOString(),
          sessionsAtWeight: 0, // Reset counter on manual override
        };
      } else {
        // Create new recommendation
        progressionState.recommendations.push({
          exerciseId: exercise.id,
          dayType: session.dayType,
          weight: newRecommendation.weight,
          reps: newRecommendation.reps,
          source: 'baseline',
          lastUpdated: new Date().toISOString(),
          sessionsAtWeight: 0,
          plateauDetected: false,
          deloadScheduled: false,
        });
      }

      await saveProgressionState(progressionState);

      showModal({
        type: 'success',
        title: 'Recommendation Updated',
        message: `AI will now recommend ${newRecommendation.weight}kg × ${newRecommendation.reps} reps for ${exercise.name}.`,
      });
    } catch (error) {
      console.error('Error saving override:', error);
      showModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to save override. Please try again.',
      });
    }
  };

  const handleEditSet = (set: SetLog) => {
    setEditingSetId(set.id);
    setEditWeight(set.weight.toString());
    setEditReps(set.reps.toString());
  };

  const handleSaveEdit = async () => {
    if (!editWeight || !editReps || !editingSetId) return;

    const updatedSession = { ...localSession };
    const exerciseLog = updatedSession.exercises.find(
      (ex) => ex.exerciseId === exercise.id
    );

    if (exerciseLog) {
      const setIndex = exerciseLog.sets.findIndex((s) => s.id === editingSetId);
      if (setIndex !== -1) {
        exerciseLog.sets[setIndex] = {
          ...exerciseLog.sets[setIndex],
          weight: parseFloat(editWeight),
          reps: parseInt(editReps, 10),
        };
        exerciseLog.bestSet = getBestSet(exerciseLog.sets);
      }
    }

    setLocalSession(updatedSession);
    await saveGymSession(updatedSession);

    setEditingSetId(null);
    setEditWeight('');
    setEditReps('');
  };

  const handleDeleteSet = async (setId: string) => {
    showConfirm(
      'Delete Set',
      'Are you sure you want to delete this set?',
      async () => {
        const updatedSession = { ...localSession };
        const exerciseLog = updatedSession.exercises.find(
          (ex) => ex.exerciseId === exercise.id
        );

        if (exerciseLog) {
          exerciseLog.sets = exerciseLog.sets.filter((s) => s.id !== setId);
          exerciseLog.bestSet = getBestSet(exerciseLog.sets);
        }

        setLocalSession(updatedSession);
        await saveGymSession(updatedSession);
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingSetId(null);
    setEditWeight('');
    setEditReps('');
  };

  const exerciseLog = localSession.exercises.find((ex) => ex.exerciseId === exercise.id);

  return (
    <View style={styles.container}>
      {/* Large Animated Exercise Image */}
      {exercise.imageUrls && exercise.imageUrls.length > 0 && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: exercise.imageUrls[currentImageIndex] }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Exercise Info */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleContent}>
              <Text style={styles.title}>{exercise.name}</Text>
              <Text style={styles.target}>
                {exercise.target} • {exercise.equipment}
              </Text>
              {plannedExercise && (
                <Text style={styles.repRange}>
                  {plannedExercise.targetSets} sets × {plannedExercise.repRangeMin}-
                  {plannedExercise.repRangeMax} reps
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() =>
                navigation.navigate('ProgressionHistory', {
                  exercise,
                  dayType: session.dayType,
                })
              }
            >
              <Text style={styles.historyButtonIcon}>📊</Text>
              <Text style={styles.historyButtonText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Completed Sets */}
        {exerciseLog && exerciseLog.sets.length > 0 && (
          <View style={styles.setsContainer}>
            <Text style={styles.setsTitle}>Completed Sets</Text>
            <View style={styles.setsList}>
              {exerciseLog.sets.map((set, index) => (
                <View key={set.id} style={styles.setRow}>
                  {editingSetId === set.id ? (
                    // Edit mode
                    <>
                      <Text style={styles.setNumber}>Set {index + 1}</Text>
                      <View style={styles.editInputs}>
                        <TextInput
                          style={styles.editInput}
                          value={editWeight}
                          onChangeText={setEditWeight}
                          keyboardType="decimal-pad"
                          placeholder="kg"
                          placeholderTextColor={colors.gray400}
                        />
                        <Text style={styles.editSeparator}>×</Text>
                        <TextInput
                          style={styles.editInput}
                          value={editReps}
                          onChangeText={setEditReps}
                          keyboardType="number-pad"
                          placeholder="reps"
                          placeholderTextColor={colors.gray400}
                        />
                      </View>
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={handleSaveEdit}
                        >
                          <Text style={styles.saveButtonText}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={handleCancelEdit}
                        >
                          <Text style={styles.cancelButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    // View mode
                    <>
                      <Text style={styles.setNumber}>Set {index + 1}</Text>
                      <Text style={styles.setText}>
                        {set.weight}kg × {set.reps} reps
                      </Text>
                      <View style={styles.setActions}>
                        <TouchableOpacity
                          style={styles.editIconButton}
                          onPress={() => handleEditSet(set)}
                        >
                          <Text style={styles.editIconText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteIconButton}
                          onPress={() => handleDeleteSet(set.id)}
                        >
                          <Text style={styles.deleteIconText}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Log New Set */}
        <View style={styles.logSection}>
          <Text style={styles.logTitle}>Log Set</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                {aiRecommendation && (
                  <Text style={styles.aiRecommendation}>
                    AI: {aiRecommendation.weight}kg
                  </Text>
                )}
              </View>
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
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Reps</Text>
                {aiRecommendation && (
                  <Text style={styles.aiRecommendation}>
                    AI: {aiRecommendation.reps}
                  </Text>
                )}
              </View>
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
          {aiRecommendation && (
            <>
              <View style={styles.aiSourceBadge}>
                <Text style={styles.aiSourceText}>
                  {aiRecommendation.source === 'baseline' && '📊 Based on your history'}
                  {aiRecommendation.source === 'progression' && '💪 Progressive overload'}
                  {aiRecommendation.source === 'deload' && '🔄 Deload week'}
                  {aiRecommendation.source === 'plateau_recovery' && '⚡ Rebuilding strength'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.overrideButton}
                onPress={handleOpenOverride}
              >
                <Text style={styles.overrideButtonText}>✎ Override AI Recommendation</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[styles.logButton, (!weight || !reps) && styles.logButtonDisabled]}
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
            <TouchableOpacity style={styles.skipRestButton} onPress={handleSkipRest}>
              <Text style={styles.skipRestButtonText}>Skip Rest</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Override AI Recommendation Modal */}
      <Modal
        visible={showOverrideModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOverrideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Override AI Recommendation</Text>
            <Text style={styles.modalSubtitle}>
              Set custom weight and reps for {exercise.name}
            </Text>

            <View style={styles.modalInputRow}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={overrideWeight}
                  onChangeText={setOverrideWeight}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.gray400}
                />
              </View>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Reps</Text>
                <TextInput
                  style={styles.modalInput}
                  value={overrideReps}
                  onChangeText={setOverrideReps}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.gray400}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowOverrideModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveOverride}
              >
                <Text style={styles.modalSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  imageContainer: {
    width: '100%',
    height: 280,
    backgroundColor: colors.gray100,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.xl * 2,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  historyButton: {
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 70,
  },
  historyButtonIcon: {
    fontSize: typography.fontSize.xl,
    marginBottom: spacing.xs / 2,
  },
  historyButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  target: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: spacing.xs,
  },
  repRange: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  setsContainer: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  setsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  setsList: {
    // No max height needed since parent scrolls
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  setNumber: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    minWidth: 60,
  },
  setText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  setActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  editIconButton: {
    padding: spacing.xs,
  },
  editIconText: {
    fontSize: typography.fontSize.lg,
    color: colors.primary,
  },
  deleteIconButton: {
    padding: spacing.xs,
  },
  deleteIconText: {
    fontSize: typography.fontSize.lg,
    color: colors.error,
  },
  editInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    padding: spacing.xs,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  editSeparator: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  cancelButton: {
    backgroundColor: colors.gray300,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  logSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  aiRecommendation: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  aiSourceBadge: {
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  aiSourceText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
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
  logButtonDisabled: {
    opacity: 0.5,
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
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
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
  skipRestButton: {
    backgroundColor: colors.gray100,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  skipRestButtonText: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  overrideButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  overrideButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalInputGroup: {
    flex: 1,
  },
  modalInputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.gray200,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
