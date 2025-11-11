/**
 * Edit Session Screen
 * Edit exercises and sets in a completed session
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, getDayTypeDisplayName } from '../theme';
import { useModal } from '../contexts/ModalContext';
import { GymSession, ExerciseLog, SetLog, Exercise } from '../models/types';
import {
  loadGymSessionById,
  saveGymSession,
  loadExerciseCatalog,
  loadWorkoutPlan,
} from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'EditSession'>;

export default function EditSessionScreen({ navigation, route }: Props) {
  const { sessionId } = route.params;
  const { showSuccess, showError, showModal } = useModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<GymSession | null>(null);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const [loadedSession, catalog, plan] = await Promise.all([
        loadGymSessionById(sessionId),
        loadExerciseCatalog(),
        loadWorkoutPlan(),
      ]);

      if (!loadedSession) {
        showError('Error', 'Session not found');
        navigation.goBack();
        return;
      }

      // Create exercise name lookup
      const names: Record<string, string> = {};
      catalog?.exercises.forEach((ex) => {
        names[ex.id] = ex.name;
      });

      // Get exercises for this day type
      const dayPlan = plan?.plans[loadedSession.dayType];
      const available = catalog?.exercises.filter((ex) =>
        dayPlan?.exercises.some((pe) => pe.exerciseId === ex.id)
      ) || [];

      setSession(loadedSession);
      setExerciseNames(names);
      setAvailableExercises(available);
      setLoading(false);
    } catch (error) {
      console.error('Error loading session:', error);
      showError('Error', 'Failed to load session');
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!session) return;

    try {
      setSaving(true);

      // Recalculate best set for each exercise
      const updatedExercises = session.exercises.map((ex) => {
        const bestSet =
          ex.sets.length > 0
            ? ex.sets.reduce((best, current) =>
                current.weight * current.reps > best.weight * best.reps ? current : best
              )
            : undefined;

        return {
          ...ex,
          bestSet,
        };
      });

      const updatedSession: GymSession = {
        ...session,
        exercises: updatedExercises,
      };

      await saveGymSession(updatedSession);
      showSuccess('Saved', 'Session updated successfully');
      setSaving(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving session:', error);
      showError('Error', 'Failed to save session');
      setSaving(false);
    }
  };

  const updateSetValue = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
    if (!session) return;

    const numValue = parseFloat(value) || 0;
    const updatedExercises = [...session.exercises];
    const updatedSets = [...updatedExercises[exerciseIndex].sets];
    updatedSets[setIndex] = {
      ...updatedSets[setIndex],
      [field]: numValue,
    };
    updatedExercises[exerciseIndex] = {
      ...updatedExercises[exerciseIndex],
      sets: updatedSets,
    };

    setSession({
      ...session,
      exercises: updatedExercises,
    });
  };

  const deleteSet = (exerciseIndex: number, setIndex: number) => {
    if (!session) return;

    const updatedExercises = [...session.exercises];
    const updatedSets = [...updatedExercises[exerciseIndex].sets];
    updatedSets.splice(setIndex, 1);
    updatedExercises[exerciseIndex] = {
      ...updatedExercises[exerciseIndex],
      sets: updatedSets,
    };

    setSession({
      ...session,
      exercises: updatedExercises,
    });
  };

  const addSet = (exerciseIndex: number) => {
    if (!session) return;

    const updatedExercises = [...session.exercises];
    const lastSet = updatedExercises[exerciseIndex].sets[updatedExercises[exerciseIndex].sets.length - 1];

    const newSet: SetLog = {
      id: `${Date.now()}-${Math.random()}`,
      weight: lastSet?.weight || 0,
      reps: lastSet?.reps || 0,
      timestamp: new Date().toISOString(),
    };

    updatedExercises[exerciseIndex] = {
      ...updatedExercises[exerciseIndex],
      sets: [...updatedExercises[exerciseIndex].sets, newSet],
    };

    setSession({
      ...session,
      exercises: updatedExercises,
    });
  };

  const deleteExercise = (exerciseIndex: number) => {
    if (!session) return;

    const exerciseName = exerciseNames[session.exercises[exerciseIndex].exerciseId] || 'this exercise';

    showModal({
      type: 'warning',
      title: 'Delete Exercise?',
      message: `Remove ${exerciseName} from this session? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedExercises = [...session.exercises];
            updatedExercises.splice(exerciseIndex, 1);
            setSession({
              ...session,
              exercises: updatedExercises,
            });
          },
        },
      ],
    });
  };

  const addExercise = () => {
    if (!session || availableExercises.length === 0) return;

    const exerciseButtons = availableExercises.slice(0, 8).map((ex) => ({
      text: ex.name,
      style: 'default' as const,
      onPress: () => {
        const newExercise: ExerciseLog = {
          exerciseId: ex.id,
          sets: [],
          bestSet: undefined,
        };

        setSession({
          ...session,
          exercises: [...session.exercises, newExercise],
        });
      },
    }));

    showModal({
      type: 'info',
      title: 'Add Exercise',
      message: 'Select an exercise to add to this session',
      buttons: [
        ...exerciseButtons,
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
      ],
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Session not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Session Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {getDayTypeDisplayName(session.dayType)} Day
          </Text>
          <Text style={styles.headerDate}>
            {format(new Date(session.date), 'EEEE, MMM d, yyyy')}
          </Text>
        </View>

        {/* Exercises */}
        {session.exercises.map((exerciseLog, exerciseIndex) => (
          <View key={exerciseIndex} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>
                {exerciseNames[exerciseLog.exerciseId] || exerciseLog.exerciseId.replace(/_/g, ' ')}
              </Text>
              <TouchableOpacity
                onPress={() => deleteExercise(exerciseIndex)}
                style={styles.deleteExerciseButton}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>

            {/* Sets */}
            {exerciseLog.sets.map((set, setIndex) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={styles.setNumber}>Set {setIndex + 1}</Text>
                <View style={styles.setInputs}>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={styles.input}
                      value={set.weight.toString()}
                      onChangeText={(value) =>
                        updateSetValue(exerciseIndex, setIndex, 'weight', value)
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.gray400}
                    />
                    <Text style={styles.inputLabel}>kg</Text>
                  </View>
                  <Text style={styles.inputSeparator}>×</Text>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={styles.input}
                      value={set.reps.toString()}
                      onChangeText={(value) =>
                        updateSetValue(exerciseIndex, setIndex, 'reps', value)
                      }
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.gray400}
                    />
                    <Text style={styles.inputLabel}>reps</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => deleteSet(exerciseIndex, setIndex)}
                  style={styles.deleteSetButton}
                >
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Set Button */}
            <TouchableOpacity
              style={styles.addSetButton}
              onPress={() => addSet(exerciseIndex)}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.addSetButtonText}>Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Exercise Button */}
        <TouchableOpacity style={styles.addExerciseButton} onPress={addExercise}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
          <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
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
  },
  contentContainer: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.error,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  headerDate: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  exerciseName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  deleteExerciseButton: {
    padding: spacing.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  setNumber: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    width: 50,
  },
  setInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  inputSeparator: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
  },
  deleteSetButton: {
    padding: spacing.xs,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  addSetButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addExerciseButtonText: {
    fontSize: typography.fontSize.lg,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
});
