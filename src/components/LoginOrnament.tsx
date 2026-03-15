import React from 'react';
import {View, StyleSheet} from 'react-native';
import {palette} from '../tokens';

export function LoginOrnament() {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <View style={styles.diamond} />
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    opacity: 0.55,
  },
  line: {
    width: 60,
    height: 1,
    backgroundColor: palette.gold,
    opacity: 0.7,
  },
  diamond: {
    width: 8,
    height: 8,
    backgroundColor: palette.gold,
    transform: [{rotate: '45deg'}],
  },
});