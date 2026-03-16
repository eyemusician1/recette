import React, {useState, useEffect, useRef} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {palette, spacing, typography} from '../tokens';
import Tts from 'react-native-tts';
import Ion from 'react-native-vector-icons/Ionicons';
import {ENV} from '../env';
import auth from '@react-native-firebase/auth';
import {addCookHistory, cacheSavedRecipeSteps} from '../services/recipeService';
import {AskRemy} from '../components/AskRemy';
import {AlertDialog} from '../components/AlertDialog';

const GROQ_API_KEY = ENV.GROQ_API_KEY;

// ─── Types ────────────────────────────────────────────────────────────────────
type Recipe = {
  id: string;
  uid?: string;
  title: string;
  cuisine: string;
  duration: string;
  servings: string;
  difficulty: string;
  ingredients: string[];
  steps?: string[];
  summary: string;
};

type Step = {
  index: number;
  instruction: string;
  timerSeconds?: number;
};

type Phase = 'intro' | 'checklist' | 'steps' | 'done';

// ─── TTS Helper ───────────────────────────────────────────────────────────────
function speak(text: string, muted: boolean) {
  if (muted) {return;}
  Tts.stop();
  Tts.speak(text);
}

function stopSpeaking() {
  Tts.stop();
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODEL = 'llama-3.3-70b-versatile';

function normalizeSteps(input: string[]): Step[] {
  return input
    .map((instruction, index) => ({index: index + 1, instruction: String(instruction).trim()}))
    .filter(step => step.instruction.length > 0);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function askGroq(messages: {role: string; content: string}[]) {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({model: MODEL, max_tokens: 1000, messages}),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Timer Component ──────────────────────────────────────────────────────────
function StepTimer({seconds}: {seconds: number}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && remaining > 0) {
      interval.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(interval.current!);
            setRunning(false);
            setDone(true);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval.current!);
  }, [running]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = `${mins}:${secs.toString().padStart(2, '0')}`;

  const reset = () => {
    clearInterval(interval.current!);
    setRemaining(seconds);
    setRunning(false);
    setDone(false);
  };

  return (
    <View style={timerStyles.wrap}>
      <View style={timerStyles.row}>
        <View style={timerStyles.iconDot} />
        <Text style={timerStyles.time}>{done ? 'Done!' : label}</Text>
        {!done ? (
          <Pressable
            onPress={() => setRunning(r => !r)}
            style={({pressed}) => [timerStyles.btn, pressed && timerStyles.btnPressed]}>
            <Text style={timerStyles.btnText}>{running ? 'Pause' : 'Start'}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={reset}
            style={({pressed}) => [timerStyles.btn, timerStyles.btnReset, pressed && timerStyles.btnPressed]}>
            <Text style={timerStyles.btnText}>Reset</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(200,82,42,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,82,42,0.2)',
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.terracotta,
  },
  time: {
    flex: 1,
    fontFamily: typography.serif,
    fontSize: 20,
    color: palette.terracotta,
  },
  btn: {
    backgroundColor: palette.terracotta,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  btnReset: {
    backgroundColor: palette.muted,
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnText: {
    fontFamily: typography.cormorant,
    fontSize: 13,
    color: palette.white,
    letterSpacing: 0.5,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function CookScreen({route, navigation}: any) {
  const recipe: Recipe | undefined = route?.params?.recipe;

  const [phase, setPhase] = useState<Phase>('intro');
  const [introText, setIntroText] = useState('');
  const [introLoading, setIntroLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [subSuggestions, setSubSuggestions] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Reset all state when recipe changes + setup TTS once
  useEffect(() => {
    Tts.setDefaultLanguage('en-US');
    Tts.setDefaultVoice('en-us-x-iom-local');
    Tts.setDefaultRate(0.5);
    Tts.setDefaultPitch(0.9);

    return () => {
      stopSpeaking();
    };
  }, []);

  // Reset and reload whenever the recipe changes
  const recipeId = recipe?.id ?? recipe?.title ?? '';
  useEffect(() => {
    if (!recipe) {return;}
    // Reset all phase state
    stopSpeaking();
    setPhase('intro');
    setIntroText('');
    setSteps([]);
    setCurrentStep(0);
    setChecked(new Array(recipe.ingredients.length).fill(false));
    setMuted(false);
    // Load fresh intro for the new recipe
    loadIntro();
  }, [recipeId]);

  const loadIntro = async () => {
    if (!recipe) return;
    setIntroLoading(true);
    try {
      const text = await askGroq([{
        role: 'system',
        content: 'You are Rémy, a warm and encouraging AI chef. You speak in a friendly, enthusiastic tone. Keep responses concise.',
      }, {
        role: 'user',
        content: `I'm about to cook "${recipe.title}" (${recipe.cuisine}, ${recipe.duration}, ${recipe.difficulty}). Give me a short, exciting intro — what this dish is about, what makes it special, and one key tip. 2-3 sentences max.`,
      }]);
      setIntroText(text);
      speak(text, muted);
    } catch {
      const fallback = `Welcome! Today we're making ${recipe?.title ?? 'something delicious'}. Let's check your ingredients first, then I'll walk you through every step.`;
      setIntroText(fallback);
      speak(fallback, muted);
    } finally {
      setIntroLoading(false);
    }
  };

  // Speak current step whenever it changes
  useEffect(() => {
    if (phase === 'steps' && steps.length > 0 && steps[currentStep]) {
      speak(steps[currentStep].instruction, muted);
    }
  }, [currentStep, steps, phase]);

  // Speak done + save cook history when phase changes to done
  useEffect(() => {
    if (phase === 'done' && recipe) {
      speak(`Bon appétit! You've finished cooking ${recipe.title}. Enjoy your meal!`, muted);
      const user = auth().currentUser;
      if (user) {
        addCookHistory({
          uid: user.uid,
          recipeTitle: recipe.title,
          cuisine: recipe.cuisine,
          duration: recipe.duration,
        }).catch(e => console.warn('Failed to save cook history:', e));
      }
    }
  }, [phase, recipe, muted]);

  const loadSteps = async () => {
    if (!recipe) return;
    setStepsLoading(true);
    try {
      const text = await askGroq([{
        role: 'system',
        content: 'You are a professional chef assistant. Return only raw JSON, no markdown.',
      }, {
        role: 'user',
        content: `Create detailed cooking steps for "${recipe.title}". Return a JSON array of steps:
[{"index": 1, "instruction": "step text here", "timerSeconds": 300}]
timerSeconds is optional — only include it if the step requires waiting (boiling, simmering, baking etc). Be specific and clear. 5-8 steps.`,
      }]);
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed: Step[] = JSON.parse(clean);
      setSteps(parsed);
      const user = auth().currentUser;
      if (user && recipe.id) {
        const stepText = parsed.map(step => step.instruction).filter(Boolean);
        if (stepText.length > 0) {
          await cacheSavedRecipeSteps(user.uid, recipe.id, stepText);
        }
      }
      if (parsed.length > 0) {
        speak(parsed[0].instruction, muted);
      }
    } catch {
      const cached = normalizeSteps(recipe.steps ?? []);
      if (cached.length > 0) {
        setSteps(cached);
        speak(cached[0].instruction, muted);
      } else {
        setSteps([{index: 1, instruction: 'Could not load steps. Connect to the internet once to cache this recipe for offline use.'}]);
      }
    } finally {
      setStepsLoading(false);
    }
  };

  const startCooking = () => {
    setPhase('steps');
    loadSteps();
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      setFinishDialogOpen(true);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };



  // ─── Ingredient substitutions ─────────────────────────────────────────────
  const getSuggestions = async () => {
    const missing = recipe?.ingredients.filter((_, i) => !checked[i]) ?? [];
    if (missing.length === 0) {return;}
    setSubLoading(true);
    setSubSuggestions('');
    try {
      const text = await askGroq([{
        role: 'system',
        content: 'You are Rémy, a helpful AI chef. Be concise and practical.',
      }, {
        role: 'user',
        content: `I am making "${recipe?.title}" but I am missing: ${missing.join(', ')}. For each missing ingredient, suggest a practical substitute I might already have at home. Format each as "• [missing] → [substitute]: [one line why it works]". Be brief.`,
      }]);
      setSubSuggestions(text);
      speak(text, muted);
    } catch {
      setSubSuggestions('Sorry, could not get suggestions. Please try again.');
    } finally {
      setSubLoading(false);
    }
  };

  const toggleMute = () => {
    if (!muted) {stopSpeaking();}
    setMuted(m => !m);
  };

  const confirmFinish = () => {
    setFinishDialogOpen(false);
    setPhase('done');
  };

  // ── No recipe passed ─────────────────────────────────────────────────────
  if (!recipe) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No recipe selected</Text>
        <Text style={styles.emptySub}>Search for a recipe on Discover and tap "Cook with Rémy".</Text>
      </View>
    );
  }

  // ── Phase: Intro ──────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.phaseContent}>

          <View style={styles.topBar}>
            <View style={{flex: 1}} />
            <Pressable onPress={toggleMute} style={[styles.topBarBtn, muted && styles.topBarBtnMuted]}>
              <Ion name={muted ? 'volume-mute' : 'volume-high'} size={18} color={muted ? palette.terracotta : palette.body} />
            </Pressable>
          </View>

          <Text style={styles.recipeTitle}>{recipe.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>{recipe.cuisine}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaItem}>{recipe.duration}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaItem}>{recipe.difficulty}</Text>
          </View>

          <View style={styles.introCard}>
            {introLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.terracotta} size="small" />
                <Text style={styles.loadingText}>Rémy is preparing...</Text>
              </View>
            ) : (
              <Text style={styles.introText}>{introText}</Text>
            )}
          </View>

          <Pressable
            onPress={() => setPhase('checklist')}
            disabled={introLoading}
            style={({pressed}) => [styles.primaryBtn, pressed && styles.primaryBtnPressed, introLoading && styles.btnDisabled]}>
            <Text style={styles.primaryBtnText}>Check Ingredients</Text>
          </Pressable>

        </ScrollView>
      </View>
    );
  }

  // ── Phase: Checklist ──────────────────────────────────────────────────────
  if (phase === 'checklist') {
    const allChecked = checked.every(Boolean);
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.phaseContent}>

          <View style={styles.topBar}>
            <Pressable onPress={() => setPhase('intro')} style={styles.topBarBtn}>
              <Ion name="arrow-back" size={18} color={palette.body} />
            </Pressable>
            <View style={{flex: 1}} />
            <Pressable onPress={toggleMute} style={[styles.topBarBtn, muted && styles.topBarBtnMuted]}>
              <Ion name={muted ? 'volume-mute' : 'volume-high'} size={18} color={muted ? palette.terracotta : palette.body} />
            </Pressable>
          </View>

          <Text style={styles.phaseLabel}>Before we start</Text>
          <Text style={styles.phaseTitle}>Ingredients</Text>
          <Text style={styles.phaseSub}>Tick off everything you have ready.</Text>

          <View style={styles.checklistCard}>
            {recipe.ingredients.map((ing, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  const next = [...checked];
                  next[i] = !next[i];
                  setChecked(next);
                }}
                style={({pressed}) => [styles.checkRow, pressed && styles.checkRowPressed]}>
                <View style={[styles.checkbox, checked[i] && styles.checkboxChecked]}>
                  {checked[i] && <View style={styles.checkmark} />}
                </View>
                <Text style={[styles.checkLabel, checked[i] && styles.checkLabelDone]}>
                  {ing}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Substitution suggestion */}
          {!allChecked && (
            <Pressable
              onPress={getSuggestions}
              disabled={subLoading}
              style={({pressed}) => [styles.subBtn, pressed && {opacity: 0.8}]}>
              {subLoading ? (
                <ActivityIndicator color={palette.terracotta} size="small" />
              ) : (
                <Text style={styles.subBtnText}>
                  {subSuggestions ? 'Refresh suggestions' : 'Missing something? Ask Rémy'}
                </Text>
              )}
            </Pressable>
          )}

          {subSuggestions !== '' && (
            <View style={styles.subCard}>
              <View style={styles.subCardHeader}>
                <View style={styles.remyDot} />
                <Text style={styles.subCardTitle}>Rémy's Suggestions</Text>
              </View>
              <Text style={styles.subCardText}>{subSuggestions}</Text>
            </View>
          )}

          <Pressable
            onPress={startCooking}
            style={({pressed}) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}>
            <Text style={styles.primaryBtnText}>
              {allChecked ? "Let's Cook!" : 'Start Anyway'}
            </Text>
          </Pressable>

        </ScrollView>
      </View>
    );
  }

  // ── Phase: Steps ──────────────────────────────────────────────────────────
  if (phase === 'steps') {
    const step = steps[currentStep];
    const progress = steps.length > 0 ? (currentStep + 1) / steps.length : 0;

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={styles.stepsContainer}>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {width: `${progress * 100}%`}]} />
          </View>

          <ScrollView contentContainerStyle={styles.phaseContent} ref={scrollRef}>

            <View style={styles.topBar}>
              <Pressable onPress={() => setPhase('checklist')} style={styles.topBarBtn}>
                <Ion name="arrow-back" size={18} color={palette.body} />
              </Pressable>
              <Text style={styles.topBarTitle} numberOfLines={1}>{recipe.title}</Text>
              <Pressable onPress={toggleMute} style={[styles.topBarBtn, muted && styles.topBarBtnMuted]}>
                <Ion name={muted ? 'volume-mute' : 'volume-high'} size={18} color={muted ? palette.terracotta : palette.body} />
              </Pressable>
            </View>
            <Text style={styles.stepCounter}>
              Step {currentStep + 1} of {steps.length}
            </Text>
            <Pressable
              onPress={() => step && speak(step.instruction, muted)}
              style={({pressed}) => [styles.replayBtn, pressed && {opacity: 0.7}]}>
              <Ion name="refresh" size={13} color={palette.terracotta} />
              <Text style={styles.replayBtnText}>Replay step</Text>
            </Pressable>

            {stepsLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.terracotta} size="small" />
                <Text style={styles.loadingText}>Rémy is preparing the steps...</Text>
              </View>
            ) : step ? (
              <>
                <View style={styles.stepCard}>
                  <Text style={styles.stepText}>{step.instruction}</Text>
                  {step.timerSeconds && <StepTimer seconds={step.timerSeconds} />}
                </View>

                <View style={styles.stepNav}>
                  {currentStep > 0 && (
                    <Pressable
                      onPress={prevStep}
                      style={({pressed}) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}>
                      <Text style={styles.secondaryBtnText}>Previous</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={nextStep}
                    style={({pressed}) => [styles.primaryBtn, styles.stepNextBtn, pressed && styles.primaryBtnPressed]}>
                    <Text style={styles.primaryBtnText}>
                      {currentStep === steps.length - 1 ? 'Finish' : 'Next Step'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}

          </ScrollView>
        </View>

        {/* Ask Rémy FAB */}
        <Pressable
          onPress={() => setChatOpen(true)}
          style={({pressed}) => [styles.fab, pressed && styles.fabPressed]}>
          <View style={styles.fabDot} />
          <Text style={styles.fabText}>Ask Rémy</Text>
        </Pressable>

        <AskRemy
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          recipeTitle={recipe?.title}
          currentStepInstruction={steps[currentStep]?.instruction}
        />

        <AlertDialog
          visible={finishDialogOpen}
          title="Finish Cooking?"
          message="You're on the final step. Mark this recipe as completed?"
          confirmLabel="Yes, Finish"
          cancelLabel="Not Yet"
          onConfirm={confirmFinish}
          onCancel={() => setFinishDialogOpen(false)}
        />

      </KeyboardAvoidingView>
    );
  }

  // ── Phase: Done ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.doneContent}>

        <View style={styles.topBar}>
          <View style={{flex: 1}} />
          <Pressable onPress={toggleMute} style={[styles.topBarBtn, muted && styles.topBarBtnMuted]}>
            <Ion name={muted ? 'volume-mute' : 'volume-high'} size={18} color={muted ? palette.terracotta : palette.body} />
          </Pressable>
        </View>

        <Text style={styles.doneFrench}>Bon Appétit!</Text>
        <Text style={styles.doneTitle}>{recipe.title}</Text>
        <Text style={styles.doneSub}>
          {recipe.cuisine} · {recipe.duration} · {recipe.servings} servings
        </Text>
        <View style={styles.doneDivider} />
        <Text style={styles.doneMessage}>
          You've cooked something wonderful today.
        </Text>

        <View style={styles.doneActions}>
          <Pressable
            onPress={() => navigation.navigate('home')}
            style={({pressed}) => [styles.secondaryBtn, styles.doneSecondaryBtn, pressed && styles.secondaryBtnPressed]}>
            <Text style={styles.secondaryBtnText}>Home</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setPhase('intro');
              setCurrentStep(0);
              setSteps([]);
            }}
            style={({pressed}) => [styles.primaryBtn, styles.donePrimaryBtn, pressed && styles.primaryBtnPressed]}>
            <Text style={styles.primaryBtnText}>Cook Again</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 24,
    color: palette.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 15,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Shared phase layout
  phaseContent: {
    padding: spacing.xxl,
    paddingBottom: spacing.xxxl + spacing.xxl,
  },

  // Rémy badge
  remyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  remyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.terracotta,
  },
  remyBadgeText: {
    fontFamily: typography.cormorant,
    fontSize: 12,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Recipe title + meta
  recipeTitle: {
    fontFamily: typography.serif,
    fontSize: 28,
    color: palette.ink,
    marginBottom: spacing.md,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  metaItem: {
    fontFamily: typography.cormorant,
    fontSize: 13,
    color: palette.muted,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.muted,
    opacity: 0.5,
  },

  // Intro card
  introCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  introText: {
    fontFamily: typography.cormorantItalic,
    fontSize: 16,
    color: palette.body,
    lineHeight: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.cormorantItalic,
    fontSize: 14,
    color: palette.muted,
  },

  // Phase labels
  phaseLabel: {
    fontFamily: typography.cormorant,
    fontSize: 11,
    color: palette.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  phaseTitle: {
    fontFamily: typography.serif,
    fontSize: 28,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  phaseSub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 14,
    color: palette.muted,
    marginBottom: spacing.xl,
  },

  // Checklist
  checklistCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  checkRowPressed: {
    backgroundColor: palette.surface,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: palette.terracotta,
    borderColor: palette.terracotta,
  },
  checkmark: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: palette.white,
    transform: [{rotate: '-45deg'}, {translateY: -1}],
  },
  checkLabel: {
    fontFamily: typography.cormorant,
    fontSize: 15,
    color: palette.ink,
    flex: 1,
  },
  checkLabelDone: {
    color: palette.muted,
    textDecorationLine: 'line-through',
  },

  // Steps
  stepsContainer: {
    flex: 1,
  },
  progressTrack: {
    height: 3,
    backgroundColor: palette.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: palette.terracotta,
  },
  stepCounter: {
    fontFamily: typography.cormorant,
    fontSize: 11,
    color: palette.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  stepCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  stepText: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    color: palette.ink,
    lineHeight: 26,
  },
  stepNav: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNextBtn: {
    flex: 1,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: palette.terracotta,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnPressed: {
    opacity: 0.85,
  },
  primaryBtnText: {
    fontFamily: typography.cormorant,
    fontSize: 16,
    letterSpacing: 1,
    color: palette.white,
  },
  secondaryBtn: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  secondaryBtnPressed: {
    opacity: 0.8,
  },
  secondaryBtnText: {
    fontFamily: typography.cormorant,
    fontSize: 16,
    letterSpacing: 1,
    color: palette.body,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.xxl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.ink,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{scale: 0.97}],
  },
  fabDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.terracotta,
  },
  fabText: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    letterSpacing: 0.8,
    color: palette.white,
  },



  // Substitution
  subBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(200,82,42,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(200,82,42,0.2)',
    borderRadius: 14,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  subBtnText: {
    fontFamily: typography.cormorantItalic,
    fontSize: 15,
    color: palette.terracotta,
    letterSpacing: 0.3,
  },
  subCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subCardTitle: {
    fontFamily: typography.cormorant,
    fontSize: 12,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subCardText: {
    fontFamily: typography.cormorant,
    fontSize: 15,
    color: palette.body,
    lineHeight: 24,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    minHeight: 38,
  },
  topBarBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topBarBtnMuted: {
    backgroundColor: 'rgba(200,82,42,0.08)',
    borderColor: palette.terracotta,
  },
  topBarTitle: {
    flex: 1,
    fontFamily: typography.serif,
    fontSize: 15,
    color: palette.ink,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: 'rgba(200,82,42,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,82,42,0.2)',
  },
  replayBtnText: {
    fontFamily: typography.cormorant,
    fontSize: 12,
    color: palette.terracotta,
    letterSpacing: 0.5,
  },

  // TTS controls
  remyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stepHeaderActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ttsBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttsBtnMuted: {
    backgroundColor: 'rgba(200,82,42,0.08)',
    borderColor: palette.terracotta,
  },
  ttsBtnPressed: {
    opacity: 0.75,
  },
  replayIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: palette.body,
  },
  muteIcon: {
    width: 14,
    height: 10,
    borderWidth: 1.5,
    borderColor: palette.body,
    borderRadius: 2,
  },
  muteIconMuted: {
    borderColor: palette.terracotta,
    backgroundColor: 'rgba(200,82,42,0.15)',
  },

  // Done screen
  doneContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  doneFrench: {
    fontFamily: typography.cormorantItalic,
    fontSize: 16,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  doneTitle: {
    fontFamily: typography.serif,
    fontSize: 30,
    color: palette.ink,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: spacing.sm,
    maxWidth: '85%',
  },
  doneSub: {
    fontFamily: typography.cormorant,
    fontSize: 13,
    color: palette.muted,
    letterSpacing: 0.5,
    marginBottom: spacing.xl,
  },
  doneDivider: {
    width: 40,
    height: 1,
    backgroundColor: palette.border,
    marginBottom: spacing.xl,
  },
  doneMessage: {
    fontFamily: typography.cormorantItalic,
    fontSize: 16,
    color: palette.body,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: '80%',
    marginBottom: spacing.xs,
  },
  doneActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  donePrimaryBtn: {
    minWidth: 132,
    paddingVertical: 14,
  },
  doneSecondaryBtn: {
    minWidth: 92,
    paddingVertical: 14,
  },
});