/**
 * Athlytic - Main App Entry
 * Privacy-first workout tracker with AI-powered training insights
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { ModalProvider } from './src/contexts/ModalContext';
import { initializeNotifications, setupNotificationCategories } from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    // Initialize notifications on app start
    const setupNotifications = async () => {
      await setupNotificationCategories();
      await initializeNotifications();
    };

    setupNotifications();
  }, []);

  return (
    <ModalProvider>
      <AppNavigator />
      <StatusBar style="light" />
    </ModalProvider>
  );
}
