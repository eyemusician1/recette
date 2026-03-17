import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import Ion from 'react-native-vector-icons/Ionicons';
import {palette, spacing, typography} from '../tokens';
import {AlertDialog} from '../components/AlertDialog';
import {signOut, updateDietaryPreferences, getUserProfile, updateTtsSettings, TtsLanguage} from '../services/authService';
import {getSavedRecipes, getCookHistory} from '../services/recipeService';

// ─── Available dietary options ────────────────────────────────────────────────
const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free',
  'Nut-Free', 'Halal', 'Kosher', 'Low-Carb',
  'Keto', 'Paleo', 'Pescatarian', 'No Restrictions',
];

// ─── Row Item ─────────────────────────────────────────────────────────────────
function RowItem({
  label,
  value,
  onPress,
  danger,
  icon,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  icon?: string;
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
        {onPress && !danger && (
          <Ion name="chevron-forward" size={14} color={palette.muted} />
        )}
      </View>
    </Pressable>
  );
}

// ─── Dietary Picker Modal ────────────────────────────────────────────────────
function DietaryModal({
  visible,
  selected,
  onSave,
  onClose,
}: {
  visible: boolean;
  selected: string[];
  onSave: (prefs: string[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<string[]>(selected);

  useEffect(() => {
    setLocal(selected);
  }, [selected, visible]);

  const toggle = (opt: string) => {
    setLocal(prev =>
      prev.includes(opt) ? prev.filter(p => p !== opt) : [...prev, opt],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Dietary Preferences</Text>
            <Text style={styles.modalSub}>Select all that apply</Text>
          </View>

          <ScrollView contentContainerStyle={styles.modalOptions}>
            {DIETARY_OPTIONS.map(opt => {
              const active = local.includes(opt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => toggle(opt)}
                  style={({pressed}) => [
                    styles.optionChip,
                    active && styles.optionChipActive,
                    pressed && styles.optionChipPressed,
                  ]}>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {opt}
                  </Text>
                  {active && (
                    <Ion name="checkmark" size={14} color={palette.terracotta} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={({pressed}) => [styles.modalCancelBtn, pressed && {opacity: 0.8}]}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(local)}
              style={({pressed}) => [styles.modalSaveBtn, pressed && {opacity: 0.85}]}>
              <Text style={styles.modalSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function ProfileScreen() {
  const user = auth().currentUser;
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [ttsLanguage, setTtsLanguage] = useState<TtsLanguage>('en-US');
  const [savingTts, setSavingTts] = useState(false);
  const [langToastText, setLangToastText] = useState('');
  const [showLangToast, setShowLangToast] = useState(false);
  const langToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {return;}
    loadStats();
    loadProfile();

    return () => {
      if (langToastTimerRef.current) {
        clearTimeout(langToastTimerRef.current);
      }
    };
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

  const loadProfile = async () => {
    if (!user) {return;}
    try {
      const profile = await getUserProfile(user.uid);
      if (profile?.dietaryPreferences) {
        setDietaryPrefs(profile.dietaryPreferences);
      }
      if (profile?.ttsLanguage === 'tl-PH' || profile?.ttsLanguage === 'en-US') {
        setTtsLanguage(profile.ttsLanguage);
      }
    } catch (e) {
      console.warn('Failed to load profile', e);
    }
  };

  const handleToggleTtsLanguage = async () => {
    if (!user || savingTts) {return;}
    const next: TtsLanguage = ttsLanguage === 'en-US' ? 'tl-PH' : 'en-US';
    setTtsLanguage(next);
    setSavingTts(true);
    try {
      await updateTtsSettings(user.uid, {ttsLanguage: next, ttsVoiceGender: 'male'});
      setLangToastText(next === 'tl-PH' ? 'Language switched to Tagalog.' : 'Language switched to English.');
      setShowLangToast(true);
      if (langToastTimerRef.current) {
        clearTimeout(langToastTimerRef.current);
      }
      langToastTimerRef.current = setTimeout(() => {
        setShowLangToast(false);
      }, 2200);
    } catch (e) {
      setTtsLanguage(ttsLanguage);
      console.warn('Failed to save TTS settings', e);
    } finally {
      setSavingTts(false);
    }
  };

  const handleSavePrefs = async (prefs: string[]) => {
    if (!user) {return;}
    setShowDietaryModal(false);
    setSavingPrefs(true);
    try {
      await updateDietaryPreferences(user.uid, prefs);
      setDietaryPrefs(prefs);
    } catch (e) {
      console.warn('Failed to save prefs', e);
    } finally {
      setSavingPrefs(false);
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

      {/* ── Hero ── */}
      <View style={styles.hero}>
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

        {/* Stats */}
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

      {/* ── Dietary Preferences ── */}
      <Text style={styles.groupLabel}>Dietary Preferences</Text>
      <Pressable
        onPress={() => setShowDietaryModal(true)}
        style={({pressed}) => [styles.dietaryCard, pressed && styles.dietaryCardPressed]}>
        {savingPrefs ? (
          <ActivityIndicator color={palette.terracotta} size="small" />
        ) : dietaryPrefs.length === 0 ? (
          <View style={styles.dietaryEmpty}>
            <Text style={styles.dietaryEmptyText}>None set — tap to add</Text>
            <Ion name="add-circle-outline" size={18} color={palette.muted} />
          </View>
        ) : (
          <View style={styles.chipsWrap}>
            {dietaryPrefs.map(p => (
              <View key={p} style={styles.chip}>
                <Text style={styles.chipText}>{p}</Text>
              </View>
            ))}
            <View style={styles.chipAdd}>
              <Ion name="pencil-outline" size={12} color={palette.terracotta} />
            </View>
          </View>
        )}
      </Pressable>

      {/* ── Preferences ── */}
      <Text style={styles.groupLabel}>Preferences</Text>
      <View style={styles.group}>
        <RowItem
          label="Language"
          value={savingTts ? 'Saving...' : ttsLanguage === 'en-US' ? 'English' : 'Tagalog'}
          onPress={handleToggleTtsLanguage}
        />
        <View style={styles.divider} />
      </View>

      {/* ── About ── */}
      <Text style={styles.groupLabel}>About</Text>
      <View style={styles.group}>
        <RowItem label="About Recette" onPress={() => setShowAbout(true)} />
        <View style={styles.divider} />
        <RowItem label="Privacy Policy" onPress={() => setShowPrivacy(true)} />
      </View>

      {/* ── Account ── */}
      <Text style={styles.groupLabel}>Account</Text>
      <View style={styles.group}>
        <RowItem
          label="Sign Out"
          danger
          onPress={() => setShowSignOutDialog(true)}
        />
      </View>

      {/* ── Modals ── */}
      {/* About Modal */}
      <Modal visible={showAbout} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>About Recette</Text>
            </View>
            <ScrollView contentContainerStyle={{padding: spacing.xl}}>
              <Text style={styles.aboutLabel}>Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>

              <View style={styles.aboutDivider} />

              <Text style={styles.aboutLabel}>Developer</Text>
              <Text style={styles.aboutValue}>Sayr</Text>

              <View style={styles.aboutDivider} />

              <Text style={styles.aboutBody}>
                Recette is your AI-powered cooking companion. Guided by Rémy, your personal sous-chef, it helps you cook any recipe step by step — hands-free.
              </Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowAbout(false)}
                style={({pressed}) => [styles.modalSaveBtn, {flex: 1}, pressed && {opacity: 0.85}]}>
                <Text style={styles.modalSaveText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={showPrivacy} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <Text style={styles.modalSub}>Last updated March 2026</Text>
            </View>
            <ScrollView contentContainerStyle={{padding: spacing.xl}}>
              <Text style={styles.aboutBody}>
                Recette collects your basic account info (name, email, photo) when you sign in. Your saved recipes, cook history, and preferences are stored securely and used only to personalize your experience.
              </Text>

              <View style={styles.aboutDivider} />

              <Text style={styles.aboutBody}>
                We do not sell or share your data with third parties for advertising purposes.
              </Text>

              <View style={styles.aboutDivider} />

              <Text style={styles.aboutLabel}>Contact</Text>
              <Text style={styles.aboutBody}>bayononsayr@gmail.com</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowPrivacy(false)}
                style={({pressed}) => [styles.modalSaveBtn, {flex: 1}, pressed && {opacity: 0.85}]}>
                <Text style={styles.modalSaveText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <DietaryModal
        visible={showDietaryModal}
        selected={dietaryPrefs}
        onSave={handleSavePrefs}
        onClose={() => setShowDietaryModal(false)}
      />

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

      <Modal visible={showLangToast} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.toastOverlay} pointerEvents="none">
          <View style={styles.toastCard}>
            <Ion name="checkmark-circle" size={16} color={palette.terracotta} />
            <Text style={styles.toastText}>{langToastText}</Text>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: palette.bg},
  content: {paddingBottom: spacing.xxxl},

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(200,82,42,0.04)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: palette.white,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: palette.white,
  },
  avatarInitials: {
    fontFamily: typography.serif,
    fontSize: 36,
    color: palette.white,
  },
  userName: {
    fontFamily: typography.serif,
    fontSize: 27,
    color: palette.ink,
    marginBottom: 3,
  },
  userEmail: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    color: palette.muted,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statValue: {
    fontFamily: typography.serif,
    fontSize: 30,
    color: palette.ink,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
    marginVertical: spacing.md,
  },

  // Groups
  groupLabel: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  group: {
    marginHorizontal: spacing.xl,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowPressed: {backgroundColor: palette.surface},
  rowLabel: {
    fontFamily: typography.cormorant,
    fontSize: 18,
    color: palette.ink,
  },
  rowLabelDanger: {color: palette.terracotta},
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    color: palette.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
    marginLeft: spacing.lg,
  },

  // Dietary card
  dietaryCard: {
    marginHorizontal: spacing.xl,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: spacing.lg,
    minHeight: 52,
    justifyContent: 'center',
  },
  dietaryCardPressed: {backgroundColor: palette.surface},
  dietaryEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dietaryEmptyText: {
    fontFamily: typography.cormorantItalic,
    fontSize: 17,
    color: palette.muted,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: 'rgba(200,82,42,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,82,42,0.2)',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  chipText: {
    fontFamily: typography.cormorant,
    fontSize: 16,
    color: palette.terracotta,
  },
  chipAdd: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(200,82,42,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,82,42,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // About / Privacy
  aboutLabel: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  aboutValue: {
    fontFamily: typography.serif,
    fontSize: 20,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  aboutBody: {
    fontFamily: typography.cormorant,
    fontSize: 18,
    color: palette.body,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  aboutDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
    marginVertical: spacing.lg,
  },

  // Dietary modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(44,26,14,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: typography.serif,
    fontSize: 23,
    color: palette.ink,
    marginBottom: 3,
  },
  modalSub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 16,
    color: palette.muted,
  },
  modalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  optionChipActive: {
    backgroundColor: 'rgba(200,82,42,0.08)',
    borderColor: 'rgba(200,82,42,0.3)',
  },
  optionChipPressed: {opacity: 0.75},
  optionText: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    color: palette.body,
  },
  optionTextActive: {
    color: palette.terracotta,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalCancelText: {
    fontFamily: typography.cormorant,
    fontSize: 18,
    color: palette.body,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: palette.terracotta,
  },
  modalSaveText: {
    fontFamily: typography.cormorant,
    fontSize: 18,
    color: palette.white,
    letterSpacing: 0.5,
  },

  // Toast
  toastOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  toastText: {
    fontFamily: typography.cormorant,
    fontSize: 16,
    color: palette.body,
    flexShrink: 1,
  },
});