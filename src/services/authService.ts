import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';
import {Platform} from 'react-native';

export type TtsLanguage = 'en-US' | 'tl-PH';
export type TtsVoiceGender = 'male' | 'female';
export type FoodPreferenceStrictness = 'prefer' | 'avoid' | 'strict';
export type UserFoodPreferences = {
  dietaryPreferences?: string[];
  allergies?: string[];
  excludedIngredients?: string[];
  foodPreferenceStrictness?: FoodPreferenceStrictness;
};

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
      allergies: [],
      excludedIngredients: [],
      foodPreferenceStrictness: 'strict',
      ttsLanguage: 'en-US',
      ttsVoiceGender: 'male',
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
  return snap.exists() ? snap.data() : null;
}

export async function updateDietaryPreferences(uid: string, prefs: string[]) {
  await firestore().collection('users').doc(uid).update({
    dietaryPreferences: prefs,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function updateFoodPreferences(uid: string, prefs: UserFoodPreferences) {
  await firestore().collection('users').doc(uid).set({
    ...prefs,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

export async function updateTtsSettings(
  uid: string,
  settings: {ttsLanguage?: TtsLanguage; ttsVoiceGender?: TtsVoiceGender},
) {
  await firestore().collection('users').doc(uid).set({
    ...settings,
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

export function isHuaweiFamilyDevice() {
  if (Platform.OS !== 'android') {
    return false;
  }

  const constants: any = Platform.constants ?? {};
  const brand = (constants.Brand ?? constants.brand ?? '').toString().toLowerCase();
  const manufacturer = (constants.Manufacturer ?? constants.manufacturer ?? '').toString().toLowerCase();
  return (
    brand.includes('huawei') ||
    manufacturer.includes('huawei') ||
    brand.includes('honor') ||
    manufacturer.includes('honor')
  );
}

export async function signInAnonymously() {
  try {
    const result = await auth().signInAnonymously();
    await upsertUserProfile(result.user);
    return {success: true, user: result.user};
  } catch (error: any) {
    return {success: false, error: error.message};
  }
}