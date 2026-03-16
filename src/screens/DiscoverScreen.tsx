import React, {useCallback, useEffect, useState, useRef} from 'react';
import {ENV} from '../env';

const UNSPLASH_KEY = ENV.UNSPLASH_ACCESS_KEY;
const GROQ_KEY = ENV.GROQ_API_KEY;
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {palette, spacing, typography} from '../tokens';
import Ion from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import {getUserProfile, markDiscoverWelcomeSeen} from '../services/authService';
import {saveRecipe} from '../services/recipeService';
import {useFocusEffect} from '@react-navigation/native';

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
};

// ─── Recipe Card ──────────────────────────────────────────────────────────────


async function fetchFoodImage(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + " food")}&per_page=1&orientation=landscape`,
      {headers: {Authorization: `Client-ID ${UNSPLASH_KEY}`}},
    );
    const data = await res.json();
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

function RecipeCard({recipe, onCook, onSave, saved}: {recipe: Recipe; onCook: (r: Recipe) => void; onSave: (r: Recipe, imageUri?: string) => void; saved: boolean}) {
  const [expanded, setExpanded] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    fetchFoodImage(recipe.title).then(uri => {
      if (uri) {setImageUri(uri);}
    });
  }, [recipe.title]);

  return (
    <Pressable
      onPress={() => setExpanded(e => !e)}
      style={({pressed}) => [styles.rcard, pressed && styles.rcardPressed]}>

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

        {/* Ingredients */}
        <Text style={styles.rcardIngredientsLabel}>Ingredients</Text>
        <Text style={styles.rcardIngredients}>
          {recipe.ingredients.join(' · ')}
        </Text>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <Pressable
            onPress={() => onCook(recipe)}
            style={({pressed}) => [styles.cookBtn, pressed && styles.cookBtnPressed]}>
            <Text style={styles.cookBtnText}>Start Cooking</Text>
          </Pressable>
          <Pressable
            onPress={() => !saved && onSave(recipe, imageUri ?? undefined)}
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function DiscoverScreen({navigation}: any) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showWelcome, setShowWelcome] = useState(false);
  const inputRef = useRef<TextInput>(null);

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

        // Only true for users created after this onboarding was introduced.
        if (profile?.hasSeenDiscoverWelcome === false) {
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

  const searchRecipes = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1000,
          messages: [{
            role: 'system',
            content: 'You are a professional chef assistant. Return only raw JSON arrays, no markdown, no explanation.',
          }, {
            role: 'user',
            content: `The user searched for: "${query}". Return exactly 3 recipe results as a JSON array with these exact fields: [{"id": "unique string", "title": "Recipe name", "cuisine": "Cuisine type", "duration": "X min", "servings": "number", "difficulty": "Easy | Medium | Hard", "ingredients": ["ingredient 1", ...], "summary": "One sentence description"}]`,
          }],
        }),
      });

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed: Recipe[] = JSON.parse(clean);
      setRecipes(parsed);
    } catch (e) {
      setError('Could not find recipes. Please try again.');
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCook = (recipe: Recipe) => {
    navigation.navigate('cook', {recipe});
  };

  const handleSave = async (recipe: Recipe, imageUri?: string) => {
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
  };

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

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>

        {/* Hero */}
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

        {/* Search bar */}
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
              onSubmitEditing={searchRecipes}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setRecipes([]);
                  setSearched(false);
                }}
                style={styles.clearBtn}>
                <View style={styles.clearX} />
                <View style={styles.clearX2} />
              </Pressable>
            )}
          </View>

          {query.length > 0 && (
            <Pressable
              onPress={searchRecipes}
              style={({pressed}) => [styles.searchSubmit, pressed && styles.searchSubmitPressed]}>
              <Text style={styles.searchSubmitText}>Search</Text>
            </Pressable>
          )}
        </View>

        {/* Results area */}
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
            <>
              <Text style={styles.resultsLabel}>
                Results for "{query}"
              </Text>
              {recipes.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} onCook={handleCook} onSave={handleSave} saved={savedIds.has(recipe.id)} />
              ))}
            </>
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
      </ScrollView>
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
  rcardIngredientsLabel: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  rcardIngredients: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    color: palette.body,
    lineHeight: 20,
    marginBottom: spacing.lg,
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