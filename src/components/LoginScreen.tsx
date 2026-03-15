import React from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {palette, spacing, typography} from '../tokens';

interface Props {
  onGoogleSignIn?: () => void;
}

export function LoginScreen({onGoogleSignIn}: Props) {
  return (
    <ImageBackground
      source={require('../../assets/images/login-bg.png')}
      resizeMode="cover"
      style={styles.canvas}>

      <View style={styles.overlay} />

      <View style={styles.center}>
        <Text style={styles.wordmark}>Recette</Text>
        <Text style={styles.tagline}>Cook alongside the best AI chef.</Text>

        <Pressable
          onPress={() => {
            console.log('pressed - calling onGoogleSignIn');
            onGoogleSignIn?.();
          }}
          style={({pressed}) => [styles.btn, pressed && styles.btnPressed]}>
          <View style={styles.btnShine} />
          <Text style={styles.btnLabel}>Continue with Google</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service {'&'} Privacy Policy.
        </Text>
      </View>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: palette.bistro,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,5,2,0.70)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  wordmark: {
    fontFamily: typography.serif,
    fontSize: 88,
    lineHeight: 84,
    letterSpacing: -2,
    color: '#fff8f0',
    textAlign: 'center',
    marginBottom: spacing.lg,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  tagline: {
    fontFamily: typography.imFell,
    fontSize: 17,
    color: 'rgba(245,225,185,0.92)',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: spacing.xxxl + spacing.xl,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(245,232,200,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,232,200,0.35)',
    paddingHorizontal: spacing.xxl + spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 8},
    elevation: 6,
  },
  btnPressed: {
    backgroundColor: 'rgba(245,232,200,0.2)',
    transform: [{scale: 0.97}],
  },
  btnShine: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  btnLabel: {
    fontFamily: typography.cormorant,
    fontSize: 16,
    letterSpacing: 1.6,
    color: '#fff8f0',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  terms: {
    fontFamily: typography.cormorantItalic,
    fontSize: 12,
    color: 'rgba(245,232,200,0.65)',
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
});