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
  steps?: string[];
  stepsByLanguage?: Record<string, string[]>;
  summary: string;
  imageUri?: string;
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

// ─── Helper ───────────────────────────────────────────────────────────────────
function userDoc(uid: string) {
  return firestore().collection('users').doc(uid);
}

// ─── Saved Recipes ────────────────────────────────────────────────────────────
export async function saveRecipe(recipe: SavedRecipe) {
  try {
    const ref = userDoc(recipe.uid).collection('savedRecipes');
    const existing = await ref.where('title', '==', recipe.title).get();
    if (!existing.empty) {return {success: false, error: 'Already saved'};}
    await ref.add({
      ...recipe,
      savedAt: firestore.FieldValue.serverTimestamp(),
    });
    return {success: true};
  } catch (e: any) {
    return {success: false, error: e.message};
  }
}

export async function unsaveRecipe(uid: string, recipeId: string) {
  try {
    await userDoc(uid).collection('savedRecipes').doc(recipeId).delete();
    return {success: true};
  } catch (e: any) {
    return {success: false, error: e.message};
  }
}

export async function getSavedRecipes(uid: string): Promise<SavedRecipe[]> {
  try {
    const snap = await userDoc(uid)
      .collection('savedRecipes')
      .orderBy('savedAt', 'desc')
      .get();
    return snap.docs.map(d => ({id: d.id, ...d.data()} as SavedRecipe));
  } catch {
    return [];
  }
}

export function subscribeSavedRecipes(
  uid: string,
  callback: (recipes: SavedRecipe[]) => void,
) {
  return userDoc(uid)
    .collection('savedRecipes')
    .orderBy('savedAt', 'desc')
    .onSnapshot(
      snap => {
        const recipes = snap.docs.map(d => ({id: d.id, ...d.data()} as SavedRecipe));
        callback(recipes);
      },
      err => console.warn('subscribeSavedRecipes error:', err),
    );
}

// ─── Cook History ─────────────────────────────────────────────────────────────
export async function addCookHistory(entry: CookHistory) {
  try {
    await userDoc(entry.uid).collection('cookHistory').add({
      ...entry,
      cookedAt: firestore.FieldValue.serverTimestamp(),
    });
    return {success: true};
  } catch (e: any) {
    return {success: false, error: e.message};
  }
}

export async function getCookHistory(uid: string): Promise<CookHistory[]> {
  try {
    const snap = await userDoc(uid)
      .collection('cookHistory')
      .orderBy('cookedAt', 'desc')
      .limit(50)
      .get();
    return snap.docs.map(d => ({id: d.id, ...d.data()} as CookHistory));
  } catch {
    return [];
  }
}

// ─── Custom Recipes ───────────────────────────────────────────────────────────
export async function createCustomRecipe(recipe: CustomRecipe) {
  try {
    const ref = await userDoc(recipe.uid).collection('customRecipes').add({
      ...recipe,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    return {success: true, id: ref.id};
  } catch (e: any) {
    return {success: false, error: e.message};
  }
}

export async function deleteCustomRecipe(uid: string, recipeId: string) {
  try {
    await userDoc(uid).collection('customRecipes').doc(recipeId).delete();
    return {success: true};
  } catch (e: any) {
    return {success: false, error: e.message};
  }
}

export function subscribeCustomRecipes(
  uid: string,
  callback: (recipes: CustomRecipe[]) => void,
) {
  return userDoc(uid)
    .collection('customRecipes')
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snap => {
        const recipes = snap.docs.map(d => ({id: d.id, ...d.data()} as CustomRecipe));
        callback(recipes);
      },
      err => console.warn('subscribeCustomRecipes error:', err),
    );
}

export async function cacheSavedRecipeSteps(
  uid: string,
  recipeId: string,
  steps: string[],
  language?: string,
) {
  try {
    const payload: any = {
      steps,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    if (language) {
      payload[`stepsByLanguage.${language}`] = steps;
    }

    await userDoc(uid).collection('savedRecipes').doc(recipeId).set(
      payload,
      {merge: true},
    );
    return {success: true};
  } catch (e: any) {
    return {success: false, error: e.message};
  }
}