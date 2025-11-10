/**
 * Streak calculation utilities
 */

import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { GymSession, OutdoorSession, HabitLog, StreakData } from '../models/types';

/**
 * Calculate training streak (consecutive weeks with 3+ sessions)
 */
export function calculateTrainingStreak(sessions: GymSession[]): {
  current: number;
  longest: number;
} {
  if (sessions.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Group sessions by week
  const sessionsByWeek = groupSessionsByWeek(sessions);
  const weeks = Object.keys(sessionsByWeek).sort().reverse(); // Most recent first

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < weeks.length; i++) {
    const weekSessions = sessionsByWeek[weeks[i]];
    const completedCount = weekSessions.filter(s => s.completed).length;

    if (completedCount >= 3) {
      tempStreak++;

      // Check if this is current week
      if (i === 0) {
        currentStreak = tempStreak;
      }

      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      // Streak broken
      if (i === 0) {
        currentStreak = 0;
      }
      tempStreak = 0;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}

/**
 * Calculate outdoor streak (consecutive weeks with outdoor session)
 */
export function calculateOutdoorStreak(sessions: OutdoorSession[]): {
  current: number;
  longest: number;
} {
  if (sessions.length === 0) {
    return { current: 0, longest: 0 };
  }

  const sessionsByWeek = groupOutdoorSessionsByWeek(sessions);
  const weeks = Object.keys(sessionsByWeek).sort().reverse();

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < weeks.length; i++) {
    const weekSessions = sessionsByWeek[weeks[i]];
    const hasCompleted = weekSessions.some(s => s.completed);

    if (hasCompleted) {
      tempStreak++;

      if (i === 0) {
        currentStreak = tempStreak;
      }

      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      if (i === 0) {
        currentStreak = 0;
      }
      tempStreak = 0;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}

/**
 * Calculate habits streak (consecutive days with 3+ habits logged)
 */
export function calculateHabitsStreak(logs: HabitLog[]): {
  current: number;
  longest: number;
} {
  if (logs.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Sort logs by date descending
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;

  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    const logDate = parseISO(log.date);

    // Count how many habits were logged
    const habitCount = [
      log.sleep !== undefined,
      log.hydration !== undefined,
      log.stretching !== undefined,
      log.creatine !== undefined,
    ].filter(Boolean).length;

    if (habitCount >= 3) {
      // Check if consecutive
      if (lastDate === null || differenceInDays(lastDate, logDate) === 1) {
        tempStreak++;

        if (i === 0) {
          currentStreak = tempStreak;
        }

        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        // Gap in streak
        if (i === 0) {
          currentStreak = 1;
          tempStreak = 1;
        } else {
          tempStreak = 1;
        }
      }

      lastDate = logDate;
    } else {
      if (i === 0) {
        currentStreak = 0;
      }
      tempStreak = 0;
      lastDate = null;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}

/**
 * Update all streaks
 */
export function updateStreaks(
  gymSessions: GymSession[],
  outdoorSessions: OutdoorSession[],
  habitLogs: HabitLog[]
): StreakData {
  const training = calculateTrainingStreak(gymSessions);
  const outdoor = calculateOutdoorStreak(outdoorSessions);
  const habits = calculateHabitsStreak(habitLogs);

  return {
    training: {
      ...training,
      lastUpdated: new Date().toISOString(),
    },
    outdoor: {
      ...outdoor,
      lastUpdated: new Date().toISOString(),
    },
    habits: {
      ...habits,
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Group gym sessions by week (ISO week)
 */
function groupSessionsByWeek(sessions: GymSession[]): Record<string, GymSession[]> {
  const grouped: Record<string, GymSession[]> = {};

  for (const session of sessions) {
    const date = parseISO(session.date);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    if (!grouped[weekKey]) {
      grouped[weekKey] = [];
    }

    grouped[weekKey].push(session);
  }

  return grouped;
}

/**
 * Group outdoor sessions by week
 */
function groupOutdoorSessionsByWeek(sessions: OutdoorSession[]): Record<string, OutdoorSession[]> {
  const grouped: Record<string, OutdoorSession[]> = {};

  for (const session of sessions) {
    const date = parseISO(session.date);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    if (!grouped[weekKey]) {
      grouped[weekKey] = [];
    }

    grouped[weekKey].push(session);
  }

  return grouped;
}
