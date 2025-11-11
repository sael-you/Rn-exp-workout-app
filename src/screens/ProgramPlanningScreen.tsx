/**
 * Program Planning Screen
 * Monthly calendar view with flexible weekly scheduling
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import { useModal } from '../contexts/ModalContext';
import { DayType, WorkoutPlan, Exercise } from '../models/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { loadMonthlySchedule, saveMonthlySchedule, loadGymSessions, loadOutdoorSessions, loadWorkoutPlan, loadExerciseCatalog } from '../services/storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface DaySchedule {
  date: string; // YYYY-MM-DD
  dayType: DayType;
  completed: boolean;
}

export default function ProgramPlanningScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { showSuccess } = useModal();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'exercises' | 'change'>('calendar');
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadScheduleForMonth();
  }, [currentMonth]);

  const loadInitialData = async () => {
    console.log('[ProgramScreen] Loading initial data...');
    const [plan, catalog] = await Promise.all([
      loadWorkoutPlan(),
      loadExerciseCatalog(),
    ]);
    console.log('[ProgramScreen] Data loaded:', {
      hasPlan: !!plan,
      planId: plan?.id,
      planName: plan?.name,
      pushExercises: plan?.plans?.Push?.exercises?.length,
      pullExercises: plan?.plans?.Pull?.exercises?.length,
      upper2Exercises: plan?.plans?.Upper2?.exercises?.length,
      exercisesCount: catalog?.exercises?.length,
    });
    if (plan) {
      console.log('[ProgramScreen] Push day exercises:', plan.plans.Push.exercises);
      console.log('[ProgramScreen] Pull day exercises:', plan.plans.Pull.exercises);
      console.log('[ProgramScreen] Upper2 day exercises:', plan.plans.Upper2.exercises);
    } else {
      console.log('[ProgramScreen] No workout plan found!');
    }
    setWorkoutPlan(plan);
    setExercises(catalog?.exercises || []);
  };

  const loadScheduleForMonth = async () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Load saved schedule
    const savedSchedule = await loadMonthlySchedule();

    // Load completed sessions to mark as done
    const gymSessions = await loadGymSessions();
    const outdoorSessions = await loadOutdoorSessions();

    // Generate default schedule for the month
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const monthSchedule: DaySchedule[] = days.map((date) => {
      const dateString = format(date, 'yyyy-MM-dd');
      const dayOfWeek = getDay(date);

      // Check if there's a saved custom schedule for this day
      const savedDay = savedSchedule?.find((s) => s.date === dateString);
      if (savedDay) {
        // Check if completed
        const isCompleted =
          (savedDay.dayType !== 'Outdoor' && gymSessions?.some((s) => s.date === dateString && s.completed)) ||
          (savedDay.dayType === 'Outdoor' && outdoorSessions?.some((s) => s.date === dateString && s.completed));

        return {
          ...savedDay,
          completed: isCompleted,
        };
      }

      // Default schedule: Mon=Push, Wed=Pull, Fri=Upper2, Sun=Outdoor
      let defaultDayType: DayType = 'Rest';
      if (dayOfWeek === 1) defaultDayType = 'Push';
      else if (dayOfWeek === 3) defaultDayType = 'Pull';
      else if (dayOfWeek === 5) defaultDayType = 'Upper2';
      else if (dayOfWeek === 0) defaultDayType = 'Outdoor';

      const isCompleted =
        (defaultDayType !== 'Outdoor' && defaultDayType !== 'Rest' && gymSessions?.some((s) => s.date === dateString && s.completed)) ||
        (defaultDayType === 'Outdoor' && outdoorSessions?.some((s) => s.date === dateString && s.completed));

      return {
        date: dateString,
        dayType: defaultDayType,
        completed: isCompleted,
      };
    });

    setSchedule(monthSchedule);
  };

  const handleDayPress = (dateString: string) => {
    const daySchedule = schedule.find((s) => s.date === dateString);
    if (!daySchedule) return;

    // Show action options for gym days
    if (daySchedule.dayType !== 'Rest' && daySchedule.dayType !== 'Outdoor') {
      setSelectedDay(dateString);
      setViewMode('calendar'); // Show action selector
    } else {
      // For rest/outdoor days, just allow changing
      setSelectedDay(dateString);
      setViewMode('change');
    }
  };

  const handleViewExercises = () => {
    setViewMode('exercises');
  };

  const handleChangeMode = () => {
    setViewMode('change');
  };

  const handleChangeDayType = async (newType: DayType) => {
    if (!selectedDay) return;

    const updatedSchedule = schedule.map((day) =>
      day.date === selectedDay ? { ...day, dayType: newType } : day
    );

    setSchedule(updatedSchedule);
    await saveMonthlySchedule(updatedSchedule);
    setSelectedDay(null);
    setViewMode('calendar');

    showSuccess('Updated', `Day changed to ${newType}`);
  };

  const handleCloseModal = () => {
    setSelectedDay(null);
    setViewMode('calendar');
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const getDayColor = (dayType: DayType) => {
    switch (dayType) {
      case 'Push':
        return colors.dayPush;
      case 'Pull':
        return colors.dayPull;
      case 'Upper2':
        return colors.dayUpper;
      case 'Outdoor':
        return colors.dayOutdoor;
      case 'Rest':
        return colors.gray300;
      default:
        return colors.gray300;
    }
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    days.forEach((day, index) => {
      currentWeek.push(day);
      if ((index + 1) % 7 === 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    return (
      <View style={styles.calendar}>
        {/* Day headers */}
        <View style={styles.weekHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Text key={day} style={styles.dayHeaderText}>
              {day}
            </Text>
          ))}
        </View>

        {/* Weeks */}
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {week.map((day) => {
              const dateString = format(day, 'yyyy-MM-dd');
              const daySchedule = schedule.find((s) => s.date === dateString);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay === dateString;

              return (
                <TouchableOpacity
                  key={dateString}
                  style={[
                    styles.day,
                    !isCurrentMonth && styles.dayOtherMonth,
                    isToday && styles.dayToday,
                    isSelected && styles.daySelected,
                  ]}
                  onPress={() => isCurrentMonth && handleDayPress(dateString)}
                  disabled={!isCurrentMonth}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !isCurrentMonth && styles.dayNumberOtherMonth,
                      isToday && styles.dayNumberToday,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>

                  {daySchedule && isCurrentMonth && (
                    <View
                      style={[
                        styles.dayIndicator,
                        { backgroundColor: getDayColor(daySchedule.dayType) },
                        daySchedule.completed && styles.dayIndicatorCompleted,
                      ]}
                    >
                      {daySchedule.completed && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                      {!daySchedule.completed && daySchedule.dayType !== 'Rest' && (
                        <Text style={styles.dayTypeAbbrev}>
                          {daySchedule.dayType === 'Push' ? 'P' :
                           daySchedule.dayType === 'Pull' ? 'Pl' :
                           daySchedule.dayType === 'Upper2' ? 'U' :
                           daySchedule.dayType === 'Outdoor' ? 'O' : ''}
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const handleViewAndEdit = () => {
    if (!selectedDay) return;
    const daySchedule = schedule.find((s) => s.date === selectedDay);
    if (!daySchedule) return;

    const dayType = daySchedule.dayType;
    if (dayType !== 'Rest' && dayType !== 'Outdoor') {
      navigation.navigate('EditPlan', { dayType });
    }
  };

  const renderActionSelector = () => {
    if (!selectedDay || viewMode !== 'calendar') return null;

    const daySchedule = schedule.find((s) => s.date === selectedDay);
    if (!daySchedule) return null;

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.actionModal}>
          <Text style={styles.modalTitle}>
            {format(new Date(selectedDay), 'MMMM d')} - {daySchedule.dayType} Day
          </Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleViewAndEdit}
          >
            <Text style={styles.actionButtonText}>📋 View & Edit Program</Text>
            <Text style={styles.actionButtonSubtext}>
              See and customize AI-selected exercises
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleChangeMode}
          >
            <Text style={styles.actionButtonText}>🔄 Change Day Type</Text>
            <Text style={styles.actionButtonSubtext}>
              Switch to different workout type
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCloseModal}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDayTypeSelector = () => {
    if (!selectedDay || viewMode !== 'change') return null;

    const daySchedule = schedule.find((s) => s.date === selectedDay);
    if (!daySchedule) return null;

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.dayTypeSelector}>
          <Text style={styles.selectorTitle}>
            Change {format(new Date(selectedDay), 'MMM d')} to:
          </Text>
          <View style={styles.dayTypeButtons}>
            {(['Push', 'Pull', 'Upper2', 'Outdoor', 'Rest'] as DayType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.dayTypeButton,
                  { borderColor: getDayColor(type) },
                  daySchedule.dayType === type && { backgroundColor: getDayColor(type) },
                ]}
                onPress={() => handleChangeDayType(type)}
              >
                <Text
                  style={[
                    styles.dayTypeButtonText,
                    daySchedule.dayType === type && styles.dayTypeButtonTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCloseModal}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderExercisesModal = () => {
    if (!selectedDay || viewMode !== 'exercises') return null;

    const daySchedule = schedule.find((s) => s.date === selectedDay);
    if (!daySchedule || !workoutPlan) return null;

    const dayType = daySchedule.dayType;
    if (dayType === 'Rest' || dayType === 'Outdoor') return null;

    const dayPlan = workoutPlan.plans[dayType];
    console.log('[Modal] Rendering exercises modal for', dayType);
    console.log('[Modal] Day plan:', dayPlan);
    console.log('[Modal] Day plan exercises:', dayPlan?.exercises);
    console.log('[Modal] Available exercises count:', exercises.length);

    if (!dayPlan) {
      return (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.exerciseModal}>
              <Text style={styles.modalTitle}>No Program Found</Text>
              <Text style={styles.noProgramText}>
                No AI-generated program found for {dayType} day. Please set up your AI coach in Settings.
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }

    return (
      <Modal visible transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.exerciseModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {format(new Date(selectedDay), 'MMMM d')} - {dayType} Day
              </Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeIconButton}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.exerciseList}>
              {dayPlan.exercises.map((plannedEx, index) => {
                console.log('[Modal] Looking for exercise:', plannedEx.exerciseId);
                const exercise = exercises.find((ex) => ex.id === plannedEx.exerciseId);
                console.log('[Modal] Found exercise?', !!exercise, exercise?.name);
                if (!exercise) {
                  console.log('[Modal] Exercise not found, skipping:', plannedEx.exerciseId);
                  return null;
                }

                return (
                  <View key={plannedEx.exerciseId} style={styles.exerciseItem}>
                    <View style={styles.exerciseNumber}>
                      <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.exerciseDetails}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseTarget}>
                        {exercise.target} • {exercise.equipment}
                      </Text>
                      <Text style={styles.exerciseSpecs}>
                        {plannedEx.targetSets} sets × {plannedEx.repRangeMin}-{plannedEx.repRangeMax} reps
                      </Text>
                      {plannedEx.notes && (
                        <Text style={styles.exerciseNotes}>{plannedEx.notes}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderStats = () => {
    const monthSchedule = schedule.filter(
      (day) => new Date(day.date).getMonth() === currentMonth.getMonth()
    );
    const totalWorkouts = monthSchedule.filter((day) => day.dayType !== 'Rest').length;
    const completedWorkouts = monthSchedule.filter((day) => day.completed && day.dayType !== 'Rest').length;
    const adherence = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

    const pushDays = monthSchedule.filter((day) => day.dayType === 'Push').length;
    const pullDays = monthSchedule.filter((day) => day.dayType === 'Pull').length;
    const upper2Days = monthSchedule.filter((day) => day.dayType === 'Upper2').length;
    const outdoorDays = monthSchedule.filter((day) => day.dayType === 'Outdoor').length;

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Monthly Overview</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{completedWorkouts}/{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{adherence}%</Text>
            <Text style={styles.statLabel}>Adherence</Text>
          </View>
        </View>

        <View style={styles.dayTypeCounts}>
          <View style={styles.countItem}>
            <View style={[styles.countDot, { backgroundColor: colors.dayPush }]} />
            <Text style={styles.countText}>Push: {pushDays}</Text>
          </View>
          <View style={styles.countItem}>
            <View style={[styles.countDot, { backgroundColor: colors.dayPull }]} />
            <Text style={styles.countText}>Pull: {pullDays}</Text>
          </View>
          <View style={styles.countItem}>
            <View style={[styles.countDot, { backgroundColor: colors.dayUpper }]} />
            <Text style={styles.countText}>Upper2: {upper2Days}</Text>
          </View>
          <View style={styles.countItem}>
            <View style={[styles.countDot, { backgroundColor: colors.dayOutdoor }]} />
            <Text style={styles.countText}>Outdoor: {outdoorDays}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Month Navigator */}
        <View style={styles.monthNavigator}>
          <TouchableOpacity onPress={handlePreviousMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar */}
        {renderCalendar()}

        {/* Stats */}
        {renderStats()}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to use:</Text>
          <Text style={styles.instructionsText}>
            • Tap any gym day to view AI-selected exercises{'\n'}
            • Tap any day to change its workout type{'\n'}
            • Default schedule: Mon=Push, Wed=Pull, Fri=Upper2, Sun=Outdoor{'\n'}
            • Completed workouts show a checkmark
          </Text>
        </View>
      </ScrollView>

      {/* Modals */}
      {renderActionSelector()}
      {renderDayTypeSelector()}
      {renderExercisesModal()}
    </View>
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
    padding: spacing.md,
  },
  monthNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  navButton: {
    padding: spacing.md,
  },
  navButtonText: {
    fontSize: typography.fontSize['2xl'],
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  monthTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  calendar: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  week: {
    flexDirection: 'row',
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 2,
  },
  dayOtherMonth: {
    opacity: 0.3,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  daySelected: {
    backgroundColor: colors.primary + '20',
  },
  dayNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  dayNumberOtherMonth: {
    color: colors.textSecondary,
  },
  dayNumberToday: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  dayIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayIndicatorCompleted: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  dayTypeAbbrev: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  statsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statsTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginBottom: spacing.xs / 2,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  dayTypeCounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  countDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  countText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  instructions: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
  },
  instructionsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  instructionsText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * 1.6,
  },
  dayTypeSelector: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  selectorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  dayTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dayTypeButton: {
    flex: 1,
    minWidth: 80,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  dayTypeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  dayTypeButtonTextSelected: {
    color: colors.white,
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
  exerciseModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  closeIconButton: {
    padding: spacing.xs,
  },
  closeIcon: {
    fontSize: typography.fontSize.xl,
    color: colors.textSecondary,
  },
  exerciseList: {
    flex: 1,
    marginBottom: spacing.md,
  },
  exerciseItem: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  exerciseNumberText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  exerciseDetails: {
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
    marginBottom: spacing.xs / 2,
    textTransform: 'capitalize',
  },
  exerciseSpecs: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  exerciseNotes: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  closeButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  noProgramText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: typography.fontSize.base * 1.5,
  },
});
