import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {AlertDialog} from '../components/AlertDialog';
import auth from '@react-native-firebase/auth';
import {palette, spacing, typography} from '../tokens';
import {
  SavedRecipe,
  subscribeSavedRecipes,
  unsaveRecipe,
} from '../services/recipeService';

const FALLBACK = require('../../assets/images/login-bg.jpg');

function RecipeRow({
  recipe,
  onUnsave,
  onCook,
}: {
  recipe: SavedRecipe;
  onUnsave: () => void;
  onCook: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onCook} style={styles.cardMain}>
        <ImageBackground
          source={recipe.imageUri ? {uri: recipe.imageUri} : FALLBACK}
          style={styles.cardImg}
          imageStyle={styles.cardImgStyle}>
          <View style={styles.cardImgOverlay} />
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{recipe.duration}</Text>
          </View>
        </ImageBackground>
        <View style={styles.cardBody}>
          <Text style={styles.cardCuisine}>{recipe.cuisine}</Text>
          <Text style={styles.cardTitle}>{recipe.title}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaItem}>{recipe.servings} servings</Text>
            <View style={styles.metaDot} />
            <Text style={styles.cardMetaItem}>{recipe.difficulty}</Text>
          </View>
        </View>
      </Pressable>

      {/* Action row */}
      <View style={styles.cardActions}>
        <Pressable
          onPress={onCook}
          style={({pressed}) => [styles.cookBtn, pressed && styles.cookBtnPressed]}>
          <Text style={styles.cookBtnText}>Start Cooking</Text>
        </Pressable>
        <Pressable
          onPress={onUnsave}
          style={({pressed}) => [styles.unsaveBtn, pressed && styles.unsaveBtnPressed]}>
          {/* X icon */}
          <View style={styles.xLeft} />
          <View style={styles.xRight} />
        </Pressable>
      </View>
    </View>
  );
}

export function SavedScreen({navigation}: any) {
  const user = auth().currentUser;
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [dialogRecipe, setDialogRecipe] = useState<SavedRecipe | null>(null);

  useEffect(() => {
    if (!user) {return;}
    const unsubscribe = subscribeSavedRecipes(user.uid, data => {
      setRecipes(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleUnsave = (recipe: SavedRecipe) => {
    if (!user || !recipe.id) {return;}
    setDialogRecipe(recipe);
  };

  const confirmUnsave = async () => {
    if (!user || !dialogRecipe?.id) {return;}
    const recipe = dialogRecipe;
    setDialogRecipe(null);
    setRemoving(prev => new Set([...prev, recipe.id!]));
    const result = await unsaveRecipe(user.uid, recipe.id!);
    if (!result.success) {
      setRemoving(prev => {
        const next = new Set(prev);
        next.delete(recipe.id!);
        return next;
      });
    }
  };

  const handleCook = (recipe: SavedRecipe) => {
    navigation.navigate('cook', {recipe});
  };

  const visibleRecipes = recipes.filter(r => !removing.has(r.id ?? ''));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Saved</Text>
        <Text style={styles.pageSub}>Your saved recipes</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={palette.terracotta} />
          </View>
        ) : visibleRecipes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptySub}>
              Search for recipes on Discover and save ones you love.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleRecipes.map(recipe => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onUnsave={() => handleUnsave(recipe)}
                onCook={() => handleCook(recipe)}
              />
            ))}
          </View>
        )}

      </ScrollView>

      <AlertDialog
        visible={dialogRecipe !== null}
        title="Remove Recipe"
        message={`Remove "${dialogRecipe?.title ?? ''}" from your saved recipes?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmUnsave}
        onCancel={() => setDialogRecipe(null)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: palette.bg},
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  pageTitle: {
    fontFamily: typography.serif,
    fontSize: 34,
    color: palette.ink,
    marginBottom: 4,
  },
  pageSub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 17,
    color: palette.muted,
    marginBottom: spacing.xl,
  },
  loadingWrap: {paddingVertical: spacing.xxxl, alignItems: 'center'},
  emptyWrap: {paddingVertical: spacing.xxxl, alignItems: 'center'},
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 25,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 17,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  list: {gap: spacing.lg},

  // Card
  card: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardMain: {},
  cardImg: {height: 130, justifyContent: 'flex-end'},
  cardImgStyle: {opacity: 0.9},
  cardImgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,5,2,0.2)',
  },
  cardBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: palette.terracotta,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  cardBadgeText: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.white,
  },
  cardBody: {padding: spacing.lg, paddingBottom: spacing.sm},
  cardCuisine: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  cardTitle: {
    fontFamily: typography.serif,
    fontSize: 21,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  cardMeta: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  cardMetaItem: {
    fontFamily: typography.cormorant,
    fontSize: 15,
    color: palette.muted,
  },
  metaDot: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: palette.muted, opacity: 0.5,
  },

  // Action row
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  cookBtn: {
    flex: 1,
    backgroundColor: palette.terracotta,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cookBtnPressed: {opacity: 0.85},
  cookBtnText: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    letterSpacing: 1,
    color: palette.white,
  },
  unsaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsaveBtnPressed: {opacity: 0.7},
  xLeft: {
    position: 'absolute',
    width: 14,
    height: 1.5,
    backgroundColor: palette.muted,
    borderRadius: 1,
    transform: [{rotate: '45deg'}],
  },
  xRight: {
    position: 'absolute',
    width: 14,
    height: 1.5,
    backgroundColor: palette.muted,
    borderRadius: 1,
    transform: [{rotate: '-45deg'}],
  },
});