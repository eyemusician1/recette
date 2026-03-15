import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import {RootNavigator} from './src/navigation/RootNavigator';
import {palette} from './src/tokens';

function App(): React.JSX.Element {
  useEffect(() => {
    // Enable Firestore offline persistence
    // Saved recipes, cook history, and profile data
    // will be cached locally and available without internet
    firestore().settings({
      persistence: true,
      cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={palette.noir} />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;