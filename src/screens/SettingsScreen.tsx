/**
 * Settings Screen
 * Manage training schedule, export/import, preferences
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { format } from 'date-fns';
import { colors, spacing, typography } from '../theme';
import { exportAllData, importAllData, clearAllData } from '../services/storage';
// FileSystem not needed for basic export

export default function SettingsScreen() {
  const [exporting, setExporting] = useState(false);

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

      Alert.alert('Success', 'Backup exported successfully');
      setExporting(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
      setExporting(false);
    }
  };

  const handleImport = () => {
    Alert.alert(
      'Import Data',
      'To import your backup:\n\n1. Ensure you have a valid backup file\n2. Use your device\'s file manager to open the .json file\n3. Choose "Upper+Outdoor" to import\n\nNote: This feature requires implementation with expo-document-picker.',
      [{ text: 'OK' }]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your training data, habits, and settings. This cannot be undone.\n\nMake sure you have exported a backup first!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Success', 'All data cleared. Please restart the app.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {/* Training Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training Schedule</Text>
        <View style={styles.scheduleCard}>
          <ScheduleDay day="Monday" type="Push" />
          <ScheduleDay day="Wednesday" type="Pull" />
          <ScheduleDay day="Friday" type="Upper2" />
          <ScheduleDay day="Sunday" type="Outdoor" />
        </View>
        <Text style={styles.scheduleNote}>
          Note: Schedule editing coming in future update
        </Text>
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

function ScheduleDay({ day, type }: { day: string; type: string }) {
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

  return (
    <View style={styles.scheduleRow}>
      <Text style={styles.scheduleDay}>{day}</Text>
      <View style={[styles.scheduleTypeBadge, { backgroundColor: getTypeColor() }]}>
        <Text style={styles.scheduleTypeText}>{type}</Text>
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
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  scheduleDay: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
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
  scheduleNote: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
});
