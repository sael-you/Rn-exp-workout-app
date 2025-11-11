/**
 * Main App Navigator
 * Bottom tab navigation with Home, Progress, Settings
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Screens (to be created)
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SessionRunnerScreen from '../screens/SessionRunnerScreen';
import OutdoorTimerScreen from '../screens/OutdoorTimerScreen';
import ExerciseDetailScreen from '../screens/ExerciseDetailScreen';
import EditPlanScreen from '../screens/EditPlanScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import ProgramPlanningScreen from '../screens/ProgramPlanningScreen';
import AICoachScreen from '../screens/AICoachScreen';
import DeveloperToolsScreen from '../screens/DeveloperToolsScreen';
import ProgressionHistoryScreen from '../screens/ProgressionHistoryScreen';
import SessionHistoryScreen from '../screens/SessionHistoryScreen';
import EditSessionScreen from '../screens/EditSessionScreen';
import EditWeeklyScheduleScreen from '../screens/EditWeeklyScheduleScreen';
import { Exercise, GymSession, PlannedExercise } from '../models/types';

// Types for navigation
export type RootStackParamList = {
  MainTabs: undefined;
  SessionRunner: {
    dayType: GymSession['dayType'];
    date: string;
  };
  OutdoorTimer: {
    date: string;
  };
  ExerciseDetail: {
    exercise: Exercise;
    session: GymSession;
    plannedExercise: PlannedExercise;
  };
  ProgressionHistory: {
    exercise: Exercise;
    dayType: GymSession['dayType'];
  };
  EditPlan: {
    dayType: GymSession['dayType'];
  };
  SessionHistory: undefined;
  EditSession: {
    sessionId: string;
  };
  EditWeeklySchedule: undefined;
  ProfileSetup: undefined;
  AICoach: undefined;
  DeveloperTools: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  AICoachTab: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Main Tabs Navigator
 */
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#60A5FA',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#1F2937',
          borderTopWidth: 1,
          borderTopColor: '#374151',
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          height: 60 + insets.bottom,
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1F2937',
          height: 44 + insets.top,
        },
        headerTitleStyle: {
          fontSize: 16,
          fontWeight: '600',
          color: '#F9FAFB',
        },
        headerTintColor: '#F9FAFB',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Today',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AICoachTab"
        component={AICoachScreen}
        options={{
          title: 'AI Coach',
          tabBarLabel: 'AI Coach',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Root Stack Navigator
 */
const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#60A5FA',
    background: '#111827',
    card: '#1F2937',
    text: '#F9FAFB',
    border: '#374151',
    notification: '#2563EB',
  },
};

export default function AppNavigator() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={customDarkTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1F2937',
            },
            headerTitleStyle: {
              fontSize: 20,
              fontWeight: '600',
              color: '#F9FAFB',
            },
            headerTintColor: '#F9FAFB',
            headerBackTitle: 'Back',
          }}
        >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SessionRunner"
          component={SessionRunnerScreen}
          options={({ route }) => ({
            title: `${route.params.dayType} Day`,
            presentation: 'card',
          })}
        />
        <Stack.Screen
          name="OutdoorTimer"
          component={OutdoorTimerScreen}
          options={{
            title: 'Outdoor Day',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="ExerciseDetail"
          component={ExerciseDetailScreen}
          options={({ route }) => ({
            title: route.params.exercise.name,
            presentation: 'card',
          })}
        />
        <Stack.Screen
          name="ProgressionHistory"
          component={ProgressionHistoryScreen}
          options={({ route }) => ({
            title: `${route.params.exercise.name} History`,
            presentation: 'card',
          })}
        />
        <Stack.Screen
          name="EditPlan"
          component={EditPlanScreen}
          options={({ route }) => ({
            title: `Edit ${route.params.dayType} Day`,
            presentation: 'card',
          })}
        />
        <Stack.Screen
          name="ProfileSetup"
          component={ProfileSetupScreen}
          options={{
            title: 'AI Program Setup',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="AICoach"
          component={AICoachScreen}
          options={{
            title: 'AI Coach',
            presentation: 'card',
          }}
        />
        {/* Developer Tools - Only in Development */}
        {__DEV__ && (
          <Stack.Screen
            name="DeveloperTools"
            component={DeveloperToolsScreen}
            options={{
              title: 'Developer Tools',
              presentation: 'card',
            }}
          />
        )}
        <Stack.Screen
          name="SessionHistory"
          component={SessionHistoryScreen}
          options={{
            title: 'Session History',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="EditSession"
          component={EditSessionScreen}
          options={{
            title: 'Edit Session',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="EditWeeklySchedule"
          component={EditWeeklyScheduleScreen}
          options={{
            title: 'Edit Weekly Schedule',
            presentation: 'card',
          }}
        />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
