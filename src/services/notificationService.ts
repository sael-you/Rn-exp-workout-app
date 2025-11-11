/**
 * Notification Service
 * Handles all app notifications including workout reminders, stretch reminders, and motivational messages
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { format } from 'date-fns';
import { DayType } from '../models/types';
import { loadWeeklyProgram, loadGymSessions, loadOutdoorSessions } from './storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Notification identifiers
const NOTIFICATION_IDS = {
  DAILY_WORKOUT: 'daily-workout-reminder',
  REMIND_LATER: 'remind-later',
  RECURRING_REMINDER_11AM: 'recurring-reminder-11am',
  RECURRING_REMINDER_1PM: 'recurring-reminder-1pm',
  RECURRING_REMINDER_3PM: 'recurring-reminder-3pm',
  RECURRING_REMINDER_5PM: 'recurring-reminder-5pm',
  RECURRING_REMINDER_7PM: 'recurring-reminder-7pm',
  RECURRING_REMINDER_9PM: 'recurring-reminder-9pm',
  MISSED_WORKOUT: 'missed-workout',
  STRETCH_REMINDER: 'stretch-reminder',
};

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    // Set up notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Workout Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get day type display name
 */
function getDayTypeDisplayName(dayType: string): string {
  switch (dayType) {
    case 'Upper2':
      return 'Upper Body';
    case 'Outdoor':
      return 'Outdoor';
    default:
      return dayType;
  }
}

/**
 * Get workout description based on day type
 */
function getWorkoutDescription(dayType: DayType): string {
  switch (dayType) {
    case 'Push':
      return 'Chest, shoulders & triceps';
    case 'Pull':
      return 'Back & biceps';
    case 'Upper2':
      return 'Full upper body workout';
    case 'Legs':
      return 'Quads, hamstrings & glutes';
    case 'Chest':
      return 'Chest focused training';
    case 'Back':
      return 'Back & lats workout';
    case 'Shoulders':
      return 'Deltoids & traps';
    case 'Arms':
      return 'Biceps & triceps';
    case 'Outdoor':
      return 'Outdoor activity & cardio';
    default:
      return 'Rest day';
  }
}

/**
 * Schedule daily 9am workout reminder and recurring 2-hour reminders
 * Reminders continue every 2 hours (9am, 11am, 1pm, 3pm, 5pm, 7pm, 9pm) until workout starts or 11pm
 */
export async function scheduleDailyWorkoutReminder(dayType: DayType): Promise<void> {
  try {
    // Cancel any existing reminders
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_WORKOUT);
    await cancelAllRecurringReminders();

    if (dayType === 'Rest') {
      // Don't schedule notification for rest days
      return;
    }

    const displayName = getDayTypeDisplayName(dayType);
    const description = getWorkoutDescription(dayType);

    // Schedule 9am reminder
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.DAILY_WORKOUT,
      content: {
        title: `💪 ${displayName} Day - Time to Train!`,
        body: `${description}\n\nTap to start your workout or remind me later.`,
        data: { dayType, type: 'daily-workout' },
        categoryIdentifier: 'workout-reminder',
      },
      trigger: {
        hour: 9,
        minute: 0,
        repeats: true,
      },
    });

    // Schedule recurring reminders every 2 hours (11am, 1pm, 3pm, 5pm, 7pm, 9pm)
    const reminderTimes = [
      { hour: 11, id: NOTIFICATION_IDS.RECURRING_REMINDER_11AM },
      { hour: 13, id: NOTIFICATION_IDS.RECURRING_REMINDER_1PM },
      { hour: 15, id: NOTIFICATION_IDS.RECURRING_REMINDER_3PM },
      { hour: 17, id: NOTIFICATION_IDS.RECURRING_REMINDER_5PM },
      { hour: 19, id: NOTIFICATION_IDS.RECURRING_REMINDER_7PM },
      { hour: 21, id: NOTIFICATION_IDS.RECURRING_REMINDER_9PM },
    ];

    for (const { hour, id } of reminderTimes) {
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: `⏰ Workout Reminder - ${displayName} Day`,
          body: `Don't forget! ${description}\n\nTime to crush your workout!`,
          data: { dayType, type: 'recurring-reminder' },
          categoryIdentifier: 'workout-reminder',
        },
        trigger: {
          hour,
          minute: 0,
          repeats: true,
        },
      });
    }

    console.log('Daily workout reminders scheduled (9am with 2-hour recurring reminders)');
  } catch (error) {
    console.error('Error scheduling daily workout reminder:', error);
  }
}

/**
 * Cancel all recurring reminders
 */
