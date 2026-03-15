import React from 'react';
import {Pressable, Text, View, StyleSheet} from 'react-native';
import {palette, spacing, typography} from '../tokens';

interface Props {
  onPress?: () => void;
}

function GoogleIcon() {
  return (
    <View style={icon.ring}>
      <View style={[icon.quad, {backgroundColor: '#4285F4', top: 0, left: 0}]} />
      <View style={[icon.quad, {backgroundColor: '#34A853', top: 0, right: 0}]} />
      <View style={[icon.quad, {backgroundColor: '#FBBC05', bottom: 0, left: 0}]} />
      <View style={[icon.quad, {backgroundColor: '#EA4335', bottom: 0, right: 0}]} />
      <View style={icon.center} />
    </View>
  );
}

const icon = StyleSheet.create({
  ring: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quad: {
    width: 9,
    height: 9,
    position: 'absolute',
  },
  center: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.parchment,
    top: 5,
    left: 5,
  },
});

export function GoogleSignInButton({onPress}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.button, pressed && styles.pressed]}>
      <GoogleIcon />
      <Text style={styles.label}>Continue with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: palette.parchment,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 15,
    borderRadius: spacing.xs,
    width: '100%',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  pressed: {
    opacity: 0.92,
    transform: [{scale: 0.985}],
  },
  label: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.md,
    letterSpacing: 1.2,
    color: palette.mahogany,
  },
});