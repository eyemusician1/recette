import {FoodPreferenceStrictness, TtsLanguage} from '../services/authService';

export type FoodPrefsInput = {
  dietaryPreferences?: string[];
  allergies?: string[];
  excludedIngredients?: string[];
  strictness?: FoodPreferenceStrictness;
};

export function normalizeList(items?: string[]): string[] {
  return (items ?? [])
    .map(i => String(i).trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(v => v.toLowerCase() === item.toLowerCase()) === index);
}

export function splitExcludedIngredients(input: string): string[] {
  return input
    .split(/,|\n/)
    .map(v => v.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(v => v.toLowerCase() === item.toLowerCase()) === index);
}

export function buildFoodPreferenceInstruction(language: TtsLanguage, prefs: FoodPrefsInput): string {
  const dietary = normalizeList(prefs.dietaryPreferences);
  const allergies = normalizeList(prefs.allergies);
  const excluded = normalizeList(prefs.excludedIngredients);
  const strictness = prefs.strictness ?? 'strict';
  const strictnessRule = strictness === 'strict'
    ? 'hard restriction'
    : strictness === 'avoid'
      ? 'avoid when possible'
      : 'soft preference';

  const lines = [
    language === 'tl-PH'
      ? 'Sundin ang food preferences ng user sa lahat ng mungkahi.'
      : 'Strictly follow the user food preferences in all suggestions.',
    `Preference strictness: ${strictnessRule}.`,
  ];

  if (dietary.length > 0) {
    lines.push(`Dietary preferences: ${dietary.join(', ')}.`);
  }
  if (allergies.length > 0) {
    lines.push(`Allergies/intolerances (never include): ${allergies.join(', ')}.`);
  }
  if (excluded.length > 0) {
    lines.push(`Excluded ingredients (do not include): ${excluded.join(', ')}.`);
  }

  return lines.join(' ');
}

export function getPreferenceCompliance(
  recipeIngredients: string[],
  prefs: FoodPrefsInput,
): {matches: boolean; note: string} {
  const strictness = prefs.strictness ?? 'strict';
  const dietary = normalizeList(prefs.dietaryPreferences).map(v => v.toLowerCase());
  const dietaryConflictTokens = new Set<string>();

  if (dietary.includes('halal') || dietary.includes('kosher')) {
    [
      'pork',
      'prok',
      'ham',
      'bacon',
      'lard',
      'prosciutto',
      'pancetta',
      'pepperoni',
      'salami',
      'chorizo',
      'guanciale',
    ].forEach(token => dietaryConflictTokens.add(token));
  }

  if (dietary.includes('vegetarian')) {
    ['beef', 'chicken', 'pork', 'fish', 'shrimp', 'anchovy', 'gelatin'].forEach(token =>
      dietaryConflictTokens.add(token),
    );
  }

  if (dietary.includes('vegan')) {
    [
      'beef',
      'chicken',
      'pork',
      'fish',
      'shrimp',
      'anchovy',
      'gelatin',
      'milk',
      'cheese',
      'butter',
      'cream',
      'yogurt',
      'egg',
      'honey',
    ].forEach(token => dietaryConflictTokens.add(token));
  }

  const blocked = [...normalizeList(prefs.allergies), ...normalizeList(prefs.excludedIngredients)]
    .map(v => v.toLowerCase());

  if (blocked.length === 0 && dietaryConflictTokens.size === 0) {
    return {matches: true, note: 'Matches your preferences'};
  }

  const all = (recipeIngredients ?? []).join(' ').toLowerCase();
  const hits = blocked.filter(token => all.includes(token));
  const dietaryHits = Array.from(dietaryConflictTokens).filter(token => all.includes(token));
  const allHits = [...new Set([...hits, ...dietaryHits])];
  if (allHits.length === 0) {
    return {matches: true, note: 'Matches your preferences'};
  }

  const shown = allHits.slice(0, 2).join(', ');
  if (strictness === 'prefer') {
    return {matches: false, note: `Less preferred ingredients: ${shown}`};
  }
  if (strictness === 'avoid') {
    return {matches: false, note: `Contains ingredients to avoid: ${shown}`};
  }
  return {matches: false, note: `Contains restricted: ${shown}`};
}
