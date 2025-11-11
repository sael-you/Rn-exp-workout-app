/**
 * Stretch Routine Modal
 * Guides user through post-workout stretches with countdown timer
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { Exercise } from '../models/types';

const { width } = Dimensions.get('window');

interface StretchRoutineModalProps {
  visible: boolean;
  stretches: Exercise[];
  onComplete: () => void;
  onSkip: () => void;
}

export default function StretchRoutineModal({
  visible,
  stretches,
  onComplete,
  onSkip,
}: StretchRoutineModalProps) {
  const [currentStretchIndex, setCurrentStretchIndex] = useState(0);
  const [isStretching, setIsStretching] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30); // Default 30 seconds per stretch
  const [showIntro, setShowIntro] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const currentStretch = stretches[currentStretchIndex];
  const isLastStretch = currentStretchIndex === stretches.length - 1;

  // Image looping animation
  useEffect(() => {
    if (!currentStretch?.imageUrls || currentStretch.imageUrls.length <= 1) return;

    const imageInterval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % currentStretch.imageUrls!.length);
    }, 500); // Change image every 500ms for smooth animation

    return () => clearInterval(imageInterval);
  }, [currentStretch]);

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isStretching && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up, move to next stretch
            handleNext();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isStretching, timeRemaining]);

  const handleStart = () => {
    setShowIntro(false);
    setIsStretching(true);
    setTimeRemaining(30);
  };

  const handleGo = () => {
    setIsStretching(true);
    setTimeRemaining(30);
  };

  const handleNext = () => {
    setIsStretching(false);

    if (isLastStretch) {
      // All stretches completed
      onComplete();
      resetModal();
    } else {
      // Move to next stretch
      setCurrentStretchIndex((prev) => prev + 1);
      setTimeRemaining(30);
    }
  };

  const handleSkipStretch = () => {
    setIsStretching(false);
    if (isLastStretch) {
      onComplete();
      resetModal();
    } else {
      setCurrentStretchIndex((prev) => prev + 1);
      setTimeRemaining(30);
    }
  };

  const resetModal = () => {
    setCurrentStretchIndex(0);
    setIsStretching(false);
    setTimeRemaining(30);
    setShowIntro(true);
  };

  const formatTime = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onSkip}
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        {/* Intro Screen */}
        {showIntro && (
          <View style={styles.introContainer}>
            <Ionicons name="fitness" size={64} color={colors.success} />
            <Text style={styles.introTitle}>Time to Stretch!</Text>
            <Text style={styles.introSubtitle}>
              Stretching after your workout helps reduce muscle soreness and improve flexibility.
            </Text>
            <Text style={styles.introInfo}>
              {stretches.length} stretches • ~{Math.ceil(stretches.length * 30 / 60)} minutes
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.startButton} onPress={handleStart}>
                <Text style={styles.startButtonText}>Start Stretching</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
                <Text style={styles.skipButtonText}>Skip for Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stretch Routine */}
        {!showIntro && currentStretch && (
          <View style={styles.stretchContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onSkip} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.progressText}>
                {currentStretchIndex + 1} / {stretches.length}
              </Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
              {stretches.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index <= currentStretchIndex && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>

            {/* Exercise Image */}
            <View style={styles.imageContainer}>
              {currentStretch.imageUrls && currentStretch.imageUrls.length > 0 ? (
                <Image
                  source={{ uri: currentStretch.imageUrls[currentImageIndex] }}
                  style={styles.exerciseImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.exerciseImage, styles.placeholderImage]}>
                  <Ionicons name="body" size={80} color={colors.gray400} />
                </View>
              )}
            </View>

            {/* Exercise Name */}
            <Text style={styles.exerciseName}>{currentStretch.name}</Text>

            {/* Timer */}
            <View style={styles.timerContainer}>
              <View style={[
                styles.timerCircle,
                isStretching && styles.timerCircleActive,
              ]}>
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              </View>
            </View>

            {/* Instructions (if available) */}
            {currentStretch.instructions && currentStretch.instructions.length > 0 && (
              <View style={styles.instructionsContainer}>
                <Text style={styles.instructionText}>
                  {currentStretch.instructions[0]}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {!isStretching ? (
                <>
                  <TouchableOpacity
                    style={styles.goButton}
                    onPress={handleGo}
                  >
                    <Ionicons name="play" size={24} color={colors.white} />
                    <Text style={styles.goButtonText}>Go</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipStretchButton}
                    onPress={handleSkipStretch}
                  >
                    <Text style={styles.skipStretchButtonText}>Skip</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNext}
                >
                  <Text style={styles.nextButtonText}>
                    {isLastStretch ? 'Finish' : 'Next Stretch'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.white} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  introContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  introTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: typography.fontSize.lg * 1.5,
  },
  introInfo: {
    fontSize: typography.fontSize.base,
    color: colors.success,
    marginTop: spacing.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonContainer: {
    width: '100%',
    marginTop: spacing.xl * 2,
    gap: spacing.md,
  },
  startButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  skipButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  stretchContainer: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  closeButton: {
    padding: spacing.xs,
  },
  progressText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  progressBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  progressDot: {
    flex: 1,
    height: 4,
    backgroundColor: colors.gray300,
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: colors.success,
  },
  imageContainer: {
    width: width,
    height: width * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  exerciseImage: {
    width: width * 0.8,
    height: width * 0.6,
  },
  placeholderImage: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.gray300,
  },
  timerCircleActive: {
    borderColor: colors.success,
    backgroundColor: colors.success + '20',
  },
  timerText: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  instructionsContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  instructionText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
  },
  actionButtons: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  goButton: {
    flexDirection: 'row',
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  goButtonText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  skipStretchButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  skipStretchButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  nextButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
});
