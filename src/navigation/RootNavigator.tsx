import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {useAuth} from '../hooks/useAuth';
import {
  configureGoogleSignIn,
  isHuaweiFamilyDevice,
  markAppTipsSeen,
  signInAnonymously,
  signInWithGoogle,
} from '../services/authService';
import {AppNavigator} from './AppNavigator';
import {LoginScreen} from '../components/LoginScreen';
import {AlertDialog} from '../components/AlertDialog';
import {palette} from '../tokens';

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={palette.terracotta} size="large" />
    </View>
  );
}

export function RootNavigator() {
  const {user, loading} = useAuth();
  const [showNewUserTips, setShowNewUserTips] = useState(false);
  const [tipsUserId, setTipsUserId] = useState<string | null>(null);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    if (isHuaweiFamilyDevice()) {
      const fallback = await signInAnonymously();
      if (!fallback.success) {
        console.warn('Huawei anonymous sign in failed:', fallback.error);
      }
      return;
    }

    const result = await signInWithGoogle();
    if (!result.success) {
      console.warn('Sign in failed:', result.error);
      return;
    }

    if (result.isNewUser && result.user?.uid) {
      setTipsUserId(result.user.uid);
      setShowNewUserTips(true);
    }
  };

  const dismissTips = async () => {
    const uid = tipsUserId;
    setShowNewUserTips(false);
    setTipsUserId(null);

    if (!uid) {
      return;
    }

    try {
      await markAppTipsSeen(uid);
    } catch (error: any) {
      console.warn('Failed to save app tips state:', error?.message ?? error);
    }
  };

  return (
    <NavigationContainer>
      {loading ? (
        <LoadingScreen />
      ) : user ? (
        <AppNavigator />
      ) : (
        <LoginScreen onGoogleSignIn={handleGoogleSignIn} />
      )}

      <AlertDialog
        visible={showNewUserTips}
        title="Welcome to Remys"
        message={
          'Quick tips to get started:\n\n• Ask Remy for meal ideas in Cook.\n• Save favorites from Discover.\n• Set food preferences in Profile for better suggestions.'
        }
        confirmLabel="Got it"
        cancelLabel="Close"
        onConfirm={dismissTips}
        onCancel={dismissTips}
      />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});