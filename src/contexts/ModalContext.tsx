/**
 * Modal Context
 * Global state management for modals throughout the app
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import CustomModal, { ModalType, ModalButton } from '../components/CustomModal';

interface ModalOptions {
  type?: ModalType;
  title: string;
  message?: string;
  buttons?: ModalButton[];
  icon?: string;
  dismissable?: boolean;
}

interface ModalContextType {
  showModal: (options: ModalOptions) => void;
  hideModal: () => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [modalOptions, setModalOptions] = useState<ModalOptions>({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showModal = (options: ModalOptions) => {
    setModalOptions(options);
    setVisible(true);
  };

  const hideModal = () => {
    setVisible(false);
  };

  const showSuccess = (title: string, message?: string) => {
    showModal({
      type: 'success',
      title,
      message,
      buttons: [
        {
          text: 'OK',
          onPress: () => {},
          style: 'primary',
        },
      ],
    });
  };

  const showError = (title: string, message?: string) => {
    showModal({
      type: 'error',
      title,
      message,
      buttons: [
        {
          text: 'OK',
          onPress: () => {},
          style: 'primary',
        },
      ],
    });
  };

  const showWarning = (title: string, message?: string) => {
    showModal({
      type: 'warning',
      title,
      message,
      buttons: [
        {
          text: 'OK',
          onPress: () => {},
          style: 'primary',
        },
      ],
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => {
    showModal({
      type: 'confirm',
      title,
      message,
      buttons: [
        {
          text: 'Confirm',
          onPress: onConfirm,
          style: 'primary',
        },
        {
          text: 'Cancel',
          onPress: onCancel || (() => {}),
          style: 'cancel',
        },
      ],
    });
  };

  return (
    <ModalContext.Provider
      value={{
        showModal,
        hideModal,
        showSuccess,
        showError,
        showWarning,
        showConfirm,
      }}
    >
      {children}
      <CustomModal
        visible={visible}
        type={modalOptions.type}
        title={modalOptions.title}
        message={modalOptions.message}
        buttons={modalOptions.buttons}
        icon={modalOptions.icon}
        dismissable={modalOptions.dismissable !== false}
        onClose={hideModal}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