async function cancelAllRecurringReminders(): Promise<void> {
  const recurringIds = [
    NOTIFICATION_IDS.RECURRING_REMINDER_11AM,
    NOTIFICATION_IDS.RECURRING_REMINDER_1PM,
    NOTIFICATION_IDS.RECURRING_REMINDER_3PM,
    NOTIFICATION_IDS.RECURRING_REMINDER_5PM,
    NOTIFICATION_IDS.RECURRING_REMINDER_7PM,
    NOTIFICATION_IDS.RECURRING_REMINDER_9PM,
  ];

  for (const id of recurringIds) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

/**
 * Schedule "Remind me later" notification (1 hour from now)
 */
export async function scheduleRemindLaterNotification(dayType: DayType): Promise<void> {
  try {
    // Cancel any existing remind later notifications
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.REMIND_LATER);

    if (dayType === 'Rest') {
      return;
    }

    const displayName = getDayTypeDisplayName(dayType);
    const description = getWorkoutDescription(dayType);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.REMIND_LATER,
      content: {
        title: `⏰ Workout Reminder - ${displayName} Day`,
        body: `Don't forget! ${description}\n\nTime to crush your workout!`,
        data: { dayType, type: 'remind-later' },
      },
      trigger: {
        seconds: 3600, // 1 hour from now
      },
    });

    console.log('Remind later notification scheduled for 1 hour from now');
  } catch (error) {
    console.error('Error scheduling remind later notification:', error);
  }
}

/**
 * Cancel all reminder notifications (when user starts workout)
 * This cancels the daily 9am reminder and all 2-hour recurring reminders
 */
export async function cancelRemindLaterNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.REMIND_LATER);
    await cancelAllRecurringReminders();
    console.log('All workout reminder notifications cancelled');
  } catch (error) {
    console.error('Error cancelling reminder notifications:', error);
  }
}

/**
 * Schedule missed workout notification (end of day)
 * This is a motivational message sent at 11pm if the user hasn't completed their workout
 */
export async function checkAndScheduleMissedWorkoutNotification(dayType: DayType): Promise<void> {
  try {
    if (dayType === 'Rest') {
      return;
    }

    // Check if today's workout was completed
    const today = format(new Date(), 'yyyy-MM-dd');
    const gymSessions = await loadGymSessions();
    const outdoorSessions = await loadOutdoorSessions();

    const isCompleted =
      (dayType !== 'Outdoor' && gymSessions?.some((s) => s.date === today && s.completed)) ||
      (dayType === 'Outdoor' && outdoorSessions?.some((s) => s.date === today && s.completed));

    if (isCompleted) {
      // Workout completed, no need for missed workout notification
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.MISSED_WORKOUT);
      return;
    }

    // Schedule notification for 11pm
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.MISSED_WORKOUT);

    const displayName = getDayTypeDisplayName(dayType);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.MISSED_WORKOUT,
      content: {
        title: "It's okay to miss a day! 💙",
        body: `You missed your ${displayName} workout today, but tomorrow is a new opportunity. One missed day won't ruin your progress - consistency beats perfection!`,
        data: { dayType, type: 'missed-workout' },
      },
      trigger: {
        hour: 23,
        minute: 0,
      },
    });

    console.log('Missed workout notification scheduled for 11pm');
  } catch (error) {
    console.error('Error scheduling missed workout notification:', error);
  }
}

/**
 * Schedule stretch reminder (1 hour after workout starts)
 */
export async function scheduleStretchReminder(): Promise<void> {
  try {
    // Cancel any existing stretch reminders
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.STRETCH_REMINDER);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.STRETCH_REMINDER,
      content: {
        title: '🧘 Time to Stretch!',
        body: "Don't forget to stretch after your workout. Your muscles will thank you!",
        data: { type: 'stretch-reminder' },
      },
      trigger: {
        seconds: 3600, // 1 hour from now
      },
    });

    console.log('Stretch reminder scheduled for 1 hour from now');
  } catch (error) {
    console.error('Error scheduling stretch reminder:', error);
  }
}

/**
 * Cancel stretch reminder (if user already stretched or completed workout)
 */
export async function cancelStretchReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.STRETCH_REMINDER);
    console.log('Stretch reminder cancelled');
  } catch (error) {
    console.error('Error cancelling stretch reminder:', error);
  }
}

/**
 * Initialize notifications for the app
 * Should be called on app start
 */
export async function initializeNotifications(): Promise<void> {
  try {
    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Notification permissions not granted');
      return;
    }

    // Get today's workout type from weekly program
    const weeklyProgram = await loadWeeklyProgram();
    if (!weeklyProgram) {
      return;
    }

    const today = new Date().getDay();
    const todayTraining = weeklyProgram.trainingDays.find(
      (d) => d.dayOfWeek === today && d.enabled
    );

    if (todayTraining) {
      // Schedule daily workout reminder
      await scheduleDailyWorkoutReminder(todayTraining.dayType);

      // Check if missed workout notification should be scheduled
      await checkAndScheduleMissedWorkoutNotification(todayTraining.dayType);
    }

    console.log('Notifications initialized successfully');
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

/**
 * Setup notification categories with actions (iOS)
 */
export async function setupNotificationCategories(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Notifications.setNotificationCategoryAsync('workout-reminder', [
      {
        identifier: 'remind-later',
        buttonTitle: 'Remind me later',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'start-workout',
        buttonTitle: 'Start workout',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);
  }
}

/**
 * Handle notification response (when user taps notification or action button)
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
}
