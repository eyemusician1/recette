import React, {useCallback, useState, useEffect, useRef, useMemo} from 'react';
import {ENV} from '../env';

const UNSPLASH_KEY = ENV.UNSPLASH_ACCESS_KEY;
const GROQ_KEY = ENV.GROQ_API_KEY;
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {palette, spacing, typography} from '../tokens';
import Ion from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import {useFocusEffect} from '@react-navigation/native';
import {FoodPreferenceStrictness, getUserProfile, markDiscoverWelcomeSeen, TtsLanguage} from '../services/authService';
import {saveRecipe} from '../services/recipeService';
import {buildFoodPreferenceInstruction, getPreferenceCompliance, normalizeList} from '../utils/foodPreferences';

const HERO_IMAGE = require('../../assets/images/login-bg.jpg');

// ─── Types ────────────────────────────────────────────────────────────────────
type Recipe = {
  id: string;
  title: string;
  cuisine: string;
  duration: string;
  servings: string;
  difficulty: string;
  ingredients: string[];
  summary: string;
  complianceNote?: string;
  compliant?: boolean;
};

function normalizeIngredientList(ingredients: string[]): string[] {
  return ingredients
    .map(item => String(item).trim())
    .filter(Boolean)
    .map(item => item.replace(/\s+/g, ' '))
    .filter((item, index, arr) => arr.findIndex(v => v.toLowerCase() === item.toLowerCase()) === index);
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 2,
  baseDelayMs = 300,
): Promise<Response> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, init);
      const retryableStatus = response.status >= 500 || response.status === 429;
      if (!retryableStatus || attempt >= retries) {
        return response;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw error;
      }
      if (attempt >= retries) {
        throw error;
      }
    }

    attempt += 1;
    await sleep(baseDelayMs * attempt);
  }
}


