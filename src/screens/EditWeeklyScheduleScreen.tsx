/**
 * Edit Weekly Schedule Screen
 * Allows users to edit their recurring weekly training schedule
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, getDayTypeDisplayName } from '../theme';
import { useModal } from '../contexts/ModalContext';
import { DayType, WeeklyProgram, TrainingDay } from '../models/types';
import { loadWeeklyProgram, saveWeeklyProgram, loadUserProfile } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'EditWeeklySchedule'>;

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function EditWeeklyScheduleScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useModal();
  const [weeklyProgram, setWeeklyProgram] = useState<WeeklyProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableDayTypes, setAvailableDayTypes] = useState<DayType[]>(['Push', 'Pull', 'Upper2', 'Legs']);

  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Save</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, weeklyProgram]);

  const loadSchedule = async () => {
    try {
      const program = await loadWeeklyProgram();
      const profile = await loadUserProfile();

      if (program) {
        setWeeklyProgram(program);
      }

      // Set available day types based on training split
      if (profile?.trainingSplit === 'body_part') {
        setAvailableDayTypes(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Outdoor', 'Rest']);
      } else {
        setAvailableDayTypes(['Push', 'Pull', 'Upper2', 'Legs', 'Outdoor', 'Rest']);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading schedule:', error);
      showError('Error', 'Failed to load weekly schedule');
      setLoading(false);
    }
  };

  const handleDayTypeChange = (dayOfWeek: number, newDayType: DayType) => {
    if (!weeklyProgram) return;

    const updatedTrainingDays = [...weeklyProgram.trainingDays];
    const existingDayIndex = updatedTrainingDays.findIndex((td) => td.dayOfWeek === dayOfWeek);

    if (existingDayIndex >= 0) {
      // Update existing day
      updatedTrainingDays[existingDayIndex] = {
        ...updatedTrainingDays[existingDayIndex],
        dayType: newDayType,
        enabled: newDayType !== 'Rest',
      };
    } else {
      // Add new day
      updatedTrainingDays.push({
        id: `${dayOfWeek}-${Date.now()}`,
        dayOfWeek,
        dayType: newDayType,
        enabled: newDayType !== 'Rest',
      });
    }

    setWeeklyProgram({
      ...weeklyProgram,
      trainingDays: updatedTrainingDays,
      updatedAt: new Date().toISOString(),
    });
  };

  const getDayType = (dayOfWeek: number): DayType => {
    if (!weeklyProgram) return 'Rest';
    const trainingDay = weeklyProgram.trainingDays.find((td) => td.dayOfWeek === dayOfWeek);
    return trainingDay?.enabled ? trainingDay.dayType : 'Rest';
  };

  const handleSave = async () => {
    if (!weeklyProgram) return;

    try {
      await saveWeeklyProgram(weeklyProgram);
      showSuccess('Success', 'Weekly schedule updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving schedule:', error);
      showError('Error', 'Failed to save weekly schedule');
    }
  };

  const getDayTypeColor = (dayType: DayType): string => {
    switch (dayType) {
      case 'Push': return colors.dayPush;
      case 'Pull': return colors.dayPull;
      case 'Upper2': return colors.dayUpper;
      case 'Legs': return colors.dayLegs;
      case 'Chest': return colors.dayChest;
      case 'Back': return colors.dayBack;
      case 'Shoulders': return colors.dayShoulders;
      case 'Arms': return colors.dayArms;
      case 'Outdoor': return colors.dayOutdoor;
      case 'Rest': return colors.gray400;
      default: return colors.gray400;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Text style={styles.description}>
        Set your recurring weekly training schedule. This determines which workout type is scheduled for each day of the week.
      </Text>

      {DAYS_OF_WEEK.map((dayName, dayIndex) => {
        const currentDayType = getDayType(dayIndex);

        return (
          <View key={dayIndex} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{dayName}</Text>
              <View style={[styles.dayTypeBadge, { backgroundColor: getDayTypeColor(currentDayType) }]}>
                <Text style={styles.dayTypeBadgeText}>{getDayTypeDisplayName(currentDayType)}</Text>
              </View>
            </View>

            <View style={styles.dayTypeOptions}>
              {availableDayTypes.map((dayType) => (
                <TouchableOpacity
                  key={dayType}
                  style={[
                    styles.dayTypeOption,
                    currentDayType === dayType && styles.dayTypeOptionActive,
                    { borderColor: getDayTypeColor(dayType) },
                  ]}
                  onPress={() => handleDayTypeChange(dayIndex, dayType)}
                >
                  <Text
                    style={[
                      styles.dayTypeOptionText,
                      currentDayType === dayType && styles.dayTypeOptionTextActive,
                    ]}
                  >
                    {getDayTypeDisplayName(dayType)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Changes will apply to all future dates. Days you've already customized in the calendar will remain unchanged.
        </Text>
      </View>
    </ScrollView>
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
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
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
  description: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: typography.fontSize.base * 1.5,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dayName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  dayTypeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  dayTypeBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  dayTypeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayTypeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: colors.background,
  },
  dayTypeOptionActive: {
    backgroundColor: colors.primary + '20',
  },
  dayTypeOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  dayTypeOptionTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  infoBox: {
    backgroundColor: colors.info + '10',
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    lineHeight: typography.fontSize.sm * 1.5,
  },
});
