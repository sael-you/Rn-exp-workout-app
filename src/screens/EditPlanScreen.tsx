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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, getDayTypeDisplayName } from '../theme';
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
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDayType, setFilterDayType] = useState<typeof dayType | 'All'>(dayType);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState('');
  const [editRepMin, setEditRepMin] = useState('');
  const [editRepMax, setEditRepMax] = useState('');

  useEffect(() => {
    loadPlanData();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSavePlan} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Save</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, plannedExercises]);

  const loadPlanData = async () => {
    try {
      const [workoutPlan, catalog] = await Promise.all([
        loadWorkoutPlan(),
        loadExerciseCatalog(),
      ]);

      if (workoutPlan && catalog) {
        setPlan(workoutPlan);
        setExercises(catalog.exercises);
        setPlannedExercises(workoutPlan.plans[dayType]?.exercises || []);
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
    setFilterDayType(dayType); // Reset to current day type
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

  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipment)
        ? prev.filter((e) => e !== equipment)
        : [...prev, equipment]
    );
  };

  const getBodyPartsForDayType = (dt: typeof dayType | 'All'): string[] => {
    if (dt === 'All') return [];

    const mapping: Record<string, string[]> = {
      // Muscle group split
      Push: ['chest', 'shoulders', 'triceps'],
      Pull: ['back', 'lats', 'biceps'],
      Upper2: ['chest', 'shoulders', 'triceps', 'back', 'lats', 'biceps', 'forearms', 'traps', 'abs'],
      // Body part split
      Chest: ['chest', 'pectorals'],
      Back: ['back', 'lats', 'traps'],
      Shoulders: ['shoulders', 'delts'],
      Arms: ['biceps', 'triceps', 'forearms'],
      // Common
      Legs: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
    };

    return mapping[dt] || [];
  };

  // Sort equipment list: selected items first
  const sortedEquipment = React.useMemo(() => {
    const allEquipment = [
      'Barbell',
      'Dumbbell',
      'Machine',
      'Cable',
      'Bodyweight',
      'Kettlebell',
      'Bands',
      'E-Z Curl Bar',
    ];

    const selected = allEquipment.filter(eq => selectedEquipment.includes(eq));
    const unselected = allEquipment.filter(eq => !selectedEquipment.includes(eq));

    return [...selected, ...unselected];
  }, [selectedEquipment]);

  const filteredExercises = exercises.filter((ex) => {
    // Text search filter
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || (
      ex.name.toLowerCase().includes(query) ||
      ex.target.toLowerCase().includes(query) ||
      ex.bodyPart.toLowerCase().includes(query)
    );

    // Day type filter
    const matchesDayType = filterDayType === 'All' ? true : (() => {
      const relevantBodyParts = getBodyPartsForDayType(filterDayType);
      return relevantBodyParts.some(
        (part) =>
          ex.bodyPart.toLowerCase().includes(part) ||
          ex.target.toLowerCase().includes(part)
      );
    })();

    // Equipment filter
    const matchesEquipment = selectedEquipment.length === 0 ||
      selectedEquipment.some((equip) =>
        ex.equipment.toLowerCase().includes(equip.toLowerCase())
      );

    return matchesSearch && matchesDayType && matchesEquipment;
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
      >
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
        onRequestClose={() => {
          setShowExercisePicker(false);
          setSearchQuery('');
          setFilterDayType(dayType);
          setSelectedEquipment([]);
        }}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            <TouchableOpacity
              onPress={() => {
                setShowExercisePicker(false);
                setSearchQuery('');
                setFilterDayType(dayType);
                setSelectedEquipment([]);
              }}
            >
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Equipment Filters */}
          <View style={[styles.equipmentFilterSection, styles.firstFilterSection]}>
            <Text style={styles.filterSectionTitle}>Equipment</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContainer}
            >
              {sortedEquipment.map((equip) => (
                <TouchableOpacity
                  key={equip}
                  style={[
                    styles.equipmentChip,
                    selectedEquipment.includes(equip) && styles.equipmentChipActive,
                  ]}
                  onPress={() => toggleEquipment(equip)}
                >
                  <Text
                    style={[
                      styles.equipmentChipText,
                      selectedEquipment.includes(equip) && styles.equipmentChipTextActive,
                    ]}
                  >
                    {equip}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Day Type Filters */}
          <View style={styles.dayTypeFilterSection}>
            <Text style={styles.filterSectionTitle}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContainer}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filterDayType === 'All' && styles.filterChipActive,
                ]}
                onPress={() => setFilterDayType('All')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterDayType === 'All' && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {['Push', 'Pull', 'Upper2', 'Legs', 'Chest', 'Back', 'Shoulders', 'Arms'].map((dt) => (
                <TouchableOpacity
                  key={dt}
                  style={[
                    styles.filterChip,
                    filterDayType === dt && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterDayType(dt as typeof dayType)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterDayType === dt && styles.filterChipTextActive,
                    ]}
                  >
                    {getDayTypeDisplayName(dt)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
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
  headerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: typography.fontSize['2xl'],
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing.sm,
  },
  filterContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
  searchInput: {
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
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
  equipmentFilterSection: {
    marginBottom: spacing.sm,
  },
  firstFilterSection: {
    marginTop: spacing.lg,
  },
  dayTypeFilterSection: {
    marginBottom: spacing.sm,
  },
  filterSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  equipmentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentChipActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  equipmentChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  equipmentChipTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
});
