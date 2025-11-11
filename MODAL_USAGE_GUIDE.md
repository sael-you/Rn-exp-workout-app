# Custom Modal Usage Guide

Beautiful, animated modals to replace all `Alert.alert()` calls in the app.

## Setup (Already Done)

1. ✅ Created `CustomModal` component
2. ✅ Created `ModalContext` and `ModalProvider`
3. ✅ Wrapped app in `ModalProvider` (App.tsx)
4. ✅ Updated AICoachScreen and DeveloperToolsScreen

## How to Use in Your Screens

### 1. Import the Hook

```typescript
import { useModal } from '../contexts/ModalContext';
```

### 2. Use in Your Component

```typescript
export default function YourScreen() {
  const { showSuccess, showError, showWarning, showConfirm, showModal } = useModal();

  // ... your component code
}
```

### 3. Replace Alert Calls

#### Simple Success Message
```typescript
// OLD
Alert.alert('Success', 'Data saved successfully!');

// NEW ✨
showSuccess('Success', 'Data saved successfully!');
```

#### Error Message
```typescript
// OLD
Alert.alert('Error', 'Something went wrong');

// NEW ✨
showError('Error', 'Something went wrong');
```

#### Warning
```typescript
// OLD
Alert.alert('Warning', 'Please complete the form');

// NEW ✨
showWarning('Warning', 'Please complete the form');
```

#### Confirmation Dialog
```typescript
// OLD
Alert.alert(
  'Delete Item?',
  'This action cannot be undone',
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => deleteItem() }
  ]
);

// NEW ✨
showConfirm(
  'Delete Item?',
  'This action cannot be undone',
  () => deleteItem(),
  () => console.log('Cancelled')
);
```

#### Custom Modal with Multiple Buttons
```typescript
// OLD
Alert.alert(
  'Choose Action',
  'What would you like to do?',
  [
    { text: 'Option 1', onPress: () => doOption1() },
    { text: 'Option 2', onPress: () => doOption2() },
    { text: 'Cancel', style: 'cancel' }
  ]
);

// NEW ✨
showModal({
  type: 'info',
  title: 'Choose Action',
  message: 'What would you like to do?',
  buttons: [
    { text: 'Option 1', onPress: () => doOption1(), style: 'primary' },
    { text: 'Option 2', onPress: () => doOption2(), style: 'default' },
    { text: 'Cancel', onPress: () => {}, style: 'cancel' },
  ],
});
```

## Modal Types

- **`success`** - Green checkmark ✅
- **`error`** - Red X ❌
- **`warning`** - Yellow warning ⚠️
- **`info`** - Blue info ℹ️
- **`confirm`** - Question mark ❓

## Button Styles

- **`primary`** - Blue button (main action)
- **`destructive`** - Red button (delete, clear, etc.)
- **`default`** - Gray button (secondary action)
- **`cancel`** - Outline button (cancel, dismiss)

## Custom Icons

```typescript
showModal({
  type: 'success',
  title: 'Achievement Unlocked!',
  message: 'You completed 10 workouts this month!',
  icon: '🏆', // Custom icon
});
```

## Screens Still Using Alert

Search for `Alert.alert` in these files and replace with the new modal system:

```bash
# Find all Alert usage
grep -r "Alert.alert" src/screens/
```

Common screens that may need updating:
- SettingsScreen.tsx
- ProfileSetupScreen.tsx
- ProgramPlanningScreen.tsx
- SessionRunnerScreen.tsx
- OutdoorTimerScreen.tsx
- HomeScreen.tsx
- ProgressScreen.tsx

## Example Migration

### Before
```typescript
import { Alert } from 'react-native';

const handleSave = async () => {
  try {
    await saveData();
    Alert.alert('Saved', 'Your changes have been saved');
  } catch (error) {
    Alert.alert('Error', 'Failed to save');
  }
};
```

### After
```typescript
import { useModal } from '../contexts/ModalContext';

export default function MyScreen() {
  const { showSuccess, showError } = useModal();

  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Saved', 'Your changes have been saved');
    } catch (error) {
      showError('Error', 'Failed to save');
    }
  };
}
```

## Benefits

✨ **Beautiful animations** - Slide up with fade
🎨 **Better visual design** - Modern, clean, professional
📱 **Better UX** - Large touch targets, clear hierarchy
🎭 **Consistent style** - All modals look the same
🚀 **Easy to use** - Simple hooks interface
♿ **Accessible** - Proper touch areas and dismissal

## Notes

- Modals are dismissible by default (tap backdrop to close)
- Animations are smooth (300ms slide + fade)
- Multiple buttons supported
- Context is global (one modal instance)
- Modal auto-closes when button is pressed
