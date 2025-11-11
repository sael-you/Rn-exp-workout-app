/**
 * Edit Plan Screen
 * Customize workout plans - add/remove exercises, adjust sets/reps
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import { useModal } from '../contexts/ModalContext';
import {
  WorkoutPlan,
  Exercise,
  PlannedExercise,
} from '../models/types';
import {
  loadWorkoutPlan,
  saveWorkoutPlan,
  loadExerciseCatalog,
} from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'EditPlan'>;

export default function EditPlanScreen({ route, navigation }: Props) {
  const { dayType } = route.params;
  const { showModal, showConfirm } = useModal();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState('');
  const [editRepMin, setEditRepMin] = useState('');
  const [editRepMax, setEditRepMax] = useState('');

  useEffect(() => {
    loadPlanData();
  }, []);

  const loadPlanData = async () => {
    try {
      const [workoutPlan, catalog] = await Promise.all([
        loadWorkoutPlan(),
        loadExerciseCatalog(),
      ]);

      if (workoutPlan && catalog) {
        setPlan(workoutPlan);
        setExercises(catalog.exercises);
        setPlannedExercises(workoutPlan.plans[dayType].exercises);
      }
    } catch (error) {
      console.error('Error loading plan:', error);
    }
  };

  const handleAddExercise = (exercise: Exercise) => {
    const newPlannedExercise: PlannedExercise = {
      exerciseId: exercise.id,
      order: plannedExercises.length,
      targetSets: 3,
      repRangeMin: 8,
      repRangeMax: 12,
    };

    setPlannedExercises([...plannedExercises, newPlannedExercise]);
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  const handleRemoveExercise = (exerciseId: string) => {
    showConfirm(
      'Remove Exercise',
      'Are you sure you want to remove this exercise from your plan?',
      () => {
        const updated = plannedExercises
          .filter((pe) => pe.exerciseId !== exerciseId)
          .map((pe, index) => ({ ...pe, order: index }));
        setPlannedExercises(updated);
      }
    );
  };

  const handleEditExercise = (pe: PlannedExercise) => {
    setEditingExerciseId(pe.exerciseId);
    setEditSets(pe.targetSets.toString());
    setEditRepMin(pe.repRangeMin.toString());
    setEditRepMax(pe.repRangeMax.toString());
  };

  const handleSaveEdit = () => {
    if (!editingExerciseId || !editSets || !editRepMin || !editRepMax) return;

    const updated = plannedExercises.map((pe) =>
      pe.exerciseId === editingExerciseId
        ? {
            ...pe,
            targetSets: parseInt(editSets, 10),
            repRangeMin: parseInt(editRepMin, 10),
            repRangeMax: parseInt(editRepMax, 10),
          }
        : pe
    );

    setPlannedExercises(updated);
    setEditingExerciseId(null);
    setEditSets('');
    setEditRepMin('');
    setEditRepMax('');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...plannedExercises];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updated.forEach((pe, i) => (pe.order = i));
    setPlannedExercises(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === plannedExercises.length - 1) return;
    const updated = [...plannedExercises];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated.forEach((pe, i) => (pe.order = i));
    setPlannedExercises(updated);
  };

  const handleSavePlan = async () => {
    if (!plan) return;

    const updatedPlan = {
      ...plan,
      plans: {
        ...plan.plans,
        [dayType]: {
          ...plan.plans[dayType],
          exercises: plannedExercises,
        },
      },
    };

    await saveWorkoutPlan(updatedPlan);
    showModal({
      type: 'success',
      title: 'Success',
      message: 'Workout plan updated!',
      buttons: [
        { text: 'Done', onPress: () => navigation.goBack(), style: 'primary' },
      ],
    });
  };

  const getExerciseById = (id: string) => {
    return exercises.find((ex) => ex.id === id);
  };

  const filteredExercises = exercises.filter((ex) => {
    const query = searchQuery.toLowerCase();
    return (
      ex.name.toLowerCase().includes(query) ||
      ex.target.toLowerCase().includes(query) ||
      ex.bodyPart.toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Edit {dayType} Day</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSavePlan}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Planned Exercises */}
        {plannedExercises.map((pe, index) => {
          const exercise = getExerciseById(pe.exerciseId);
          if (!exercise) return null;

          return (
            <View key={pe.exerciseId} style={styles.exerciseCard}>
              {editingExerciseId === pe.exerciseId ? (
                // Edit mode
                <View style={styles.editMode}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <View style={styles.editInputs}>
                    <View style={styles.editGroup}>
                      <Text style={styles.editLabel}>Sets</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editSets}
                        onChangeText={setEditSets}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.editGroup}>
                      <Text style={styles.editLabel}>Min Reps</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editRepMin}
                        onChangeText={setEditRepMin}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.editGroup}>
                      <Text style={styles.editLabel}>Max Reps</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editRepMax}
                        onChangeText={setEditRepMax}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.saveEditButton}
                      onPress={handleSaveEdit}
                    >
                      <Text style={styles.saveEditButtonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelEditButton}
                      onPress={() => setEditingExerciseId(null)}
                    >
                      <Text style={styles.cancelEditButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // View mode
                <>
                  <View style={styles.exerciseHeader}>
                    <View style={styles.exerciseOrder}>
                      <Text style={styles.exerciseOrderText}>{index + 1}</Text>
                    </View>
                    {exercise.imageUrl && (
                      <Image
                        source={{ uri: exercise.imageUrl }}
                        style={styles.exerciseThumbnail}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseTarget}>{exercise.target}</Text>
                      <Text style={styles.exerciseDetails}>
                        {pe.targetSets} sets × {pe.repRangeMin}-{pe.repRangeMax} reps
                      </Text>
                    </View>
                  </View>
                  <View style={styles.exerciseActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleMoveUp(index)}
                      disabled={index === 0}
                    >
                      <Text style={[styles.actionIcon, index === 0 && styles.actionDisabled]}>
                        ↑
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleMoveDown(index)}
                      disabled={index === plannedExercises.length - 1}
                    >
                      <Text
                        style={[
                          styles.actionIcon,
                          index === plannedExercises.length - 1 && styles.actionDisabled,
                        ]}
                      >
                        ↓
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditExercise(pe)}
                    >
                      <Text style={styles.actionIcon}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleRemoveExercise(pe.exerciseId)}
                    >
                      <Text style={[styles.actionIcon, styles.deleteIcon]}>×</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          );
        })}

        {/* Add Exercise Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowExercisePicker(true)}
        >
          <Text style={styles.addButtonText}>+ Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise Picker Modal */}
      <Modal
        visible={showExercisePicker}
        animationType="slide"
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.gray400}
          />

          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            renderItem={({ item: exercise }) => (
              <TouchableOpacity
                style={styles.exerciseListItem}
                onPress={() => handleAddExercise(exercise)}
              >
                {exercise.imageUrl && (
                  <Image
                    source={{ uri: exercise.imageUrl }}
                    style={styles.exerciseListImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.exerciseListInfo}>
                  <Text style={styles.exerciseListName}>{exercise.name}</Text>
                  <Text style={styles.exerciseListTarget}>
                    {exercise.target} • {exercise.equipment}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  exerciseHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  exerciseOrder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  exerciseThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: spacing.md,
    backgroundColor: colors.gray100,
  },
  exerciseOrderText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  exerciseTarget: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: spacing.xs / 2,
  },
  exerciseDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  exerciseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
  },
  actionIcon: {
    fontSize: typography.fontSize.xl,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  actionDisabled: {
    color: colors.gray300,
  },
  deleteIcon: {
    color: colors.error,
  },
  editMode: {
    gap: spacing.md,
  },
  editInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editGroup: {
    flex: 1,
  },
  editLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  editInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    padding: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveEditButton: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveEditButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  cancelEditButton: {
    flex: 1,
    backgroundColor: colors.gray300,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelEditButtonText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: typography.fontSize['2xl'],
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
  },
  searchInput: {
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: spacing.md,
    margin: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  exerciseList: {
    flex: 1,
  },
  exerciseListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  exerciseListImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: spacing.md,
    backgroundColor: colors.gray100,
  },
  exerciseListInfo: {
    flex: 1,
  },
  exerciseListName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  exerciseListTarget: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
});
