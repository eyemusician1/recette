import React from 'react';
import {View, StyleSheet} from 'react-native';
import {palette} from '../tokens';

export function AccentRule() {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <View style={styles.dot} />
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  line: {
    width: 48,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.rust,
    opacity: 0.6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: palette.gold,
    opacity: 0.75,
  },
});
