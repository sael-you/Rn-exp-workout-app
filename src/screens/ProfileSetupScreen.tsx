/**
 * Profile Setup Screen
 * Onboarding flow to collect user profile for AI coach
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography } from '../theme';
import { useModal } from '../contexts/ModalContext';
import { TrainingGoal, ExperienceLevel, TrainingSplit, UserProfile, UserInjury, WeeklyProgram, TrainingDay } from '../models/types';
import { saveUserProfile, saveWorkoutPlan, saveWeeklyProgram } from '../services/storage';
import { generateWorkoutProgram } from '../services/geminiAI';
import { initializeExerciseCatalog } from '../services/exerciseDB';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation }: Props) {
  const { showSuccess, showError, showModal } = useModal();
  const [step, setStep] = useState(1);
  const [primaryGoal, setPrimaryGoal] = useState<TrainingGoal>('hypertrophy');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [trainingSplit, setTrainingSplit] = useState<TrainingSplit>('muscle_group'); // NEW
  const [hasInjuries, setHasInjuries] = useState(false);
  const [injuryText, setInjuryText] = useState('');
  const [mobilityIssuesText, setMobilityIssuesText] = useState('');
  const [workoutLocation, setWorkoutLocation] = useState<'gym' | 'home'>('gym');
  const [availableEquipment, setAvailableEquipment] = useState<string[]>(['Bodyweight']);
  const [weeklyFrequency, setWeeklyFrequency] = useState(3);

  // Auto-adjust frequency when switching to body part split
  React.useEffect(() => {
    if (trainingSplit === 'body_part' && weeklyFrequency < 4) {
      setWeeklyFrequency(4);
    }
  }, [trainingSplit]);
  const [legTrainingPreference, setLegTrainingPreference] = useState<'none' | 'spread' | 'dedicated'>('spread');
  const [includeOutdoor, setIncludeOutdoor] = useState(true);
  const [outdoorDayPreference, setOutdoorDayPreference] = useState<number>(0); // Sunday by default
  const [generating, setGenerating] = useState(false);

  // Calculate total steps (8 if home, 7 if gym)
  const totalSteps = workoutLocation === 'home' ? 8 : 7;

  const toggleEquipment = (equipment: string) => {
    setAvailableEquipment((prev) =>
      prev.includes(equipment)
        ? prev.filter((e) => e !== equipment)
        : [...prev, equipment]
    );
  };

  const handleNext = () => {
    // Skip equipment step if gym workout
    if (step === 5 && workoutLocation === 'gym') {
      setStep(7); // Skip to frequency step
      return;
    }

    // Validate equipment selection for home workouts
    if (step === 6 && workoutLocation === 'home' && availableEquipment.length === 0) {
      showError('No Equipment Selected', 'Please select at least Bodyweight or one equipment type you have available.');
      return;
    }

    // Validate frequency for body part split
    if (step === 7 && trainingSplit === 'body_part' && weeklyFrequency < 4) {
      showError('Frequency Too Low', 'Body part splits require at least 4 days per week to train all muscles effectively. Please choose 4+ days or switch to Muscle Group Training.');
      return;
    }

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleGenerateProgram();
    }
  };

  const handleBack = () => {
    // Skip equipment step when going back if gym workout
    if (step === 7 && workoutLocation === 'gym') {
      setStep(5); // Go back to location step
      return;
    }

    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleGenerateProgram = async () => {
    try {
      console.log('=== Starting Program Generation ===');
      setGenerating(true);

      // Parse injuries
      const injuries: UserInjury[] = [];
      if (hasInjuries && injuryText.trim()) {
        const injuryLines = injuryText.split('\n').filter((line) => line.trim());
        injuryLines.forEach((line) => {
          injuries.push({
            bodyPart: line.trim(),
            type: 'User reported',
          });
        });
      }

      // Parse mobility issues
      const mobilityIssues = mobilityIssuesText
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => line.trim());

      // Create user profile
      const profile: UserProfile = {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        primaryGoal,
        experienceLevel,
        trainingSplit, // NEW: training split preference
        injuries: injuries.length > 0 ? injuries : undefined,
        mobilityIssues: mobilityIssues.length > 0 ? mobilityIssues : undefined,
        workoutLocation,
        availableEquipment: workoutLocation === 'home' ? availableEquipment : undefined,
        weeklyFrequency,
        legTrainingPreference,
        outdoorDayPreference: includeOutdoor ? outdoorDayPreference : undefined,
        aiGeneratedProgramDate: new Date().toISOString(),
      };
      console.log('Profile created:', {
        goal: profile.primaryGoal,
        level: profile.experienceLevel,
        hasInjuries: !!profile.injuries,
        hasMobilityIssues: !!profile.mobilityIssues,
      });

      // Save profile
      await saveUserProfile(profile);
      console.log('Profile saved successfully');

      // Initialize and load exercise catalog
      console.log('Initializing exercise catalog...');
      const catalog = await initializeExerciseCatalog();
      console.log('Exercise catalog loaded:', catalog?.exercises?.length || 0, 'exercises');
      if (!catalog || !catalog.exercises || catalog.exercises.length === 0) {
        showError('Error', 'Failed to fetch exercise database. Please check your internet connection.');
        setGenerating(false);
        return;
      }

      // Generate workout program
      console.log('Calling AI to generate workout program...');
      const workoutPlan = await generateWorkoutProgram(profile, catalog.exercises);
      console.log('=== Generated Workout Plan ===');
      console.log('Plan ID:', workoutPlan.id);
      console.log('Plan name:', workoutPlan.name);
      console.log('Training Split:', workoutPlan.trainingSplit);
      console.log('User Goal:', profile.primaryGoal);
      console.log('User Experience:', profile.experienceLevel);

      // Log exercises based on split type
      Object.entries(workoutPlan.plans).forEach(([dayType, dayPlan]) => {
        if (dayPlan && dayPlan.exercises) {
          console.log(`\n📋 ${dayType.toUpperCase()} DAY (${dayPlan.exercises.length} exercises):`);
          dayPlan.exercises.forEach((ex, i) => {
            const exercise = catalog.exercises.find(e => e.id === ex.exerciseId);
            console.log(`  ${i + 1}. ${exercise?.name || ex.exerciseId}`);
            console.log(`     Equipment: ${exercise?.equipment || 'unknown'}`);
            console.log(`     Target: ${exercise?.target || 'unknown'}`);
            console.log(`     Volume: ${ex.targetSets} sets × ${ex.repRangeMin}-${ex.repRangeMax} reps`);
            console.log(`     Rationale: ${ex.notes || 'none'}`);
          });
        }
      });

      // Save workout plan
      console.log('Saving workout plan to storage...');
      await saveWorkoutPlan(workoutPlan);
      console.log('Workout plan saved to storage');

      // Create weekly program based on user preferences
      console.log('Creating weekly program...');

      // Determine which days to schedule based on training split and frequency
      const trainingDays: TrainingDay[] = [];
      let dayId = 1;

      // Reserve outdoor day first to avoid conflicts
      const reservedDay = includeOutdoor ? outdoorDayPreference : -1;
      const usedDays = new Set<number>();
      if (reservedDay >= 0) {
        usedDays.add(reservedDay);
      }

      // Helper function to get available days (excluding outdoor day and already used days)
      const getAvailableDays = (): number[] => {
        const allDays = [1, 2, 3, 4, 5, 6]; // Mon-Sat (avoid Sunday for gym)
        return allDays.filter(day => !usedDays.has(day));
      };

      // Helper function to assign gym day, avoiding conflicts
      const assignGymDay = (preferredDay: number): number => {
        // If preferred day is available, use it
        if (!usedDays.has(preferredDay)) {
          usedDays.add(preferredDay);
          return preferredDay;
        }

        // Otherwise, find the closest available day
        const availableDays = getAvailableDays();
        if (availableDays.length === 0) {
          // No days available (shouldn't happen with valid configs)
          console.error('No available days for gym training!');
          return preferredDay; // Fallback
        }

        // Find closest available day to preferred day
        let closestDay = availableDays[0];
        let minDistance = Math.abs(closestDay - preferredDay);

        for (const day of availableDays) {
          const distance = Math.abs(day - preferredDay);
          if (distance < minDistance) {
            minDistance = distance;
            closestDay = day;
          }
        }

        usedDays.add(closestDay);
        console.log(`Shifted gym day from ${preferredDay} to ${closestDay} to avoid conflict`);
        return closestDay;
      };

      if (trainingSplit === 'muscle_group') {
        // === MUSCLE GROUP SPLIT (Push/Pull/Legs) ===
        // 3x: Mon (Push), Wed (Pull), Fri (Upper2 or Legs)
        // 4x: Mon (Push), Tue (Pull), Thu (Legs), Sat (Upper2)
        // 5x: Mon (Push), Tue (Pull), Wed (Legs), Fri (Upper2), Sat (Push)

        if (weeklyFrequency === 3) {
          if (legTrainingPreference === 'dedicated') {
            // 3x with dedicated leg day: Mon (Push), Wed (Pull), Fri (Legs)
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Push', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(3), dayType: 'Pull', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(5), dayType: 'Legs', enabled: true }
            );
          } else {
            // 3x standard PPL: Mon (Push), Wed (Pull), Fri (Upper2)
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Push', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(3), dayType: 'Pull', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(5), dayType: 'Upper2', enabled: true }
            );
          }
        } else if (weeklyFrequency === 4) {
          if (legTrainingPreference === 'dedicated') {
            // 4x with dedicated leg day: Mon (Push), Tue (Pull), Thu (Legs), Sat (Upper2)
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Push', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(2), dayType: 'Pull', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(4), dayType: 'Legs', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(6), dayType: 'Upper2', enabled: true }
            );
          } else {
            // 4x without dedicated legs: Mon (Push), Tue (Pull), Thu (Upper2), Sat (Push)
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Push', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(2), dayType: 'Pull', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(4), dayType: 'Upper2', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(6), dayType: 'Push', enabled: true }
            );
          }
        } else if (weeklyFrequency === 5) {
          if (legTrainingPreference === 'dedicated') {
            // 5x with dedicated leg day: Mon (Push), Tue (Pull), Wed (Legs), Fri (Upper2), Sat (Push)
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Push', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(2), dayType: 'Pull', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(3), dayType: 'Legs', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(5), dayType: 'Upper2', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(6), dayType: 'Push', enabled: true }
            );
          } else {
            // 5x without dedicated legs: Mon (Push), Tue (Pull), Wed (Upper2), Fri (Push), Sat (Pull)
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Push', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(2), dayType: 'Pull', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(3), dayType: 'Upper2', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(5), dayType: 'Push', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(6), dayType: 'Pull', enabled: true }
            );
          }
        }
      } else {
        // === BODY PART SPLIT (Chest/Back/Shoulders/Arms) ===
        // 4x: Mon (Chest), Tue (Back), Thu (Shoulders), Sat (Arms)
        // 5x: Mon (Chest), Tue (Back), Wed (Shoulders), Fri (Arms), Sat (Legs)

        if (weeklyFrequency === 4) {
          if (legTrainingPreference === 'dedicated') {
            // 4x with legs: Chest, Back, Shoulders, Legs (Arms get less priority)
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Chest', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(2), dayType: 'Back', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(4), dayType: 'Shoulders', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(6), dayType: 'Legs', enabled: true }
            );
          } else {
            // 4x standard: Chest, Back, Shoulders, Arms
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Chest', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(2), dayType: 'Back', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(4), dayType: 'Shoulders', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(6), dayType: 'Arms', enabled: true }
            );
          }
        } else if (weeklyFrequency === 5) {
          if (legTrainingPreference === 'dedicated') {
            // 5x full split: Chest, Back, Shoulders, Arms, Legs
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Chest', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(2), dayType: 'Back', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(3), dayType: 'Shoulders', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(5), dayType: 'Arms', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(6), dayType: 'Legs', enabled: true }
            );
          } else {
            // 5x upper only: Chest x2, Back x2, Shoulders
            trainingDays.push(
              { id: String(dayId++), dayOfWeek: assignGymDay(1), dayType: 'Chest', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(2), dayType: 'Back', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(3), dayType: 'Shoulders', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(5), dayType: 'Arms', enabled: true },
              { id: String(dayId++), dayOfWeek: assignGymDay(6), dayType: 'Chest', enabled: true }
            );
          }
        }
      }

      // Add outdoor day if user wants it
      if (includeOutdoor && outdoorDayPreference !== undefined) {
        trainingDays.push({
          id: String(dayId++),
          dayOfWeek: outdoorDayPreference,
          dayType: 'Outdoor',
          enabled: true,
        });
      }

      const weeklyProgram: WeeklyProgram = {
        trainingDays,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveWeeklyProgram(weeklyProgram);
      console.log('Weekly program created and saved:', weeklyProgram);

      setGenerating(false);

      showModal({
        type: 'success',
        title: 'Program Generated!',
        message: 'Your personalized workout program has been created based on your profile. You can view and customize it in the Settings screen.',
        buttons: [
          {
            text: 'View Program',
            onPress: () => navigation.navigate('MainTabs'),
            style: 'primary',
          },
        ],
      });
    } catch (error) {
      console.error('Error generating program:', error);
      setGenerating(false);
      showError(
        'Generation Failed',
        'Failed to generate workout program. Please try again or create a manual program in Settings.'
      );
    }
  };

  if (generating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Generating your personalized program...</Text>
        <Text style={styles.loadingSubtext}>This may take 10-15 seconds</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <View
            key={s}
            style={[styles.progressDot, step >= s && styles.progressDotActive]}
          />
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Step 1: Primary Goal */}
        {step === 1 && (
          <View>
            <Text style={styles.title}>What's your primary goal?</Text>
            <Text style={styles.subtitle}>
              This helps the AI design a program tailored to your objectives
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, primaryGoal === 'strength' && styles.optionCardSelected]}
              onPress={() => setPrimaryGoal('strength')}
            >
              <Text style={styles.optionTitle}>💪 Strength</Text>
              <Text style={styles.optionDescription}>
                Get stronger, lift heavier weights, focus on low reps
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, primaryGoal === 'hypertrophy' && styles.optionCardSelected]}
              onPress={() => setPrimaryGoal('hypertrophy')}
            >
              <Text style={styles.optionTitle}>💎 Hypertrophy (Muscle Building)</Text>
              <Text style={styles.optionDescription}>
                Build muscle mass, moderate weights, medium-high reps
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, primaryGoal === 'endurance' && styles.optionCardSelected]}
              onPress={() => setPrimaryGoal('endurance')}
            >
              <Text style={styles.optionTitle}>🏃 Endurance</Text>
              <Text style={styles.optionDescription}>
                Muscular endurance, lighter weights, high reps
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, primaryGoal === 'general_fitness' && styles.optionCardSelected]}
              onPress={() => setPrimaryGoal('general_fitness')}
            >
              <Text style={styles.optionTitle}>⚡ General Fitness</Text>
              <Text style={styles.optionDescription}>
                Balanced approach, stay healthy and active
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Experience Level */}
        {step === 2 && (
          <View>
            <Text style={styles.title}>What's your experience level?</Text>
            <Text style={styles.subtitle}>
              This determines exercise complexity and volume
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, experienceLevel === 'beginner' && styles.optionCardSelected]}
              onPress={() => setExperienceLevel('beginner')}
            >
              <Text style={styles.optionTitle}>🌱 Beginner</Text>
              <Text style={styles.optionDescription}>
                Less than 6 months of consistent training
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, experienceLevel === 'intermediate' && styles.optionCardSelected]}
              onPress={() => setExperienceLevel('intermediate')}
            >
              <Text style={styles.optionTitle}>🌿 Intermediate</Text>
              <Text style={styles.optionDescription}>
                6 months to 2 years of consistent training
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, experienceLevel === 'advanced' && styles.optionCardSelected]}
              onPress={() => setExperienceLevel('advanced')}
            >
              <Text style={styles.optionTitle}>🌳 Advanced</Text>
              <Text style={styles.optionDescription}>
                2+ years of consistent, structured training
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Training Split (NEW) */}
        {step === 3 && (
          <View>
            <Text style={styles.title}>Training approach</Text>
            <Text style={styles.subtitle}>
              Choose how you want to organize your training
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, trainingSplit === 'muscle_group' && styles.optionCardSelected]}
              onPress={() => setTrainingSplit('muscle_group')}
            >
              <Text style={styles.optionTitle}>💪 Muscle Group Training (Push/Pull/Legs)</Text>
              <Text style={styles.optionDescription}>
                Train multiple muscles together. Hit each muscle 2x per week.
                {'\n\n'}✓ More efficient workouts (6-7 exercises)
                {'\n'}✓ Higher frequency per muscle
                {'\n'}✓ Best for: Strength, Hypertrophy, General Fitness
                {'\n'}✓ Works with: 3+ days per week
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, trainingSplit === 'body_part' && styles.optionCardSelected]}
              onPress={() => setTrainingSplit('body_part')}
            >
              <Text style={styles.optionTitle}>🎯 Body Part Split (Chest/Back/etc.)</Text>
              <Text style={styles.optionDescription}>
                Dedicate each day to one muscle. Higher volume per session.
                {'\n\n'}✓ Maximum isolation (8-10 exercises per day)
                {'\n'}✓ Detailed muscle sculpting
                {'\n'}✓ Best for: Advanced Hypertrophy
                {'\n'}⚠️ Requires: 4-5+ days per week
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4: Injuries & Limitations */}
        {step === 4 && (
          <View>
            <Text style={styles.title}>Any injuries or limitations?</Text>
            <Text style={styles.subtitle}>
              Optional but important for safety. The AI will avoid problematic exercises.
            </Text>

            <TouchableOpacity
              style={[styles.checkboxRow, hasInjuries && styles.checkboxRowChecked]}
              onPress={() => setHasInjuries(!hasInjuries)}
            >
              <View style={[styles.checkbox, hasInjuries && styles.checkboxChecked]}>
                {hasInjuries && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>I have injuries or limitations</Text>
            </TouchableOpacity>

            {hasInjuries && (
              <>
                <Text style={styles.inputLabel}>Injuries (one per line)</Text>
                <TextInput
                  style={[styles.textArea, { height: 100 }]}
                  multiline
                  value={injuryText}
                  onChangeText={setInjuryText}
                  placeholder="e.g.&#10;Lower back pain&#10;Right shoulder tendonitis"
                  placeholderTextColor={colors.gray400}
                />

                <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>
                  Mobility Limitations (optional)
                </Text>
                <TextInput
                  style={[styles.textArea, { height: 80 }]}
                  multiline
                  value={mobilityIssuesText}
                  onChangeText={setMobilityIssuesText}
                  placeholder="e.g.&#10;Limited shoulder external rotation&#10;Tight hip flexors"
                  placeholderTextColor={colors.gray400}
                />
              </>
            )}
          </View>
        )}

        {/* Step 5: Workout Location */}
        {step === 5 && (
          <View>
            <Text style={styles.title}>Where do you train?</Text>
            <Text style={styles.subtitle}>
              This helps us select exercises appropriate for your equipment access
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, workoutLocation === 'gym' && styles.optionCardSelected]}
              onPress={() => setWorkoutLocation('gym')}
            >
              <Text style={styles.optionTitle}>🏋️ Gym</Text>
              <Text style={styles.optionDescription}>
                Access to barbells, machines, cables, and full equipment
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, workoutLocation === 'home' && styles.optionCardSelected]}
              onPress={() => setWorkoutLocation('home')}
            >
              <Text style={styles.optionTitle}>🏠 Home Workout</Text>
              <Text style={styles.optionDescription}>
                Limited equipment - select what you have in the next step
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 6: Available Equipment (Home Only) */}
        {step === 6 && workoutLocation === 'home' && (
          <View>
            <Text style={styles.title}>What equipment do you have?</Text>
            <Text style={styles.subtitle}>
              Select all that apply. We'll only include exercises using your available equipment.
            </Text>

            <View style={styles.equipmentGrid}>
              {[
                'Bodyweight',
                'Dumbbells',
                'Resistance Bands',
                'Pull-up Bar',
                'Bench',
                'Kettlebells',
                'Barbell',
                'Adjustable Weights',
              ].map((equip) => (
                <TouchableOpacity
                  key={equip}
                  style={[
                    styles.equipmentChip,
                    availableEquipment.includes(equip) && styles.equipmentChipActive,
                  ]}
                  onPress={() => toggleEquipment(equip)}
                >
                  <Text
                    style={[
                      styles.equipmentChipText,
                      availableEquipment.includes(equip) && styles.equipmentChipTextActive,
                    ]}
                  >
                    {equip}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.equipmentNote}>
              Selected: {availableEquipment.length > 0 ? availableEquipment.join(', ') : 'None'}
            </Text>
          </View>
        )}

        {/* Step 7: Weekly Frequency & Leg Training */}
        {step === 7 && (
          <View>
            <Text style={styles.title}>Training frequency & leg focus</Text>
            <Text style={styles.subtitle}>
              How many times per week can you train?
            </Text>

            <View style={styles.frequencySelector}>
              {(trainingSplit === 'body_part' ? [4, 5] : [3, 4, 5]).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.frequencyButton,
                    weeklyFrequency === freq && styles.frequencyButtonSelected,
                  ]}
                  onPress={() => setWeeklyFrequency(freq)}
                >
                  <Text
                    style={[
                      styles.frequencyButtonText,
                      weeklyFrequency === freq && styles.frequencyButtonTextSelected,
                    ]}
                  >
                    {freq}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {trainingSplit === 'body_part' && (
              <Text style={styles.infoText}>
                Body part splits require 4-5 days per week to train all muscle groups effectively
              </Text>
            )}

            <Text style={[styles.subtitle, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
              Leg training preference
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, legTrainingPreference === 'none' && styles.optionCardSelected]}
              onPress={() => setLegTrainingPreference('none')}
            >
              <Text style={styles.optionTitle}>No Leg Training</Text>
              <Text style={styles.optionDescription}>
                Upper body focus only - no leg exercises in gym
              </Text>
            </TouchableOpacity>

            {trainingSplit === 'muscle_group' && (
              <TouchableOpacity
                style={[styles.optionCard, legTrainingPreference === 'spread' && styles.optionCardSelected]}
                onPress={() => setLegTrainingPreference('spread')}
              >
                <Text style={styles.optionTitle}>Legs Across Sessions</Text>
                <Text style={styles.optionDescription}>
                  Add 1 leg exercise to each gym day (3x/week leg frequency)
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.optionCard, legTrainingPreference === 'dedicated' && styles.optionCardSelected]}
              onPress={() => setLegTrainingPreference('dedicated')}
            >
              <Text style={styles.optionTitle}>Dedicated Leg Day</Text>
              <Text style={styles.optionDescription}>
                Separate leg day with {trainingSplit === 'body_part' ? '6-8' : '4-5'} exercises (higher volume)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 8: Outdoor Day Preference */}
        {step === 8 && (
          <View>
            <Text style={styles.title}>Outdoor training day</Text>
            <Text style={styles.subtitle}>
              Which day works best for your outdoor cardio & legs session?
            </Text>

            <TouchableOpacity
              style={[styles.checkboxRow, includeOutdoor && styles.checkboxRowChecked]}
              onPress={() => setIncludeOutdoor(!includeOutdoor)}
            >
              <View style={[styles.checkbox, includeOutdoor && styles.checkboxChecked]}>
                {includeOutdoor && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Include outdoor day in program</Text>
            </TouchableOpacity>

            {includeOutdoor && (
              <>
                <Text style={[styles.inputLabel, { marginTop: spacing.lg, marginBottom: spacing.md }]}>
                  Preferred day for outdoor training
                </Text>
                <View style={styles.daySelector}>
                  {[
                    { label: 'Sun', value: 0 },
                    { label: 'Mon', value: 1 },
                    { label: 'Tue', value: 2 },
                    { label: 'Wed', value: 3 },
                    { label: 'Thu', value: 4 },
                    { label: 'Fri', value: 5 },
                    { label: 'Sat', value: 6 },
                  ].map((day) => (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        styles.dayButton,
                        outdoorDayPreference === day.value && styles.dayButtonSelected,
                      ]}
                      onPress={() => setOutdoorDayPreference(day.value)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          outdoorDayPreference === day.value && styles.dayButtonTextSelected,
                        ]}
                      >
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, step === 1 && { flex: 1 }]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {step === totalSteps ? 'Generate Program' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray300,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: typography.fontSize.base * 1.5,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  optionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * 1.5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  checkboxRowChecked: {
    backgroundColor: colors.gray100,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray400,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.gray300,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  frequencySelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  frequencyButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  frequencyButtonText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  frequencyButtonTextSelected: {
    color: colors.primary,
  },
  checkboxSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
    lineHeight: typography.fontSize.sm * 1.4,
  },
  daySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.surface,
  },
  dayButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  dayButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  dayButtonTextSelected: {
    color: colors.primary,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.info,
    marginTop: spacing.md,
    lineHeight: typography.fontSize.sm * 1.5,
    textAlign: 'center',
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    justifyContent: 'flex-start',
  },
  equipmentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentChipActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  equipmentChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  equipmentChipTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
  equipmentNote: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.md,
    lineHeight: typography.fontSize.sm * 1.5,
  },
});
