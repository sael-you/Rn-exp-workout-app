/**
 * Home / Today Screen
 * Shows today's day type, habits, streaks, and Start button
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, getDayTypeColor } from '../theme';
import { useModal } from '../contexts/ModalContext';
import { DayType, WeeklyProgram, StreakData, Exercise } from '../models/types';
import {
  loadWeeklyProgram,
  loadStreaks,
  saveWeeklyProgram,
  saveStreaks,
  loadWorkoutPlan,
  saveWorkoutPlan,
  loadMonthlySchedule,
  loadGymSessions,
  loadOutdoorSessions,
} from '../services/storage';
import { initializeExerciseCatalog } from '../services/exerciseDB';
import { generateDefaultPlan } from '../services/defaultPlan';
import { checkForExerciseSwap, checkForAutoDeload } from '../services/aiProgression';

interface DaySchedule {
  date: string; // YYYY-MM-DD
  dayType: DayType;
  completed: boolean;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { showError } = useModal();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [todayType, setTodayType] = useState<DayType>('Rest');
  const [streaks, setStreaks] = useState<StreakData | null>(null);
  const [showPlanPreview, setShowPlanPreview] = useState(false);
  const [todayExercises, setTodayExercises] = useState<Exercise[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'exercises' | 'change'>('calendar');
  const [workoutPlan, setWorkoutPlan] = useState<any>(null);
  const [exerciseCatalog, setExerciseCatalog] = useState<Exercise[]>([]);

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    loadScheduleForMonth();
  }, [currentMonth]);

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

  const initializeApp = async () => {
    try {
      // Initialize exercise catalog
      const catalog = await initializeExerciseCatalog();
      setExerciseCatalog(catalog.exercises);

      // Load or create weekly program
      let program = await loadWeeklyProgram();
      if (!program) {
        program = createDefaultWeeklyProgram();
        await saveWeeklyProgram(program);
      }

      // Load or create workout plan
      let existingPlan = await loadWorkoutPlan();
      if (!existingPlan) {
        // Only create default plan if none exists
        const plan = generateDefaultPlan(catalog.exercises);
        await saveWorkoutPlan(plan);
        setWorkoutPlan(plan);
      } else {
        setWorkoutPlan(existingPlan);
      }

      // Determine today's day type
      const today = new Date().getDay();
      const todayTraining = program.trainingDays.find(
        (d) => d.dayOfWeek === today && d.enabled
      );
      setTodayType(todayTraining?.dayType || 'Rest');

      // Load streaks
      let streakData = await loadStreaks();
      if (!streakData) {
        streakData = {
          training: { current: 0, longest: 0, lastUpdated: new Date().toISOString() },
          outdoor: { current: 0, longest: 0, lastUpdated: new Date().toISOString() },
          habits: { current: 0, longest: 0, lastUpdated: new Date().toISOString() },
        };
        await saveStreaks(streakData);
      }
      setStreaks(streakData);

      // Load today's exercises if it's a workout day
      if (todayTraining && todayTraining.dayType !== 'Rest') {
        const workoutPlan = await loadWorkoutPlan();
        if (workoutPlan) {
          const dayPlan = workoutPlan.plans[todayTraining.dayType];
          if (dayPlan) {
            const dayExercises = dayPlan.exercises
              .sort((a, b) => a.order - b.order)
              .map((pe) => catalog.exercises.find((ex) => ex.id === pe.exerciseId))
              .filter(Boolean) as Exercise[];
            setTodayExercises(dayExercises);
          }
        }
      }

      // Check for auto-deload triggers (background)
      try {
        const deloadInsights = await checkForAutoDeload();
        if (deloadInsights.length > 0) {
          console.log('Auto-deload insights:', deloadInsights);
          // Insights are saved, user will see them in AI Coach screen
        }
      } catch (error) {
        console.error('Error checking for auto-deload:', error);
      }

      // Check for exercise swap needs
      try {
        const swapCheck = await checkForExerciseSwap();
        if (swapCheck.needsSwap && swapCheck.exerciseIds.length > 0) {
          // Alert user about exercises that need swapping
          setTimeout(() => {
            showError(
              '⚡ Plateau Detected',
              `Some exercises have plateaued despite deload attempts:\n\n${swapCheck.exerciseIds.map(id => `• ${id.replace(/_/g, ' ')}`).join('\n')}\n\nConsider visiting the AI Coach screen for alternative exercise suggestions.`
            );
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking for exercise swap:', error);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error initializing app:', error);
      setLoading(false);
    }
  };

  const createDefaultWeeklyProgram = (): WeeklyProgram => {
    return {
      trainingDays: [
        { id: '1', dayOfWeek: 1, dayType: 'Push', enabled: true },
        { id: '2', dayOfWeek: 3, dayType: 'Pull', enabled: true },
        { id: '3', dayOfWeek: 5, dayType: 'Upper2', enabled: true },
        { id: '4', dayOfWeek: 0, dayType: 'Outdoor', enabled: true },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleStartSession = () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    if (todayType === 'Outdoor') {
      navigation.navigate('OutdoorTimer', { date: today });
    } else if (todayType !== 'Rest') {
      navigation.navigate('SessionRunner', {
        dayType: todayType as 'Push' | 'Pull' | 'Upper2',
        date: today,
      });
    }
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
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

    const { saveMonthlySchedule } = require('../services/storage');
    const updatedSchedule = schedule.map((day) =>
      day.date === selectedDay ? { ...day, dayType: newType } : day
    );

    setSchedule(updatedSchedule);
    await saveMonthlySchedule(updatedSchedule);
    setSelectedDay(null);
    setViewMode('calendar');
  };

  const handleCloseModal = () => {
    setSelectedDay(null);
    setViewMode('calendar');
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
      <View style={styles.calendarContainer}>
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

                return (
                  <TouchableOpacity
                    key={dateString}
                    style={[
                      styles.day,
                      !isCurrentMonth && styles.dayOtherMonth,
                      isToday && styles.dayToday,
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
      </View>
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
            style={styles.modalActionButton}
            onPress={handleViewExercises}
          >
            <Text style={styles.modalActionButtonText}>📋 View Exercises</Text>
            <Text style={styles.actionButtonSubtext}>
              See AI-selected exercises for this day
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalActionButton}
            onPress={handleChangeMode}
          >
            <Text style={styles.modalActionButtonText}>🔄 Change Day Type</Text>
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
    if (!dayPlan) {
      return (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>No Program Found</Text>
              <Text style={styles.noProgramText}>
                No AI-generated program found for {dayType} day. Please generate a program in AI Coach.
              </Text>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { marginTop: spacing.md }]}
                onPress={handleCloseModal}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }

    // Get exercises for this day
    const dayExercises = dayPlan.exercises
      .map((pe: any) => exerciseCatalog.find((ex) => ex.id === pe.exerciseId))
      .filter(Boolean) as Exercise[];

    return (
      <Modal visible transparent animationType="slide" onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>
              {format(new Date(selectedDay), 'MMM d')} - {dayType} Workout
            </Text>
            <ScrollView style={styles.exerciseList}>
              {dayExercises.map((exercise, index) => (
                <View key={exercise.id} style={styles.exerciseItem}>
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                  </View>
                  {exercise.imageUrl && (
                    <Image
                      source={{ uri: exercise.imageUrl }}
                      style={styles.exerciseImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseTarget}>{exercise.target}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: spacing.md }]}
              onPress={handleCloseModal}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing your workout...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Date Header */}
      <View style={styles.header}>
        <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>

      {/* Today's Day Type Card */}
      <View style={[styles.dayCard, { borderLeftColor: getDayTypeColor(todayType) }]}>
        <View style={styles.dayCardHeader}>
          <Text style={styles.dayCardLabel}>Today's Workout</Text>
          <View
            style={[styles.dayTypeBadge, { backgroundColor: getDayTypeColor(todayType) }]}
          >
            <Text style={styles.dayTypeBadgeText}>{todayType}</Text>
          </View>
        </View>

        {todayType === 'Rest' ? (
          <Text style={styles.restMessage}>
            Rest day. Focus on recovery and habits.
          </Text>
        ) : (
          <>
            <Text style={styles.dayCardDescription}>
              {getDayDescription(todayType)}
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.viewPlanButton]}
                onPress={() => setShowPlanPreview(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewPlanButtonText}>View Plan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.startButton]}
                onPress={handleStartSession}
                activeOpacity={0.8}
              >
                <Text style={styles.startButtonText}>Start Session</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Monthly Program Calendar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Program Schedule</Text>
        {renderCalendar()}
        {renderStats()}
      </View>

      {/* Streaks Section */}
      {streaks && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Streaks</Text>
          <View style={styles.streaksContainer}>
            <StreakChip
              label="Training"
              current={streaks.training.current}
              unit="weeks"
              color={colors.primary}
            />
            <StreakChip
              label="Outdoor"
              current={streaks.outdoor.current}
              unit="weeks"
              color={colors.dayOutdoor}
            />
          </View>
        </View>
      )}

      {/* Exercise Plan Preview Modal */}
      <Modal
        visible={showPlanPreview}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlanPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Today's {todayType} Workout</Text>
            <ScrollView style={styles.exerciseList}>
              {todayExercises.map((exercise, index) => (
                <View key={exercise.id} style={styles.exerciseItem}>
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                  </View>
                  {exercise.imageUrl && (
                    <Image
                      source={{ uri: exercise.imageUrl }}
                      style={styles.exerciseImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseTarget}>{exercise.target}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSave, { marginTop: spacing.md }]}
              onPress={() => {
                setShowPlanPreview(false);
                handleStartSession();
              }}
            >
              <Text style={[styles.modalButtonText, { color: colors.white }]}>
                Start Workout
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: spacing.sm }]}
              onPress={() => setShowPlanPreview(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calendar Day Action Modals */}
      {renderActionSelector()}
      {renderDayTypeSelector()}
      {renderExercisesModal()}
    </ScrollView>
  );
}

