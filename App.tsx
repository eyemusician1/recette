import React from 'react';
import {LogBox, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import {RootNavigator} from './src/navigation/RootNavigator';
import {palette} from './src/tokens';

// Suppress RNFirebase v21 deprecation warnings
// These are harmless — full modular API support comes in v22
LogBox.ignoreLogs([
  'This method is deprecated',
  'react-native-firebase',
]);

// Enable Firestore offline persistence
// Saved recipes will be available even without internet
try {
  firestore().settings({
    persistence: true,
    cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
  });
} catch {
  // Settings already applied on a previous run — safe to ignore
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={palette.noir} />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;