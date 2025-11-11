/**
 * Settings Screen
 * Manage training schedule, export/import, preferences
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { format } from 'date-fns';
import { colors, spacing, typography, getDayTypeDisplayName } from '../theme';
import { useModal } from '../contexts/ModalContext';
import { exportAllData, importAllData, clearAllData, loadUserProfile, loadWorkoutPlan } from '../services/storage';
import { UserProfile, DayType } from '../models/types';
// FileSystem not needed for basic export

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showModal, showConfirm } = useModal();
  const [exporting, setExporting] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    const [profile, plan] = await Promise.all([
      loadUserProfile(),
      loadWorkoutPlan(),
    ]);
    setUserProfile(profile);
    setWorkoutPlan(plan);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const data = await exportAllData();
      const jsonString = JSON.stringify(data, null, 2);

      // Create filename with date
      const filename = `upper-outdoor-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;

      // Share as text for now (file sharing requires additional setup)
      await Share.share({
        message: jsonString,
        title: filename,
      });

      showSuccess('Success', 'Backup exported successfully');
      setExporting(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      showError('Error', 'Failed to export data');
      setExporting(false);
    }
  };

  const handleImport = () => {
    showModal({
      type: 'info',
      title: 'Import Data',
      message: 'To import your backup:\n\n1. Ensure you have a valid backup file\n2. Use your device\'s file manager to open the .json file\n3. Choose "Upper+Outdoor" to import\n\nNote: This feature requires implementation with expo-document-picker.',
      buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
    });
  };

  const handleClearData = () => {
    showConfirm(
      'Clear All Data',
      'This will permanently delete all your training data, habits, and settings. This cannot be undone.\n\nMake sure you have exported a backup first!',
      async () => {
        try {
          await clearAllData();
          showSuccess('Success', 'All data cleared. Please restart the app.');
        } catch (error) {
          showError('Error', 'Failed to clear data');
        }
      }
    );
  };

  const handleEditPlan = (dayType: DayType) => {
    // EditPlan only accepts gym day types, not Outdoor or Rest
    navigation.navigate('EditPlan', {
      dayType: dayType as 'Push' | 'Pull' | 'Upper2' | 'Legs' | 'Chest' | 'Back' | 'Shoulders' | 'Arms'
    });
  };

  // Get available day types based on training split
  const getAvailableDayTypes = (): DayType[] => {
    if (!userProfile) return [];

    if (userProfile.trainingSplit === 'body_part') {
      return ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'];
    } else {
      return ['Push', 'Pull', 'Upper2', 'Legs'];
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
      default: return colors.primary;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upper+Outdoor</Text>
        <Text style={styles.versionText}>Version 1.0.0 (MVP)</Text>
        <Text style={styles.descriptionText}>
          Privacy-first workout tracker for 3 upper-body gym days + 1 outdoor legs/core day
        </Text>
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>

        <TouchableOpacity
          style={styles.settingButton}
          onPress={handleExport}
          disabled={exporting}
        >
          <Text style={styles.settingButtonText}>
            {exporting ? 'Exporting...' : 'Export Backup'}
          </Text>
          <Text style={styles.settingButtonSubtext}>
            Save all your data to a file
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton} onPress={handleImport}>
          <Text style={styles.settingButtonText}>Import Backup</Text>
          <Text style={styles.settingButtonSubtext}>
            Restore data from a backup file
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Schedule</Text>
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => navigation.navigate('EditWeeklySchedule')}
        >
          <View style={styles.scheduleButtonContent}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>📆</Text>
            </View>
            <View style={styles.scheduleButtonText}>
              <Text style={styles.scheduleButtonTitle}>Edit Weekly Schedule</Text>
              <Text style={styles.scheduleButtonSubtitle}>
                Change which workout types are scheduled for each day of the week
              </Text>
            </View>
          </View>
          <Text style={styles.scheduleButtonArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Workout Plans */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Edit Workout Plans</Text>
        <Text style={styles.sectionSubtitle}>
          Customize exercises, sets, and reps for each day type
        </Text>

        {userProfile ? (
          <>
            {getAvailableDayTypes().map((dayType) => {
              const exerciseCount = workoutPlan?.plans[dayType]?.exercises?.length || 0;
              return (
                <TouchableOpacity
                  key={dayType}
                  style={styles.planButton}
                  onPress={() => handleEditPlan(dayType)}
                >
                  <View style={styles.planButtonLeft}>
                    <View style={[styles.dayTypeIndicator, { backgroundColor: getDayTypeColor(dayType) }]} />
                    <View>
                      <Text style={styles.planButtonText}>{getDayTypeDisplayName(dayType)} Day</Text>
                      <Text style={styles.planButtonSubtext}>
                        {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.planButtonArrow}>›</Text>
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <Text style={styles.noProfileText}>
            Complete profile setup to edit workout plans
          </Text>
        )}
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          Built with React Native and Expo.{'\n'}
          Exercise data from Free Exercise DB (Unlicense).{'\n'}
          All data stored locally on your device.{'\n'}
          No analytics, no tracking, no cloud.
        </Text>
      </View>

      {/* Developer Tools - Only in Development */}
      {__DEV__ && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Developer Tools</Text>
          <Text style={styles.sectionSubtitle}>
            Load test scenarios and test AI coach functionality
          </Text>
          <TouchableOpacity
            style={[styles.settingButton, styles.devToolsButton]}
            onPress={() => navigation.navigate('DeveloperTools')}
          >
            <Text style={styles.settingButtonText}>Open Developer Tools</Text>
            <Text style={styles.settingButtonSubtext}>
              Load mock data scenarios and test AI analysis
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.error }]}>
          Danger Zone
        </Text>
        <TouchableOpacity
          style={[styles.settingButton, styles.dangerButton]}
          onPress={handleClearData}
        >
          <Text style={[styles.settingButtonText, { color: colors.error }]}>
            Clear All Data
          </Text>
          <Text style={styles.settingButtonSubtext}>
            Permanently delete everything
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ScheduleDay({
  day,
  type,
  onPress,
  disabled,
}: {
  day: string;
  type: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const getTypeColor = () => {
    switch (type) {
      case 'Push':
        return colors.dayPush;
      case 'Pull':
        return colors.dayPull;
      case 'Upper2':
        return colors.dayUpper;
      case 'Outdoor':
        return colors.dayOutdoor;
      default:
        return colors.gray500;
    }
  };

  const content = (
    <>
      <View style={styles.scheduleLeft}>
        <Text style={styles.scheduleDay}>{day}</Text>
        <View style={[styles.scheduleTypeBadge, { backgroundColor: getTypeColor() }]}>
          <Text style={styles.scheduleTypeText}>{type}</Text>
        </View>
      </View>
      {!disabled && <Text style={styles.scheduleEdit}>✎ Edit</Text>}
    </>
  );

  if (disabled || !onPress) {
    return (
      <View style={[styles.scheduleRow, disabled && styles.scheduleRowDisabled]}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.scheduleRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {content}
    </TouchableOpacity>
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  versionText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  descriptionText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.base * 1.5,
  },
  settingButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  settingButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  settingButtonSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  scheduleCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  scheduleRowDisabled: {
    opacity: 0.5,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scheduleDay: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    minWidth: 90,
  },
  scheduleEdit: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  scheduleTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  scheduleTypeText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  aboutText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.base * 1.5,
  },
  dangerButton: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  devToolsButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.gray50,
  },
  profileInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  profileLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  profileValue: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'capitalize',
  },
  noProfileText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.md,
    textAlign: 'center',
    padding: spacing.md,
  },
  planButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  dayTypeIndicator: {
    width: 4,
    height: 48,
    borderRadius: 2,
  },
  planButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  planButtonSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  planButtonArrow: {
    fontSize: typography.fontSize['2xl'],
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
  },
  scheduleButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  scheduleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  scheduleButtonText: {
    flex: 1,
  },
  scheduleButtonTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  scheduleButtonSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * 1.4,
  },
  scheduleButtonArrow: {
    fontSize: typography.fontSize['2xl'],
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
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
});