async function fetchFoodImage(query: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + " food")}&per_page=1&orientation=landscape`,
      {headers: {Authorization: `Client-ID ${UNSPLASH_KEY}`}},
      1,
      250,
    );
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

function RecipeCard({
  recipe,
  onCook,
  onSave,
  saved,
  imageUri,
  complianceNote,
  compliant,
}: {
  recipe: Recipe;
  onCook: (r: Recipe) => void;
  onSave: (r: Recipe, imageUri?: string) => void;
  saved: boolean;
  imageUri?: string;
  complianceNote?: string;
  compliant?: boolean;
}) {

  return (
    <Pressable style={({pressed}) => [styles.rcard, pressed && styles.rcardPressed]}>

      {/* Header image area */}
      <ImageBackground
        source={imageUri ? {uri: imageUri} : HERO_IMAGE}
        style={styles.rcardImg}
        imageStyle={styles.rcardImgStyle}>
        <View style={styles.rcardImgOverlay} />
        <View style={styles.rcardBadge}>
          <Text style={styles.rcardBadgeText}>{recipe.duration}</Text>
        </View>
      </ImageBackground>

      {/* Body */}
      <View style={styles.rcardBody}>
        <Text style={styles.rcardCuisine}>{recipe.cuisine}</Text>
        <Text style={styles.rcardTitle}>{recipe.title}</Text>

        <View style={styles.rcardMeta}>
          <Text style={styles.rcardMetaItem}>{recipe.servings} servings</Text>
          <View style={styles.rcardMetaDot} />
          <Text style={styles.rcardMetaItem}>{recipe.difficulty}</Text>
          <View style={styles.rcardMetaDot} />
          <Text style={styles.rcardMetaItem}>{recipe.duration}</Text>
        </View>

        <View style={styles.rcardDivider} />

        <Text style={styles.rcardSummary}>{recipe.summary}</Text>

        {complianceNote ? (
          <View style={[styles.prefBadge, compliant ? styles.prefBadgeOk : styles.prefBadgeWarn]}>
            <Text style={[styles.prefBadgeText, compliant ? styles.prefBadgeTextOk : styles.prefBadgeTextWarn]}>
              {complianceNote}
            </Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <Pressable
            onPress={() => onCook(recipe)}
            style={({pressed}) => [styles.cookBtn, pressed && styles.cookBtnPressed]}>
            <Text style={styles.cookBtnText}>Start Cooking</Text>
          </Pressable>
          <Pressable
            onPress={() => !saved && onSave(recipe, imageUri)}
            style={({pressed}) => [styles.saveBtn, saved && styles.saveBtnActive, pressed && styles.saveBtnPressed]}>
            <Ion
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={saved ? palette.white : palette.muted}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const MemoRecipeCard = React.memo(RecipeCard, (prev, next) => {
  return (
    prev.saved === next.saved &&
    prev.recipe.id === next.recipe.id &&
    prev.imageUri === next.imageUri &&
    prev.complianceNote === next.complianceNote &&
    prev.compliant === next.compliant
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function DiscoverScreen({navigation}: any) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [imageByRecipeId, setImageByRecipeId] = useState<Record<string, string>>({});
  const [showWelcome, setShowWelcome] = useState(false);
  const [contentLanguage, setContentLanguage] = useState<TtsLanguage>('en-US');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [allergyPrefs, setAllergyPrefs] = useState<string[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [preferenceStrictness, setPreferenceStrictness] = useState<FoodPreferenceStrictness>('strict');
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);
  const imageCacheRef = useRef<Map<string, string | null>>(new Map());

  useFocusEffect(useCallback(() => {
    let active = true;

    const checkWelcomeState = async () => {
      const user = auth().currentUser;
      if (!user) {
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);
        if (!active) {
          return;
        }

        const nextLanguage: TtsLanguage = profile?.ttsLanguage === 'tl-PH' ? 'tl-PH' : 'en-US';
        setContentLanguage(nextLanguage);
        setDietaryPrefs(normalizeList(profile?.dietaryPreferences));
        setAllergyPrefs(normalizeList(profile?.allergies));
        setExcludedIngredients(normalizeList(profile?.excludedIngredients));
        setPreferenceStrictness(
          profile?.foodPreferenceStrictness === 'prefer' || profile?.foodPreferenceStrictness === 'avoid'
            ? profile.foodPreferenceStrictness
            : 'strict',
        );

        const createdAt = user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : 0;
        const lastSignIn = user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : 0;
        const isFirstLogin = createdAt > 0 && lastSignIn > 0 && Math.abs(createdAt - lastSignIn) < 120000;

        if (profile?.hasSeenDiscoverWelcome === false || (profile?.hasSeenDiscoverWelcome == null && isFirstLogin)) {
          setShowWelcome(true);
          await markDiscoverWelcomeSeen(user.uid);
        }
      } catch (e) {
        console.warn('Welcome onboarding check failed:', e);
      }
    };

    checkWelcomeState();
    return () => {
      active = false;
    };
  }, []));

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      activeRequestRef.current?.abort();
    };
  }, []);

  const searchRecipes = useCallback(async (forcedQuery?: string) => {
    const searchTerm = (forcedQuery ?? query).trim();
    if (!searchTerm) {return;}

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const response = await fetchWithRetry(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 1100,
            temperature: 0.35,
            messages: [{
              role: 'system',
              content: `You are Rémy, a professional chef assistant helping home cooks.
Return only valid raw JSON array output with no markdown, no prose, and no extra keys.
Recipes must be practical, realistic, and easy to follow at home.
        Use concise and natural wording suitable for text-to-speech.
        ${contentLanguage === 'tl-PH'
          ? 'Generate title, summary, and ingredients in Tagalog (Filipino).'
          : 'Generate title, summary, and ingredients in English.'}
        ${buildFoodPreferenceInstruction(contentLanguage, {
          dietaryPreferences: dietaryPrefs,
          allergies: allergyPrefs,
          excludedIngredients,
          strictness: preferenceStrictness,
        })}`,
            }, {
              role: 'user',
              content: `The user searched for: "${searchTerm}". Return exactly 3 recipe results as a JSON array with these exact fields: [{"id": "unique string", "title": "Recipe name", "cuisine": "Cuisine type", "duration": "X min", "servings": "number", "difficulty": "Easy | Medium | Hard", "ingredients": ["ingredient with amount and prep note", ...], "summary": "One sentence description"}].
