import firestore from '@react-native-firebase/firestore';

export type SavedRecipe = {
  id?: string;
  uid: string;
  title: string;
  cuisine: string;
  duration: string;
  servings: string;
  difficulty: string;
  ingredients: string[];
  summary: string;
  savedAt?: any;
};

export type CookHistory = {
  id?: string;
  uid: string;
  recipeTitle: string;
  cuisine: string;
  duration: string;
  cookedAt?: any;
};

export type CustomRecipe = {
  id?: string;
  uid: string;
  title: string;
  cuisine: string;
  duration: string;
  servings: string;
  difficulty: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  createdAt?: any;
  updatedAt?: any;
};

// ─── Saved Recipes ────────────────────────────────────────────────────────────
export async function saveRecipe(recipe: SavedRecipe) {
  const ref = firestore()
    .collection('users')
    .doc(recipe.uid)
    .collection('savedRecipes');

  // Check if already saved
  const existing = await ref.where('title', '==', recipe.title).get();
  if (!existing.empty) return {success: false, error: 'Already saved'};

  await ref.add({
    ...recipe,
    savedAt: firestore.FieldValue.serverTimestamp(),
  });
  return {success: true};
}

export async function unsaveRecipe(uid: string, recipeId: string) {
  await firestore()
    .collection('users')
    .doc(uid)
    .collection('savedRecipes')
    .doc(recipeId)
    .delete();
  return {success: true};
}

export async function getSavedRecipes(uid: string): Promise<SavedRecipe[]> {
  const snap = await firestore()
    .collection('users')
    .doc(uid)
    .collection('savedRecipes')
    .orderBy('savedAt', 'desc')
    .get();

  return snap.docs.map(doc => ({id: doc.id, ...doc.data()} as SavedRecipe));
}

export function subscribeSavedRecipes(
  uid: string,
  callback: (recipes: SavedRecipe[]) => void,
) {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('savedRecipes')
    .orderBy('savedAt', 'desc')
    .onSnapshot(snap => {
      const recipes = snap.docs.map(
        doc => ({id: doc.id, ...doc.data()} as SavedRecipe),
      );
      callback(recipes);
    });
}

// ─── Cook History ─────────────────────────────────────────────────────────────
export async function addCookHistory(entry: CookHistory) {
  await firestore()
    .collection('users')
    .doc(entry.uid)
    .collection('cookHistory')
    .add({
      ...entry,
      cookedAt: firestore.FieldValue.serverTimestamp(),
    });
  return {success: true};
}

export async function getCookHistory(uid: string): Promise<CookHistory[]> {
  const snap = await firestore()
    .collection('users')
    .doc(uid)
    .collection('cookHistory')
    .orderBy('cookedAt', 'desc')
    .limit(50)
    .get();

  return snap.docs.map(doc => ({id: doc.id, ...doc.data()} as CookHistory));
}

// ─── Custom Recipes ───────────────────────────────────────────────────────────
export async function createCustomRecipe(recipe: CustomRecipe) {
  const ref = await firestore()
    .collection('users')
    .doc(recipe.uid)
    .collection('customRecipes')
    .add({
      ...recipe,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  return {success: true, id: ref.id};
}

export async function updateCustomRecipe(
  uid: string,
  recipeId: string,
  updates: Partial<CustomRecipe>,
) {
  await firestore()
    .collection('users')
    .doc(uid)
    .collection('customRecipes')
    .doc(recipeId)
    .update({
      ...updates,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  return {success: true};
}

export async function deleteCustomRecipe(uid: string, recipeId: string) {
  await firestore()
    .collection('users')
    .doc(uid)
    .collection('customRecipes')
    .doc(recipeId)
    .delete();
  return {success: true};
}

export function subscribeCustomRecipes(
  uid: string,
  callback: (recipes: CustomRecipe[]) => void,
) {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('customRecipes')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const recipes = snap.docs.map(
        doc => ({id: doc.id, ...doc.data()} as CustomRecipe),
      );
      callback(recipes);
    });
}