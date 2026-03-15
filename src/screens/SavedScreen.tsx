import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import {palette, spacing, typography} from '../tokens';
import {
  SavedRecipe,
  subscribeSavedRecipes,
  unsaveRecipe,
} from '../services/recipeService';

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
    <View style={styles.recipeRow}>
      <Pressable style={styles.recipeInfo} onPress={onCook}>
        <Text style={styles.recipeCuisine}>{recipe.cuisine}</Text>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <View style={styles.recipeMeta}>
          <Text style={styles.recipeMetaItem}>{recipe.duration}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.recipeMetaItem}>{recipe.difficulty}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.recipeMetaItem}>{recipe.servings} servings</Text>
        </View>
      </Pressable>
      <Pressable onPress={onUnsave} style={styles.unsaveBtn}>
        <View style={styles.unsaveIcon} />
      </Pressable>
    </View>
  );
}

export function SavedScreen({navigation}: any) {
  const user = auth().currentUser;
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeSavedRecipes(user.uid, data => {
      setRecipes(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleUnsave = async (recipe: SavedRecipe) => {
    if (!user || !recipe.id) return;
    await unsaveRecipe(user.uid, recipe.id);
  };

  const handleCook = (recipe: SavedRecipe) => {
    navigation.navigate('cook', {recipe});
  };

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
        ) : recipes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptySub}>
              Search for recipes on Discover and save ones you love.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {recipes.map(recipe => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  pageTitle: {
    fontFamily: typography.serif,
    fontSize: 30,
    color: palette.ink,
    marginBottom: 4,
  },
  pageSub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 14,
    color: palette.muted,
    marginBottom: spacing.xl,
  },
  loadingWrap: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 22,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  list: {
    gap: spacing.md,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.md,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeCuisine: {
    fontFamily: typography.cormorant,
    fontSize: 10,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  recipeTitle: {
    fontFamily: typography.serif,
    fontSize: 17,
    color: palette.ink,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recipeMetaItem: {
    fontFamily: typography.cormorant,
    fontSize: 12,
    color: palette.muted,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.muted,
    opacity: 0.5,
  },
  unsaveBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(200,82,42,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unsaveIcon: {
    width: 12,
    height: 12,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: palette.terracotta,
    transform: [{rotate: '45deg'}, {translateY: 3}],
  },
});