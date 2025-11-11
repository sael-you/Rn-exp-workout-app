/**
 * Custom Modal Component
 * Beautiful, animated modal to replace Alert dialogs
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

export type ModalType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'primary' | 'destructive' | 'cancel';
}

export interface CustomModalProps {
  visible: boolean;
  type?: ModalType;
  title: string;
  message?: string;
  buttons?: ModalButton[];
  onClose?: () => void;
  icon?: string;
  dismissable?: boolean;
}

const { height } = Dimensions.get('window');

export default function CustomModal({
  visible,
  type = 'info',
  title,
  message,
  buttons = [],
  onClose,
  icon,
  dismissable = true,
}: CustomModalProps) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getModalIcon = () => {
    if (icon) return icon;

    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'confirm':
        return '❓';
      default:
        return 'ℹ️';
    }
  };

  const getModalColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      case 'confirm':
        return colors.primary;
      default:
        return colors.info;
    }
  };

  const handleBackdropPress = () => {
    if (dismissable && onClose) {
      onClose();
    }
  };

  const renderButton = (button: ModalButton, index: number) => {
    const getButtonStyle = () => {
      switch (button.style) {
        case 'primary':
          return [styles.button, styles.primaryButton];
        case 'destructive':
          return [styles.button, styles.destructiveButton];
        case 'cancel':
          return [styles.button, styles.cancelButton];
        default:
          return [styles.button, styles.defaultButton];
      }
    };

    const getButtonTextStyle = () => {
      switch (button.style) {
        case 'primary':
          return [styles.buttonText, styles.primaryButtonText];
        case 'destructive':
          return [styles.buttonText, styles.destructiveButtonText];
        case 'cancel':
          return [styles.buttonText, styles.cancelButtonText];
        default:
          return [styles.buttonText, styles.defaultButtonText];
      }
    };

    return (
      <TouchableOpacity
        key={index}
        style={getButtonStyle()}
        onPress={() => {
          button.onPress();
          if (onClose) onClose();
        }}
        activeOpacity={0.7}
      >
        <Text style={getButtonTextStyle()}>{button.text}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismissable ? onClose : undefined}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                { transform: [{ translateY: slideAnim }] },
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: getModalColor() + '20' }]}>
                <Text style={styles.icon}>{getModalIcon()}</Text>
              </View>

              <Text style={styles.title}>{title}</Text>

              {message && <Text style={styles.message}>{message}</Text>}

              <View style={styles.buttonsContainer}>
                {buttons.length > 0 ? (
                  buttons.map((button, index) => renderButton(button, index))
                ) : (
                  <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.buttonText, styles.primaryButtonText]}>OK</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
    marginBottom: spacing.xl,
  },
  buttonsContainer: {
    gap: spacing.md,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  destructiveButton: {
    backgroundColor: colors.error,
  },
  defaultButton: {
    backgroundColor: colors.gray100,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  buttonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  primaryButtonText: {
    color: colors.white,
  },
  destructiveButtonText: {
    color: colors.white,
  },
  defaultButtonText: {
    color: colors.textPrimary,
  },
  cancelButtonText: {
    color: colors.textSecondary,
  },
});
