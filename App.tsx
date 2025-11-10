/**
 * Upper+Outdoor - Main App Entry
 * Privacy-first workout tracker for 3 upper-body gym days + 1 outdoor legs/core day
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
}
