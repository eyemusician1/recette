import {useEffect, useState} from 'react';
import auth from '@react-native-firebase/auth';
import {FirebaseAuthTypes} from '@react-native-firebase/auth';

type AuthState = {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(
      (firebaseUser: FirebaseAuthTypes.User | null) => {
        setUser(firebaseUser);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  return {user, loading};
}