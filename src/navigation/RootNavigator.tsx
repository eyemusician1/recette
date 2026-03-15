import React, {useEffect} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {useAuth} from '../hooks/useAuth';
import {configureGoogleSignIn, signInWithGoogle} from '../services/authService';
import {AppNavigator} from './AppNavigator';
import {LoginScreen} from '../components/LoginScreen';
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

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();
    if (!result.success) {
      console.warn('Sign in failed:', result.error);
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