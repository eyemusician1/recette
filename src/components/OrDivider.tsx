import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {palette, spacing, typography} from '../tokens';

export function OrDivider() {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>or</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 280,
    marginVertical: spacing.sm,
    opacity: 0.4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.gold,
  },
  text: {
    fontFamily: typography.cormorantItalic,
    fontSize: typography.size.xs,
    color: palette.gold,
    letterSpacing: 1.8,
  },
});