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
import { TrainingGoal, ExperienceLevel, UserProfile, UserInjury } from '../models/types';
import { saveUserProfile, saveWorkoutPlan } from '../services/storage';
import { generateWorkoutProgram } from '../services/geminiAI';
import { initializeExerciseCatalog } from '../services/exerciseDB';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation }: Props) {
  const { showSuccess, showError, showModal } = useModal();
  const [step, setStep] = useState(1);
  const [primaryGoal, setPrimaryGoal] = useState<TrainingGoal>('hypertrophy');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [hasInjuries, setHasInjuries] = useState(false);
  const [injuryText, setInjuryText] = useState('');
  const [mobilityIssuesText, setMobilityIssuesText] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleGenerateProgram();
    }
  };

  const handleBack = () => {
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
        injuries: injuries.length > 0 ? injuries : undefined,
        mobilityIssues: mobilityIssues.length > 0 ? mobilityIssues : undefined,
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
      console.log('User Goal:', profile.primaryGoal);
      console.log('User Experience:', profile.experienceLevel);
      console.log('\n📋 PUSH DAY (' + workoutPlan.plans.Push?.exercises?.length + ' exercises):');
      workoutPlan.plans.Push.exercises.forEach((ex, i) => {
        const exercise = catalog.exercises.find(e => e.id === ex.exerciseId);
        console.log(`  ${i + 1}. ${exercise?.name || ex.exerciseId}`);
        console.log(`     Equipment: ${exercise?.equipment || 'unknown'}`);
        console.log(`     Target: ${exercise?.target || 'unknown'}`);
        console.log(`     Volume: ${ex.targetSets} sets × ${ex.repRangeMin}-${ex.repRangeMax} reps`);
        console.log(`     Rationale: ${ex.notes || 'none'}`);
      });

      console.log('\n📋 PULL DAY (' + workoutPlan.plans.Pull?.exercises?.length + ' exercises):');
      workoutPlan.plans.Pull.exercises.forEach((ex, i) => {
        const exercise = catalog.exercises.find(e => e.id === ex.exerciseId);
        console.log(`  ${i + 1}. ${exercise?.name || ex.exerciseId}`);
        console.log(`     Equipment: ${exercise?.equipment || 'unknown'}`);
        console.log(`     Target: ${exercise?.target || 'unknown'}`);
        console.log(`     Volume: ${ex.targetSets} sets × ${ex.repRangeMin}-${ex.repRangeMax} reps`);
        console.log(`     Rationale: ${ex.notes || 'none'}`);
      });

      console.log('\n📋 UPPER2 DAY (' + workoutPlan.plans.Upper2?.exercises?.length + ' exercises):');
      workoutPlan.plans.Upper2.exercises.forEach((ex, i) => {
        const exercise = catalog.exercises.find(e => e.id === ex.exerciseId);
        console.log(`  ${i + 1}. ${exercise?.name || ex.exerciseId}`);
        console.log(`     Equipment: ${exercise?.equipment || 'unknown'}`);
        console.log(`     Target: ${exercise?.target || 'unknown'}`);
        console.log(`     Volume: ${ex.targetSets} sets × ${ex.repRangeMin}-${ex.repRangeMax} reps`);
        console.log(`     Rationale: ${ex.notes || 'none'}`);
      });

      // Save workout plan
      console.log('Saving workout plan to storage...');
      await saveWorkoutPlan(workoutPlan);
      console.log('Workout plan saved to storage');

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
        {[1, 2, 3].map((s) => (
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

        {/* Step 3: Injuries & Limitations */}
        {step === 3 && (
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
            {step === 3 ? 'Generate Program' : 'Next'}
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
});
