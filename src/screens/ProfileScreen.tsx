import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import {palette, spacing, typography} from '../tokens';
import {AlertDialog} from '../components/AlertDialog';
import {signOut} from '../services/authService';
import {getSavedRecipes, getCookHistory} from '../services/recipeService';

function RowItem({
  label,
  value,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {!danger && <View style={styles.chevron} />}
      </View>
    </Pressable>
  );
}

export function ProfileScreen() {
  const user = auth().currentUser;
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) {return;}
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!user) {return;}
    try {
      const [saved, history] = await Promise.all([
        getSavedRecipes(user.uid),
        getCookHistory(user.uid),
      ]);
      setSavedCount(saved.length);
      setHistoryCount(history.length);
    } catch (e) {
      console.warn('Failed to load stats', e);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setShowSignOutDialog(false);
    await signOut();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      <View style={styles.userHeader}>
        {user?.photoURL ? (
          <Image source={{uri: user.photoURL}} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>
              {user?.displayName?.charAt(0).toUpperCase() ?? 'R'}
            </Text>
          </View>
        )}
        <Text style={styles.userName}>{user?.displayName ?? 'Chef'}</Text>
        <Text style={styles.userEmail}>{user?.email ?? ''}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            {statsLoading ? (
              <ActivityIndicator color={palette.terracotta} size="small" />
            ) : (
              <Text style={styles.statValue}>{savedCount}</Text>
            )}
            <Text style={styles.statLabel}>Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            {statsLoading ? (
              <ActivityIndicator color={palette.terracotta} size="small" />
            ) : (
              <Text style={styles.statValue}>{historyCount}</Text>
            )}
            <Text style={styles.statLabel}>Cooked</Text>
          </View>
        </View>
      </View>

      <Text style={styles.groupLabel}>Preferences</Text>
      <View style={styles.group}>
        <RowItem label="Dietary Preferences" value="None set" />
        <View style={styles.divider} />
        <RowItem label="Language" value="English" />
      </View>

      <Text style={styles.groupLabel}>About</Text>
      <View style={styles.group}>
        <RowItem label="About Recette" />
        <View style={styles.divider} />
        <RowItem label="Privacy Policy" />
      </View>

      <Text style={styles.groupLabel}>Account</Text>
      <View style={styles.group}>
        <RowItem
          label="Sign Out"
          danger
          onPress={() => setShowSignOutDialog(true)}
        />
      </View>

      <AlertDialog
        visible={showSignOutDialog}
        title="Sign Out"
        message="Are you sure you want to sign out of Recette?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutDialog(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: palette.bg},
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  userHeader: {alignItems: 'center', marginBottom: spacing.xxl},
  avatar: {width: 80, height: 80, borderRadius: 40, marginBottom: spacing.md},
  avatarFallback: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: palette.terracotta,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarInitials: {fontFamily: typography.serif, fontSize: 32, color: palette.white},
  userName: {fontFamily: typography.serif, fontSize: 24, color: palette.ink, marginBottom: 4},
  userEmail: {fontFamily: typography.cormorant, fontSize: 14, color: palette.muted, marginBottom: spacing.xl},
  statsRow: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderWidth: 1, borderColor: palette.border,
    borderRadius: 14,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl,
    gap: spacing.xxl,
  },
  statItem: {alignItems: 'center', minWidth: 60},
  statValue: {fontFamily: typography.serif, fontSize: 24, color: palette.ink, marginBottom: 2},
  statLabel: {fontFamily: typography.cormorant, fontSize: 12, color: palette.muted, letterSpacing: 1, textTransform: 'uppercase'},
  statDivider: {width: 1, backgroundColor: palette.border},
  groupLabel: {
    fontFamily: typography.cormorant, fontSize: 11,
    color: palette.muted, letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  group: {
    backgroundColor: palette.white,
    borderWidth: 1, borderColor: palette.border,
    borderRadius: 14, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  rowPressed: {backgroundColor: palette.surface},
  rowLabel: {fontFamily: typography.cormorant, fontSize: 15, color: palette.ink},
  rowLabelDanger: {color: palette.terracotta},
  rowRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  rowValue: {fontFamily: typography.cormorant, fontSize: 14, color: palette.muted},
  chevron: {
    width: 6, height: 6,
    borderTopWidth: 1.5, borderRightWidth: 1.5,
    borderColor: palette.muted,
    transform: [{rotate: '45deg'}],
  },
  divider: {height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginLeft: spacing.lg},
});