Rules:
1) Give 3 clearly different recipe ideas, not near-duplicates.
2) Use specific recipe titles and realistic cuisine labels.
3) Duration must be practical for home cooking.
4) Summary must be one sentence that highlights flavor and style.
5) For each recipe, provide 8 to 14 realistic ingredients.
6) Each ingredient must include quantity and prep note when useful.
7) Avoid vague ingredients like "seasoning" unless exact type is named.
8) Keep all ingredient lists complete enough to cook the dish.`,
            }],
          }),
        },
        2,
        350,
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data = await response.json();
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      const text = data.choices?.[0]?.message?.content ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed: Recipe[] = JSON.parse(clean);
      const normalized = parsed.map(recipe => ({
        ...recipe,
        ingredients: normalizeIngredientList(recipe.ingredients ?? []),
      })).map(recipe => {
        const check = getPreferenceCompliance([recipe.title, ...(recipe.ingredients ?? [])], {
          dietaryPreferences: dietaryPrefs,
          allergies: allergyPrefs,
          excludedIngredients,
          strictness: preferenceStrictness,
        });
        return {
          ...recipe,
          compliant: check.matches,
          complianceNote: check.note,
        };
      });
      setRecipes(normalized);

      const immediateImages: Record<string, string> = {};
      normalized.forEach(recipe => {
        const cached = imageCacheRef.current.get(recipe.title);
        if (cached) {
          immediateImages[recipe.id] = cached;
        }
      });
      setImageByRecipeId(immediateImages);

      const missingRecipes = normalized.filter(recipe => !imageCacheRef.current.has(recipe.title));
      if (missingRecipes.length > 0) {
        const fetched = await Promise.all(
          missingRecipes.map(async recipe => {
            const uri = await fetchFoodImage(recipe.title);
            imageCacheRef.current.set(recipe.title, uri);
            return {id: recipe.id, uri};
          }),
        );

        if (requestId === latestRequestIdRef.current) {
          setImageByRecipeId(prev => {
            const next = {...prev};
            fetched.forEach(({id, uri}) => {
              if (uri) {
                next[id] = uri;
              }
            });
            return next;
          });
        }
      }
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        return;
      }
      setError('Could not find recipes. Please try again.');
      setRecipes([]);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [query, contentLanguage, dietaryPrefs, allergyPrefs, excludedIngredients, preferenceStrictness]);

  const scheduleSearch = useCallback((forcedQuery?: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchRecipes(forcedQuery);
    }, 400);
  }, [searchRecipes]);

  useEffect(() => {
    if (!searched || query.trim().length === 0 || loading) {return;}
    scheduleSearch(query);
  }, [contentLanguage, dietaryPrefs, allergyPrefs, excludedIngredients, preferenceStrictness]);

  const handleCook = useCallback((recipe: Recipe) => {
    navigation.navigate('cook', {recipe});
  }, [navigation]);

  const handleSave = useCallback(async (recipe: Recipe, imageUri?: string) => {
    const user = auth().currentUser;
    if (!user) {return;}
    if (savedIds.has(recipe.id)) {return;}
    const result = await saveRecipe({
      uid: user.uid,
      title: recipe.title,
      cuisine: recipe.cuisine,
      duration: recipe.duration,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      summary: recipe.summary,
      imageUri: imageUri ?? '',
    });
    if (result.success) {
      setSavedIds(prev => new Set([...prev, recipe.id]));
    } else {
      console.warn('Save failed:', result.error);
    }
  }, [savedIds]);

  const renderRecipe = useCallback(({item}: {item: Recipe}) => {
    return (
      <MemoRecipeCard
        recipe={item}
        onCook={handleCook}
        onSave={handleSave}
        saved={savedIds.has(item.id)}
        imageUri={imageByRecipeId[item.id]}
        complianceNote={item.complianceNote}
        compliant={item.compliant}
      />
    );
  }, [handleCook, handleSave, savedIds, imageByRecipeId]);

  const listExtraData = useMemo(() => ({savedIds, imageByRecipeId}), [savedIds, imageByRecipeId]);

  const listHeader = useMemo(() => (
    <>
      <ImageBackground
        source={HERO_IMAGE}
        style={styles.hero}
        resizeMode="cover">
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroGreeting}>Bon appétit.</Text>
          <Text style={styles.heroSub}>What shall we cook today?</Text>
        </View>
      </ImageBackground>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <View style={styles.searchIcon}>
            <View style={styles.searchCircle} />
            <View style={styles.searchHandle} />
          </View>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search any recipe..."
            placeholderTextColor={palette.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => scheduleSearch()}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                if (debounceRef.current) {
                  clearTimeout(debounceRef.current);
                }
                activeRequestRef.current?.abort();
                setQuery('');
                setRecipes([]);
                setImageByRecipeId({});
                setSearched(false);
                setLoading(false);
                setError('');
              }}
              style={styles.clearBtn}>
              <View style={styles.clearX} />
              <View style={styles.clearX2} />
            </Pressable>
          )}
        </View>

        {query.length > 0 && (
          <Pressable
            onPress={() => scheduleSearch()}
            style={({pressed}) => [styles.searchSubmit, pressed && styles.searchSubmitPressed]}>
            <Text style={styles.searchSubmitText}>Search</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.results}>
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={palette.terracotta} size="small" />
            <Text style={styles.loadingText}>Rémy is finding recipes...</Text>
          </View>
        )}

        {error !== '' && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {!loading && searched && recipes.length > 0 && (
          <Text style={styles.resultsLabel}>
            Results for "{query}"
          </Text>
        )}

        {!loading && searched && recipes.length === 0 && !error && (
          <Text style={styles.emptyText}>No recipes found. Try a different search.</Text>
        )}

        {!searched && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Search to get started</Text>
            <Text style={styles.emptyStateSub}>
              Try "adobo", "chicken soup",{'\n'}or "easy desserts"
            </Text>
          </View>
        )}
      </View>
    </>
  ), [query, scheduleSearch, loading, error, searched, recipes.length]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <Modal
        animationType="fade"
        transparent
        visible={showWelcome}
        onRequestClose={() => setShowWelcome(false)}>
        <View style={styles.welcomeBackdrop}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeKicker}>Welcome to Recette</Text>
            <Text style={styles.welcomeTitle}>Meet Remy, your cooking guide</Text>
            <Text style={styles.welcomeBody}>
              Remy helps you cook step by step so you never feel lost in the kitchen.
            </Text>

            <View style={styles.welcomeTipRow}>
              <View style={styles.welcomeDot} />
              <Text style={styles.welcomeTipText}>Search a dish on this page.</Text>
            </View>
            <View style={styles.welcomeTipRow}>
              <View style={styles.welcomeDot} />
              <Text style={styles.welcomeTipText}>Tap Start Cooking to open guided steps.</Text>
            </View>
            <View style={styles.welcomeTipRow}>
              <View style={styles.welcomeDot} />
              <Text style={styles.welcomeTipText}>Use Ask Remy anytime if you need help.</Text>
            </View>

            <Pressable
              onPress={() => setShowWelcome(false)}
              style={({pressed}) => [styles.welcomeButton, pressed && styles.welcomeButtonPressed]}>
              <Text style={styles.welcomeButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <FlatList
        data={!loading && searched ? recipes : []}
        renderItem={renderRecipe}
        keyExtractor={item => item.id}
        extraData={listExtraData}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.scrollContent}
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },

  // Hero
  hero: {
    height: 240,
    justifyContent: 'flex-end',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,5,2,0.45)',
  },
  heroContent: {
    padding: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  heroGreeting: {
    fontFamily: typography.serif,
    fontSize: 34,
    color: palette.white,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 6,
  },
  heroSub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 18,
    color: 'rgba(255,255,255,0.65)',
  },

  // Search
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  searchIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchCircle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.muted,
  },
  searchHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 6,
    height: 1.5,
    backgroundColor: palette.muted,
    borderRadius: 1,
    transform: [{rotate: '45deg'}],
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.cormorant,
    fontSize: 18,
    color: palette.ink,
    padding: 0,
  },
  clearBtn: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearX: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: palette.muted,
    borderRadius: 1,
    transform: [{rotate: '45deg'}],
  },
  clearX2: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: palette.muted,
    borderRadius: 1,
    transform: [{rotate: '-45deg'}],
  },
  searchSubmit: {
    backgroundColor: palette.terracotta,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  searchSubmitPressed: {
    opacity: 0.85,
  },
  searchSubmitText: {
    fontFamily: typography.cormorant,
    fontSize: 18,
    letterSpacing: 1,
    color: palette.white,
  },

  // Results
  results: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  resultsLabel: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: typography.cormorantItalic,
    fontSize: 18,
    color: palette.muted,
  },
  errorText: {
    fontFamily: typography.cormorantItalic,
    fontSize: 17,
    color: palette.terracotta,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontFamily: typography.cormorantItalic,
    fontSize: 17,
    color: palette.muted,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyStateTitle: {
    fontFamily: typography.serif,
    fontSize: 23,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  emptyStateSub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 18,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Recipe card
  rcard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  rcardPressed: {
    opacity: 0.92,
    transform: [{scale: 0.99}],
  },
  rcardImg: {
    height: 150,
    justifyContent: 'flex-end',
  },
  rcardImgStyle: {
    opacity: 0.9,
  },
  rcardImgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,5,2,0.2)',
  },
  rcardBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: palette.terracotta,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  rcardBadgeText: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.white,
    letterSpacing: 0.5,
  },
  rcardBody: {
    padding: spacing.lg,
  },
  rcardCuisine: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rcardTitle: {
    fontFamily: typography.serif,
    fontSize: 23,
    color: palette.ink,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  rcardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rcardMetaItem: {
    fontFamily: typography.cormorant,
    fontSize: 16,
    color: palette.muted,
  },
  rcardMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.muted,
    opacity: 0.5,
  },
  rcardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
    marginBottom: spacing.md,
  },
  rcardSummary: {
    fontFamily: typography.cormorantItalic,
    fontSize: 17,
    color: palette.body,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  prefBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  prefBadgeOk: {
    backgroundColor: 'rgba(76,143,92,0.08)',
    borderColor: 'rgba(76,143,92,0.28)',
  },
  prefBadgeWarn: {
    backgroundColor: 'rgba(200,82,42,0.08)',
    borderColor: 'rgba(200,82,42,0.25)',
  },
  prefBadgeText: {
    fontFamily: typography.cormorant,
    fontSize: 14,
  },
  prefBadgeTextOk: {
    color: '#3E7F50',
  },
  prefBadgeTextWarn: {
    color: palette.terracotta,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  cookBtn: {
    flex: 1,
    backgroundColor: palette.terracotta,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cookBtnPressed: {
    opacity: 0.85,
  },
  cookBtnText: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    letterSpacing: 1.2,
    color: palette.white,
  },
  saveBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  saveBtnActive: {
    backgroundColor: palette.terracotta,
    borderColor: palette.terracotta,
  },
  saveBtnPressed: {
    opacity: 0.75,
    transform: [{scale: 0.95}],
  },

  // New-user onboarding modal
  welcomeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 10, 8, 0.32)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  welcomeCard: {
    backgroundColor: 'rgba(255, 250, 244, 0.97)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(140, 96, 67, 0.22)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 8},
    elevation: 5,
  },
  welcomeKicker: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.terracotta,
    marginBottom: spacing.xs,
  },
  welcomeTitle: {
    fontFamily: typography.serif,
    fontSize: 24,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  welcomeBody: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    color: palette.body,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  welcomeTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  welcomeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
    backgroundColor: palette.terracotta,
    opacity: 0.8,
  },
  welcomeTipText: {
    flex: 1,
    fontFamily: typography.cormorant,
    fontSize: 16,
    color: palette.body,
    lineHeight: 22,
  },
  welcomeButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-end',
    backgroundColor: palette.terracotta,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  welcomeButtonPressed: {
    opacity: 0.84,
  },
  welcomeButtonText: {
    fontFamily: typography.cormorant,
    fontSize: 16,
    letterSpacing: 0.8,
    color: palette.white,
  },

});