function getDayDescription(dayType: DayType): string {
  switch (dayType) {
    case 'Push':
      return 'Chest, shoulders, and triceps';
    case 'Pull':
      return 'Back and biceps';
    case 'Upper2':
      return 'Full upper body mix';
    case 'Outdoor':
      return 'Legs, core, and cardio';
    default:
      return '';
  }
}

function StreakChip({
  label,
  current,
  unit,
  color,
}: {
  label: string;
  current: number;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.streakChip}>
      <Text style={styles.streakLabel}>{label}</Text>
      <Text style={[styles.streakValue, { color }]}>
        {current} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
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
  header: {
    marginBottom: spacing.lg,
  },
  dateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderLeftWidth: 4,
    marginBottom: spacing.lg,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dayCardLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: typography.fontWeight.semibold,
  },
  dayTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  dayTypeBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  dayCardDescription: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  restMessage: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewPlanButton: {
    backgroundColor: colors.gray200,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  viewPlanButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  startButton: {
    backgroundColor: colors.primary,
  },
  startButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  streaksContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  streakChip: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  streakLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  streakValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  habitsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  habitCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray300,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  habitCheckboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  habitCheckmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
  },
  habitLabel: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  habitValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.gray200,
  },
  modalButtonSave: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  exerciseList: {
    maxHeight: 400,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
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
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  exerciseImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: spacing.md,
    backgroundColor: colors.gray100,
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
  },
  hydrationCurrent: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  hydrationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  hydrationButton: {
    width: '48%',
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  hydrationButtonIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  hydrationButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  hydrationButtonAmount: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  aiCoachCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  aiCoachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiCoachIcon: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  aiCoachTextContainer: {
    flex: 1,
  },
  aiCoachTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  aiCoachSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  aiCoachArrow: {
    fontSize: 32,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.normal,
  },
  calendarContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
  },
  monthNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  navButton: {
    padding: spacing.sm,
  },
  navButtonText: {
    fontSize: typography.fontSize.xl,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  monthTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  calendar: {
    borderRadius: 8,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  week: {
    flexDirection: 'row',
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    padding: spacing.xs / 2,
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
  dayNumber: {
    fontSize: typography.fontSize.xs,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayIndicatorCompleted: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  dayTypeAbbrev: {
    color: colors.white,
    fontSize: 8,
    fontWeight: typography.fontWeight.bold,
  },
  statsContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  statsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginBottom: spacing.xs / 2,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
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
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
  },
  actionModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
  },
  modalActionButton: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  modalActionButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  actionButtonSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
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
  noProgramText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
  },
});
