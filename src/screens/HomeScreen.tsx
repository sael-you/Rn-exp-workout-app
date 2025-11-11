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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, getDayTypeColor, getDayTypeDisplayName } from '../theme';
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
  saveMonthlySchedule,
  loadGymSessions,
  loadOutdoorSessions,
  loadUserProfile,
} from '../services/storage';
import { initializeExerciseCatalog } from '../services/exerciseDB';
import { generateDefaultPlan } from '../services/defaultPlan';
import { checkForExerciseSwap, checkForAutoDeload } from '../services/aiProgression';
import {
  addNotificationResponseListener,
  scheduleRemindLaterNotification,
  scheduleDailyWorkoutReminder,
  checkAndScheduleMissedWorkoutNotification,
  cancelRemindLaterNotification,
} from '../services/notificationService';

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
  const [trainingSplit, setTrainingSplit] = useState<'muscle_group' | 'body_part'>('muscle_group');
  const [isTodayCompleted, setIsTodayCompleted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date().toDateString());

  useEffect(() => {
    initializeApp();

    // Setup notification response listener
    const subscription = addNotificationResponseListener((response) => {
      const { actionIdentifier, notification } = response;
      const { data } = notification.request.content;

      if (actionIdentifier === 'remind-later' || data.type === 'remind-later') {
        // User tapped "Remind me later"
        scheduleRemindLaterNotification(data.dayType as DayType);
      } else if (data.type === 'daily-workout' || data.type === 'stretch-reminder') {
        // User tapped the notification - app is already open
        // You could navigate to a specific screen here if needed
      }
    });

    // Check every minute if the day has changed (midnight rollover)
    const midnightCheckInterval = setInterval(() => {
      const newDate = new Date().toDateString();
      if (newDate !== currentDate) {
        console.log('Day changed! Refreshing...');
        setCurrentDate(newDate);
        setRefreshTrigger(prev => prev + 1);
        // Reload today's workout type
        initializeApp();
      }
    }, 60000); // Check every minute

    return () => {
      subscription.remove();
      clearInterval(midnightCheckInterval);
    };
  }, [currentDate]);

  useEffect(() => {
    loadScheduleForMonth();
    reloadWorkoutPlan();
  }, [currentMonth, refreshTrigger]);

  // Reload today's workout type (for when weekly schedule changes)
  const reloadTodayType = async () => {
    const today_date = format(new Date(), 'yyyy-MM-dd');

    // First check if there's a custom day type for today in monthly schedule
    const monthlySchedule = await loadMonthlySchedule();
    const todayOverride = monthlySchedule?.find((s) => s.date === today_date);

    let newDayType: DayType = 'Rest';

    if (todayOverride) {
      // Use the custom day type from monthly schedule
      newDayType = todayOverride.dayType;
    } else {
      // Fall back to weekly program
      const program = await loadWeeklyProgram();
      if (program) {
        const today = new Date().getDay();
        const todayTraining = program.trainingDays.find(
          (d) => d.dayOfWeek === today && d.enabled
        );
        newDayType = todayTraining?.dayType || 'Rest';
      }
    }

    setTodayType(newDayType);

    // Reload today's exercises if needed
    if (newDayType !== 'Rest' && newDayType !== 'Outdoor') {
      const workoutPlan = await loadWorkoutPlan();
      if (workoutPlan) {
        const catalog = await initializeExerciseCatalog();
        const dayPlan = workoutPlan.plans[newDayType as keyof typeof workoutPlan.plans];
        if (dayPlan) {
          const dayExercises = dayPlan.exercises
            .sort((a: any, b: any) => a.order - b.order)
            .map((pe: any) => catalog.exercises.find((ex) => ex.id === pe.exerciseId))
            .filter(Boolean) as Exercise[];
          setTodayExercises(dayExercises);
        }
      }
    } else {
      setTodayExercises([]);
    }

    // Check if today's workout is completed
    const gymSessions = await loadGymSessions();
    const outdoorSessions = await loadOutdoorSessions();
    const completed =
      (newDayType !== 'Outdoor' && gymSessions?.some((s) => s.date === today_date && s.completed)) ||
      (newDayType === 'Outdoor' && outdoorSessions?.some((s) => s.date === today_date && s.completed));
    setIsTodayCompleted(completed || false);

    // Update notifications for the new day type
    await scheduleDailyWorkoutReminder(newDayType);
    await checkAndScheduleMissedWorkoutNotification(newDayType);
  };

  // Reload schedule and workout plan when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setRefreshTrigger(prev => prev + 1);
      // Reload today's workout type when coming back to this screen
      (async () => {
        await reloadTodayType();
      })();
    }, [])
  );

  const loadScheduleForMonth = async () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Load saved schedule
    const savedSchedule = await loadMonthlySchedule();

    // Load completed sessions to mark as done
    const gymSessions = await loadGymSessions();
    const outdoorSessions = await loadOutdoorSessions();

    // Load weekly program to determine schedule
    const weeklyProgram = await loadWeeklyProgram();

    // Generate schedule for the month based on weekly program
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

      // Use weekly program to determine day type
      let defaultDayType: DayType = 'Rest';
      if (weeklyProgram) {
        const trainingDay = weeklyProgram.trainingDays.find(
          (td) => td.dayOfWeek === dayOfWeek && td.enabled
        );
        if (trainingDay) {
          defaultDayType = trainingDay.dayType;
        }
      }

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

    // Check if today's session is completed
    const today = format(new Date(), 'yyyy-MM-dd');
    const todaySchedule = monthSchedule.find((s) => s.date === today);
    setIsTodayCompleted(todaySchedule?.completed || false);
  };

  const reloadWorkoutPlan = async () => {
    try {
      // Reload workout plan from storage
      const plan = await loadWorkoutPlan();
      if (plan) {
        setWorkoutPlan(plan);

        // Reload today's exercises if it's a workout day
        if (todayType !== 'Rest' && todayType !== 'Outdoor' && exerciseCatalog.length > 0) {
          const dayPlan = plan.plans[todayType as keyof typeof plan.plans];
          if (dayPlan) {
            const dayExercises = dayPlan.exercises
              .sort((a: any, b: any) => a.order - b.order)
              .map((pe: any) => exerciseCatalog.find((ex) => ex.id === pe.exerciseId))
              .filter(Boolean) as Exercise[];
            setTodayExercises(dayExercises);
          }
        }
      }
    } catch (error) {
      console.error('Error reloading workout plan:', error);
    }
  };

  const initializeApp = async () => {
    try {
      // Check if user profile exists - if not, navigate to setup
      const userProfile = await loadUserProfile();
      if (!userProfile) {
        // No profile found, navigate to ProfileSetup
        setLoading(false);
        navigation.navigate('ProfileSetup');
        return;
      }

      // Load training split preference
      setTrainingSplit(userProfile.trainingSplit || 'muscle_group');

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
      // First check if there's a custom day type for today in monthly schedule
      const today_date = format(new Date(), 'yyyy-MM-dd');
      const monthlySchedule = await loadMonthlySchedule();
      const todayOverride = monthlySchedule?.find((s) => s.date === today_date);

      let todayDayType: DayType = 'Rest';
      let todayTraining = null;

      if (todayOverride) {
        // Use the custom day type from monthly schedule
        todayDayType = todayOverride.dayType;
      } else {
        // Fall back to weekly program
        const today = new Date().getDay();
        todayTraining = program.trainingDays.find(
          (d) => d.dayOfWeek === today && d.enabled
        );
        todayDayType = todayTraining?.dayType || 'Rest';
      }

      setTodayType(todayDayType);

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
      if (todayDayType !== 'Rest' && todayDayType !== 'Outdoor') {
        const workoutPlan = await loadWorkoutPlan();
        if (workoutPlan) {
          const dayPlan = workoutPlan.plans[todayDayType as keyof typeof workoutPlan.plans];
          if (dayPlan) {
            const dayExercises = dayPlan.exercises
              .sort((a: any, b: any) => a.order - b.order)
              .map((pe: any) => catalog.exercises.find((ex) => ex.id === pe.exerciseId))
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

      // Schedule notifications for today's workout
      // Schedule daily workout reminder
      await scheduleDailyWorkoutReminder(todayDayType);
      // Check and schedule missed workout notification
      await checkAndScheduleMissedWorkoutNotification(todayDayType);

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

    // Cancel remind later notification since user is starting workout
    cancelRemindLaterNotification();

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

    try {
      // Load existing saved custom schedule (not the full generated schedule)
      const savedSchedule = await loadMonthlySchedule();

      // Find if this day already exists in saved custom days
      const existingDayIndex = savedSchedule.findIndex((day) => day.date === selectedDay);

      if (existingDayIndex >= 0) {
        // Update existing saved day
        savedSchedule[existingDayIndex] = {
          ...savedSchedule[existingDayIndex],
          dayType: newType,
        };
      } else {
        // Add new custom day to saved schedule
        savedSchedule.push({
          date: selectedDay,
          dayType: newType,
          completed: false, // Will be recalculated on reload
        });
      }

      // Save only the custom days (not the entire generated schedule)
      await saveMonthlySchedule(savedSchedule);

      // Close modal first for better UX
      setSelectedDay(null);
      setViewMode('calendar');

      // Trigger refresh to reload calendar
      setRefreshTrigger(prev => prev + 1);

      // If the changed day is today, immediately update today's session
      const today = format(new Date(), 'yyyy-MM-dd');
      if (selectedDay === today) {
        await reloadTodayType();
      }
    } catch (error) {
      console.error('Error changing day type:', error);
    }
  };

  const handleCloseModal = () => {
    setSelectedDay(null);
    setViewMode('calendar');
  };

  const getDayColor = (dayType: DayType) => {
    switch (dayType) {
      // Muscle group split
      case 'Push':
        return colors.dayPush;
      case 'Pull':
        return colors.dayPull;
      case 'Upper2':
        return colors.dayUpper;
      case 'Legs':
        return colors.dayLegs;
      // Body part split
      case 'Chest':
        return colors.dayChest;
      case 'Back':
        return colors.dayBack;
      case 'Shoulders':
        return colors.dayShoulders;
      case 'Arms':
        return colors.dayArms;
      // Special
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
                             daySchedule.dayType === 'Legs' ? 'L' :
                             daySchedule.dayType === 'Chest' ? 'C' :
                             daySchedule.dayType === 'Back' ? 'B' :
                             daySchedule.dayType === 'Shoulders' ? 'S' :
                             daySchedule.dayType === 'Arms' ? 'A' :
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

    // Calculate day type counts
    const outdoorDays = monthSchedule.filter((day) => day.dayType === 'Outdoor').length;
    const legsDays = monthSchedule.filter((day) => day.dayType === 'Legs').length;

    // Muscle group split counts
    const pushDays = monthSchedule.filter((day) => day.dayType === 'Push').length;
    const pullDays = monthSchedule.filter((day) => day.dayType === 'Pull').length;
    const upper2Days = monthSchedule.filter((day) => day.dayType === 'Upper2').length;

    // Body part split counts
    const chestDays = monthSchedule.filter((day) => day.dayType === 'Chest').length;
    const backDays = monthSchedule.filter((day) => day.dayType === 'Back').length;
    const shouldersDays = monthSchedule.filter((day) => day.dayType === 'Shoulders').length;
    const armsDays = monthSchedule.filter((day) => day.dayType === 'Arms').length;

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
          {trainingSplit === 'muscle_group' ? (
            <>
              {/* Muscle Group Split */}
              {pushDays > 0 && (
                <View style={styles.countItem}>
                  <View style={[styles.countDot, { backgroundColor: colors.dayPush }]} />
                  <Text style={styles.countText}>Push: {pushDays}</Text>
                </View>
              )}
              {pullDays > 0 && (
                <View style={styles.countItem}>
                  <View style={[styles.countDot, { backgroundColor: colors.dayPull }]} />
                  <Text style={styles.countText}>Pull: {pullDays}</Text>
                </View>
              )}
              {upper2Days > 0 && (
                <View style={styles.countItem}>
                  <View style={[styles.countDot, { backgroundColor: colors.dayUpper }]} />
                  <Text style={styles.countText}>{getDayTypeDisplayName('Upper2')}: {upper2Days}</Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Body Part Split */}
              {chestDays > 0 && (
                <View style={styles.countItem}>
                  <View style={[styles.countDot, { backgroundColor: colors.dayChest }]} />
                  <Text style={styles.countText}>Chest: {chestDays}</Text>
                </View>
              )}
              {backDays > 0 && (
                <View style={styles.countItem}>
                  <View style={[styles.countDot, { backgroundColor: colors.dayBack }]} />
                  <Text style={styles.countText}>Back: {backDays}</Text>
                </View>
              )}
              {shouldersDays > 0 && (
                <View style={styles.countItem}>
                  <View style={[styles.countDot, { backgroundColor: colors.dayShoulders }]} />
                  <Text style={styles.countText}>Shoulders: {shouldersDays}</Text>
                </View>
              )}
              {armsDays > 0 && (
                <View style={styles.countItem}>
                  <View style={[styles.countDot, { backgroundColor: colors.dayArms }]} />
                  <Text style={styles.countText}>Arms: {armsDays}</Text>
                </View>
              )}
            </>
          )}
          {/* Show Legs and Outdoor for both splits */}
          {legsDays > 0 && (
            <View style={styles.countItem}>
              <View style={[styles.countDot, { backgroundColor: colors.dayLegs }]} />
              <Text style={styles.countText}>Legs: {legsDays}</Text>
            </View>
          )}
          {outdoorDays > 0 && (
            <View style={styles.countItem}>
              <View style={[styles.countDot, { backgroundColor: colors.dayOutdoor }]} />
              <Text style={styles.countText}>Outdoor: {outdoorDays}</Text>
            </View>
          )}
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
            {format(new Date(selectedDay), 'MMMM d')} - {getDayTypeDisplayName(daySchedule.dayType)} Day
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

    // Get available day types based on training split
    const availableDayTypes: DayType[] = trainingSplit === 'body_part'
      ? ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Outdoor', 'Rest']
      : ['Push', 'Pull', 'Upper2', 'Legs', 'Outdoor', 'Rest'];

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.dayTypeSelector}>
          <Text style={styles.selectorTitle}>
            Change {format(new Date(selectedDay), 'MMM d')} to:
          </Text>
          <View style={styles.dayTypeButtons}>
            {availableDayTypes.map((type) => (
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
                  {getDayTypeDisplayName(type)}
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
            {isTodayCompleted && (
              <View style={styles.completedBanner}>
                <Text style={styles.completedText}>✓ Completed</Text>
              </View>
            )}
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
                style={[styles.actionButton, isTodayCompleted ? styles.redoButton : styles.startButton]}
                onPress={handleStartSession}
                activeOpacity={0.8}
              >
                <Text style={styles.startButtonText}>
                  {isTodayCompleted ? 'Redo Session' : 'Start Session'}
                </Text>
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

      {/* Session History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training History</Text>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('SessionHistory')}
        >
          <View style={styles.historyButtonContent}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>📅</Text>
            </View>
            <View style={styles.historyButtonText}>
              <Text style={styles.historyButtonTitle}>View Session History</Text>
              <Text style={styles.historyButtonSubtitle}>
                Review, edit, and manage your past workouts
              </Text>
            </View>
          </View>
          <Text style={styles.historyButtonArrow}>›</Text>
        </TouchableOpacity>
      </View>

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
                {isTodayCompleted ? 'Redo Workout' : 'Start Workout'}
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
    // Muscle group split
    case 'Push':
      return 'Chest, shoulders, and triceps';
    case 'Pull':
      return 'Back and biceps';
    case 'Upper2':
      return 'Full upper body mix';
    case 'Legs':
      return 'Quads, hamstrings, glutes, and calves';
    // Body part split
    case 'Chest':
      return 'Chest focused training';
    case 'Back':
      return 'Back and lats focused';
    case 'Shoulders':
      return 'Deltoids and traps';
    case 'Arms':
      return 'Biceps and triceps';
    // Special
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
  completedBanner: {
    backgroundColor: colors.success + '20',
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  completedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success,
    fontWeight: typography.fontWeight.bold,
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
  redoButton: {
    backgroundColor: colors.warning,
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
  historyButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  historyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  historyButtonText: {
    flex: 1,
  },
  historyButtonTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  historyButtonSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * 1.4,
  },
  historyButtonArrow: {
    fontSize: typography.fontSize['2xl'],
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
  },
});
