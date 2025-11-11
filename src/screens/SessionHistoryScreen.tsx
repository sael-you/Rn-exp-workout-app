/**
 * Session History Screen
 * View, edit, and delete past workout sessions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, getDayTypeColor, getDayTypeDisplayName } from '../theme';
import { useModal } from '../contexts/ModalContext';
import { GymSession, OutdoorSession } from '../models/types';
import {
  loadGymSessions,
  loadOutdoorSessions,
  deleteGymSession,
  deleteOutdoorSession,
  loadExerciseCatalog,
} from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionHistory'>;

export default function SessionHistoryScreen({ navigation }: Props) {
  const { showModal, showError, showSuccess } = useModal();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gymSessions, setGymSessions] = useState<GymSession[]>([]);
  const [outdoorSessions, setOutdoorSessions] = useState<OutdoorSession[]>([]);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const [gym, outdoor, catalog] = await Promise.all([
        loadGymSessions(),
        loadOutdoorSessions(),
        loadExerciseCatalog(),
      ]);

      // Create exercise name lookup
      const names: Record<string, string> = {};
      catalog?.exercises.forEach((ex) => {
        names[ex.id] = ex.name;
      });

      setGymSessions(gym);
      setOutdoorSessions(outdoor);
      setExerciseNames(names);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading sessions:', error);
      showError('Error', 'Failed to load session history');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  const handleDeleteGymSession = (session: GymSession) => {
    showModal({
      type: 'warning',
      title: 'Delete Session?',
      message: `Are you sure you want to delete this ${getDayTypeDisplayName(session.dayType)} session from ${format(new Date(session.date), 'MMM d, yyyy')}? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGymSession(session.id);
              showSuccess('Deleted', 'Session deleted successfully');
              loadSessions();
            } catch (error) {
              showError('Error', 'Failed to delete session');
            }
          },
        },
      ],
    });
  };

  const handleDeleteOutdoorSession = (session: OutdoorSession) => {
    showModal({
      type: 'warning',
      title: 'Delete Session?',
      message: `Are you sure you want to delete this Outdoor session from ${format(new Date(session.date), 'MMM d, yyyy')}? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOutdoorSession(session.id);
              showSuccess('Deleted', 'Session deleted successfully');
              loadSessions();
            } catch (error) {
              showError('Error', 'Failed to delete session');
            }
          },
        },
      ],
    });
  };

  const handleEditSession = (session: GymSession) => {
    navigation.navigate('EditSession', { sessionId: session.id });
  };

  // Combine and sort sessions by date
  const allSessions = [
    ...gymSessions.map((s) => ({ ...s, type: 'gym' as const })),
    ...outdoorSessions.map((s) => ({ ...s, type: 'outdoor' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  if (allSessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={64} color={colors.gray400} />
        <Text style={styles.emptyTitle}>No Sessions Yet</Text>
        <Text style={styles.emptyText}>
          Your workout history will appear here once you complete your first session
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {allSessions.map((session) => {
        if (session.type === 'gym') {
          const gymSession = session as GymSession & { type: 'gym' };
          const totalSets = gymSession.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
          const totalVolume = gymSession.exercises.reduce(
            (sum, ex) =>
              sum + ex.sets.reduce((setSum, set) => setSum + set.weight * set.reps, 0),
            0
          );

          return (
            <View key={gymSession.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View style={styles.sessionHeaderLeft}>
                  <View
                    style={[
                      styles.dayTypeIndicator,
                      { backgroundColor: getDayTypeColor(gymSession.dayType) },
                    ]}
                  />
                  <View>
                    <Text style={styles.sessionTitle}>
                      {getDayTypeDisplayName(gymSession.dayType)} Day
                    </Text>
                    <Text style={styles.sessionDate}>
                      {format(new Date(gymSession.date), 'EEEE, MMM d, yyyy')}
                    </Text>
                  </View>
                </View>
                <View style={styles.sessionActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditSession(gymSession)}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteGymSession(gymSession)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sessionStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{gymSession.exercises.length}</Text>
                  <Text style={styles.statLabel}>exercises</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalSets}</Text>
                  <Text style={styles.statLabel}>sets</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{Math.round(totalVolume)}kg</Text>
                  <Text style={styles.statLabel}>volume</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{Math.round((gymSession.duration || 0) / 60)}'</Text>
                  <Text style={styles.statLabel}>duration</Text>
                </View>
              </View>

              {gymSession.exercises.length > 0 && (
                <View style={styles.exerciseList}>
                  <Text style={styles.exerciseListTitle}>Exercises:</Text>
                  {gymSession.exercises.slice(0, 3).map((ex, idx) => (
                    <Text key={idx} style={styles.exerciseItem}>
                      • {exerciseNames[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')} (
                      {ex.sets.length} sets)
                    </Text>
                  ))}
                  {gymSession.exercises.length > 3 && (
                    <Text style={styles.exerciseItem}>
                      + {gymSession.exercises.length - 3} more
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        } else {
          const outdoorSession = session as OutdoorSession & { type: 'outdoor' };
          return (
            <View key={outdoorSession.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View style={styles.sessionHeaderLeft}>
                  <View
                    style={[
                      styles.dayTypeIndicator,
                      { backgroundColor: getDayTypeColor('Outdoor') },
                    ]}
                  />
                  <View>
                    <Text style={styles.sessionTitle}>Outdoor Day</Text>
                    <Text style={styles.sessionDate}>
                      {format(new Date(outdoorSession.date), 'EEEE, MMM d, yyyy')}
                    </Text>
                  </View>
                </View>
                <View style={styles.sessionActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteOutdoorSession(outdoorSession)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sessionStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {((outdoorSession.distance || 0) / 1000).toFixed(1)}km
                  </Text>
                  <Text style={styles.statLabel}>distance</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {Math.round((outdoorSession.duration || 0) / 60)}'
                  </Text>
                  <Text style={styles.statLabel}>duration</Text>
                </View>
              </View>
            </View>
          );
        }
      })}
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
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sessionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dayTypeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  sessionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  sessionDate: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  exerciseList: {
    marginTop: spacing.md,
  },
  exerciseListTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  exerciseItem: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
    lineHeight: typography.fontSize.sm * 1.6,
  },
});
