import React, { useState, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmVariant: 'primary',
    resolve: null
  });

  const showConfirm = useCallback(({ title, message, confirmText, cancelText, confirmVariant }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: title || 'Confirmation Required',
        message: message || '',
        confirmText: confirmText || 'Proceed',
        cancelText: cancelText || 'Cancel',
        confirmVariant: confirmVariant || 'primary',
        resolve
      });
    });
  }, []);

  const handleConfirm = () => {
    if (confirmState.resolve) confirmState.resolve(true);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (confirmState.resolve) confirmState.resolve(false);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const ConfirmDialog = (
    <ConfirmModal
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      confirmVariant={confirmState.confirmVariant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { showConfirm, ConfirmDialog };
};
