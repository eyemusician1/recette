import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {palette, spacing, typography} from '../tokens';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AlertDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({pressed}) => [styles.btn, styles.cancelBtn, pressed && styles.btnPressed]}>
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={({pressed}) => [
                styles.btn,
                destructive ? styles.destructiveBtn : styles.confirmBtn,
                pressed && styles.btnPressed,
              ]}>
              <Text style={[styles.confirmLabel, destructive && styles.destructiveLabel]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44,26,14,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: palette.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xxl,
    shadowColor: palette.ink,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 8},
    elevation: 12,
  },
  title: {
    fontFamily: typography.serif,
    fontSize: 25,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  message: {
    fontFamily: typography.cormorantItalic,
    fontSize: 18,
    color: palette.body,
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{scale: 0.98}],
  },
  cancelBtn: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  confirmBtn: {
    backgroundColor: palette.terracotta,
  },
  destructiveBtn: {
    backgroundColor: 'rgba(200,82,42,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,82,42,0.3)',
  },
  cancelLabel: {
    fontFamily: typography.cormorant,
    fontSize: 18,
    fontWeight: '600',
    color: palette.body,
    letterSpacing: 0.3,
  },
  confirmLabel: {
    fontFamily: typography.cormorant,
    fontSize: 18,
    fontWeight: '600',
    color: palette.white,
    letterSpacing: 0.3,
  },
  destructiveLabel: {
    color: palette.terracotta,
  },
});