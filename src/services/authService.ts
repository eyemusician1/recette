import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId:
      '615221177910-q7numrt62h52l23mf4ba5df35mnde8ra.apps.googleusercontent.com',
  });
}

export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    const signInResult: any = await GoogleSignin.signIn();

    // Prefer token returned by signIn to avoid an extra network request.
    let idToken: string | undefined =
      signInResult?.data?.idToken ?? signInResult?.idToken;

    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }

    if (!idToken) {
      return {
        success: false,
        error: 'Google Sign-In did not return an ID token',
      };
    }

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const result = await auth().signInWithCredential(googleCredential);
    await upsertUserProfile(result.user);
    return {success: true, user: result.user};
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return {success: false, error: 'Sign in cancelled'};
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      return {success: false, error: 'Sign in already in progress'};
    }
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return {success: false, error: 'Play services not available'};
    }
    if (error.code === 'NETWORK_ERROR' || error.message === 'NETWORK_ERROR') {
      return {
        success: false,
        error:
          'Network error during Google Sign-In. Check device date/time, Play Services, and Firebase OAuth setup.',
      };
    }
    return {success: false, error: error.message};
  }
}

export async function signOut() {
  try {
    await GoogleSignin.signOut();
    await auth().signOut();
    return {success: true};
  } catch (error: any) {
    return {success: false, error: error.message};
  }
}

export async function upsertUserProfile(user: any) {
  const ref = firestore().collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid: user.uid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      dietaryPreferences: [],
      hasSeenDiscoverWelcome: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await ref.update({
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }
}

export async function getUserProfile(uid: string) {
  const snap = await firestore().collection('users').doc(uid).get();
  const exists =
    typeof (snap as any).exists === 'function'
      ? (snap as any).exists()
      : Boolean((snap as any).exists);
  return exists ? snap.data() : null;
}

export async function updateDietaryPreferences(uid: string, prefs: string[]) {
  await firestore().collection('users').doc(uid).set({
    uid,
    dietaryPreferences: prefs,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

export async function markDiscoverWelcomeSeen(uid: string) {
  await firestore().collection('users').doc(uid).set({
    uid,
    hasSeenDiscoverWelcome: true,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

export async function resetDiscoverWelcome(uid: string) {
  await firestore().collection('users').doc(uid).set({
    uid,
    hasSeenDiscoverWelcome: false,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}