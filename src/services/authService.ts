import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId:
      '980431753891-f03isf38ch5j5g0shg60aevm8trihcuj.apps.googleusercontent.com',
  });
}

export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices();
    await GoogleSignin.signIn();
    const {idToken} = await GoogleSignin.getTokens();
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
  if (!snap.exists()) {
    await ref.set({
      uid: user.uid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      dietaryPreferences: [],
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