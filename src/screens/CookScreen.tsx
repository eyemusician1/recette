import React, {useState, useEffect, useRef} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import {palette, spacing, typography} from '../tokens';
import Tts from 'react-native-tts';
import Ion from 'react-native-vector-icons/Ionicons';
import {ENV} from '../env';
import auth from '@react-native-firebase/auth';
import {addCookHistory, cacheSavedRecipeSteps} from '../services/recipeService';
import {FoodPreferenceStrictness, getUserProfile, TtsLanguage} from '../services/authService';
import {AskRemy} from '../components/AskRemy';
import {AlertDialog} from '../components/AlertDialog';
import {useIsFocused} from '@react-navigation/native';
import {buildFoodPreferenceInstruction, normalizeList} from '../utils/foodPreferences';

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
  stepsByLanguage?: Record<string, string[]>;
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
const REMY_LOGO = require('../../assets/images/remy.png');

function isTagalog(language: TtsLanguage) {
  return language === 'tl-PH';
}

function getAiLanguageInstruction(language: TtsLanguage) {
  return isTagalog(language)
    ? 'Respond in natural conversational Tagalog (Filipino). Avoid English unless the user asks for it.'
    : 'Respond in clear conversational English.';
}

function getLanguageCandidates(language: TtsLanguage): string[] {
  return language === 'tl-PH' ? ['tl-PH', 'fil-PH', 'en-US'] : ['en-US'];
}

function scoreMaleVoice(voice: any): number {
  const text = `${voice?.name ?? ''} ${voice?.id ?? ''}`.toLowerCase();
  let score = 0;
  if (text.includes('male') || text.includes('man') || text.includes('guy')) {score += 6;}
  if (text.includes('female') || text.includes('woman') || text.includes('girl')) {score -= 6;}
  if (text.includes('local')) {score += 2;}
  if (voice?.networkConnectionRequired === false) {score += 1;}
  if (voice?.notInstalled) {score -= 100;}
  return score;
}

async function applyTtsPreferences(language: TtsLanguage) {
  const candidates = getLanguageCandidates(language);
  let appliedLanguage = 'en-US';

  for (const candidate of candidates) {
    try {
      await Tts.setDefaultLanguage(candidate);
      appliedLanguage = candidate;
      break;
    } catch {
      // Try next language candidate.
    }
  }

  try {
    const voices = await Tts.voices();
    const forLanguage = voices
      .filter(v => !v?.notInstalled)
      .filter(v => String(v?.language ?? '').toLowerCase().startsWith(appliedLanguage.slice(0, 2).toLowerCase()));

    const sorted = forLanguage.sort((a, b) => scoreMaleVoice(b) - scoreMaleVoice(a));
    if (sorted[0]?.id) {
      await Tts.setDefaultVoice(sorted[0].id);
    }
  } catch {
    // Keep default engine voice if a male voice cannot be selected.
  }
}

function normalizeSteps(input: string[]): Step[] {
  return input
    .map((instruction, index) => ({index: index + 1, instruction: String(instruction).trim()}))
    .filter(step => step.instruction.length > 0);
}

function formatSuggestionsForTts(text: string): string {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line =>
      line
        .replace(/^[\u2022\-*\d.)\s]+/, '')
        .replace(/\s*(->|→)\s*/g, ' instead of using ')
        .replace(/^you can use this:\s*/i, '')
        .replace(/^instead of this:\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .map(line => {
      if (line.length === 0) {return line;}
      const sentence = line.charAt(0).toUpperCase() + line.slice(1);
      return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
    })
    .join(' ');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function askGroq(
  messages: {role: string; content: string}[],
  options?: {maxTokens?: number; temperature?: number},
) {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: options?.maxTokens ?? 900,
      temperature: options?.temperature ?? 0.35,
      messages,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Timer Component ──────────────────────────────────────────────────────────
function StepTimer({
  seconds,
  muted,
  language,
  onFinished,
}: {
  seconds: number;
  muted: boolean;
  language: TtsLanguage;
  onFinished: (title: string, message: string) => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const doneTitle = isTagalog(language) ? 'Tapos na ang timer' : 'Timer finished';
  const doneSubtitle = isTagalog(language)
    ? 'Tapos na ang step na ito. Puwede ka nang magpatuloy sa susunod.'
    : 'This step is done. You can continue to the next step.';

  useEffect(() => {
    if (running && remaining > 0) {
      interval.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(interval.current!);
            setRunning(false);
            setDone(true);
            try {
              Vibration.vibrate([0, 300, 200, 300]);
            } catch {
              // Ignore vibration failures so timer completion still works.
            }
            if (!muted) {
              Tts.speak(isTagalog(language)
                ? 'Tapos na ang timer. Tapos na ang hakbang na ito.'
                : 'Timer is up. This cooking step is done.');
            }
            onFinished(doneTitle, doneSubtitle);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval.current!);
  }, [running, muted, language, onFinished, doneTitle, doneSubtitle]);

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
    fontSize: 23,
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
    fontSize: 16,
    color: palette.white,
    letterSpacing: 0.5,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function CookScreen({route, navigation}: any) {
  const recipe: Recipe | undefined = route?.params?.recipe;
  const isFocused = useIsFocused();

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
  const [contentLanguage, setContentLanguage] = useState<TtsLanguage>('en-US');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [allergyPrefs, setAllergyPrefs] = useState<string[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [preferenceStrictness, setPreferenceStrictness] = useState<FoodPreferenceStrictness>('strict');
  const [subLoading, setSubLoading] = useState(false);
  const [subSuggestions, setSubSuggestions] = useState('');
  const [timerToast, setTimerToast] = useState<{title: string; message: string} | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const clearCookOnNextBlurRef = useRef(false);
  const timerToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCookSession = (clearRouteParam: boolean) => {
    stopSpeaking();
    setPhase('intro');
    setIntroText('');
    setIntroLoading(false);
    setSteps([]);
    setStepsLoading(false);
    setCurrentStep(0);
    setChecked([]);
    setChatOpen(false);
    setFinishDialogOpen(false);
    setSubLoading(false);
    setSubSuggestions('');
    setTimerToast(null);
    if (timerToastTimerRef.current) {
      clearTimeout(timerToastTimerRef.current);
    }
    if (clearRouteParam) {
      navigation.setParams({recipe: undefined});
    }
  };

  // Reset all state when recipe changes + setup TTS once
  useEffect(() => {
    Tts.setDefaultRate(0.5);
    Tts.setDefaultPitch(0.9);

    return () => {
      if (timerToastTimerRef.current) {
        clearTimeout(timerToastTimerRef.current);
      }
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    const syncTtsFromProfile = async () => {
      const uid = auth().currentUser?.uid;
      if (!uid) {
        await applyTtsPreferences('en-US');
        return;
      }
      try {
        const profile = await getUserProfile(uid);
        const language: TtsLanguage = profile?.ttsLanguage === 'tl-PH' ? 'tl-PH' : 'en-US';
        setContentLanguage(language);
        setDietaryPrefs(normalizeList(profile?.dietaryPreferences));
        setAllergyPrefs(normalizeList(profile?.allergies));
        setExcludedIngredients(normalizeList(profile?.excludedIngredients));
        setPreferenceStrictness(
          profile?.foodPreferenceStrictness === 'prefer' || profile?.foodPreferenceStrictness === 'avoid'
            ? profile.foodPreferenceStrictness
            : 'strict',
        );
        await applyTtsPreferences(language);
      } catch {
        setContentLanguage('en-US');
        setDietaryPrefs([]);
        setAllergyPrefs([]);
        setExcludedIngredients([]);
        setPreferenceStrictness('strict');
        await applyTtsPreferences('en-US');
      }
    };

    if (isFocused) {
      void syncTtsFromProfile();
    }
  }, [isFocused]);

  useEffect(() => {
    if (isFocused) {return;}
    stopSpeaking();
    if (clearCookOnNextBlurRef.current) {
      clearCookOnNextBlurRef.current = false;
      resetCookSession(true);
    }
  }, [isFocused, navigation]);

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

  useEffect(() => {
    if (!recipe || !isFocused) {return;}
    setSubSuggestions('');
    if (phase === 'steps') {
      setCurrentStep(0);
      loadSteps();
      return;
    }
    loadIntro();
  }, [contentLanguage, dietaryPrefs, allergyPrefs, excludedIngredients]);

  const loadIntro = async () => {
    if (!recipe) return;
    setIntroLoading(true);
    try {
      const text = await askGroq([{
        role: 'system',
        content: `You are Rémy, a warm and encouraging chef coach.
Write clearly for a home cook.
Keep the intro concise, practical, and motivating.
Do not use markdown, lists, or symbols.
Use plain conversational sentences suitable for text-to-speech.
${getAiLanguageInstruction(contentLanguage)}
${buildFoodPreferenceInstruction(contentLanguage, {
  dietaryPreferences: dietaryPrefs,
  allergies: allergyPrefs,
  excludedIngredients,
  strictness: preferenceStrictness,
})}`,
      }, {
        role: 'user',
        content: `I am about to cook "${recipe.title}".
Cuisine: ${recipe.cuisine}.
Estimated duration: ${recipe.duration}.
Difficulty: ${recipe.difficulty}.

Give me exactly 3 short sentences:
Sentence 1: what this dish is and why it is great.
Sentence 2: one key success tip for this specific dish.
Sentence 3: a short confidence boost before cooking starts.`,
      }], {maxTokens: 220, temperature: 0.45});
      setIntroText(text);
      speak(text, muted);
    } catch {
      const fallback = isTagalog(contentLanguage)
        ? `Maligayang pagdating! Ngayon lulutuin natin ang ${recipe?.title ?? 'masarap na pagkain'}. I-check muna natin ang mga sangkap, pagkatapos gagabayan kita sa bawat hakbang.`
        : `Welcome! Today we're making ${recipe?.title ?? 'something delicious'}. Let's check your ingredients first, then I'll walk you through every step.`;
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
      const doneLine = isTagalog(contentLanguage)
        ? `Tapos na ang pagluluto ng ${recipe.title}. Kain na at mag-enjoy!`
        : `Bon appétit! You've finished cooking ${recipe.title}. Enjoy your meal!`;
      speak(doneLine, muted);
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
  }, [phase, recipe, muted, contentLanguage]);

  const loadSteps = async () => {
    if (!recipe) return;
    setStepsLoading(true);
    try {
      const text = await askGroq([{
        role: 'system',
        content: `You are a professional chef assistant.
Return only raw JSON with no markdown and no extra commentary.
Every step must be concrete, sequential, and safe for a home cook.
      Use direct action verbs and include specific cues when to move to the next step.
      ${getAiLanguageInstruction(contentLanguage)}
  ${buildFoodPreferenceInstruction(contentLanguage, {
    dietaryPreferences: dietaryPrefs,
    allergies: allergyPrefs,
    excludedIngredients,
        strictness: preferenceStrictness,
  })}
      Write every "instruction" value in ${isTagalog(contentLanguage) ? 'Tagalog' : 'English'}.`,
      }, {
        role: 'user',
        content: `Create detailed cooking steps for this recipe:
Title: ${recipe.title}
Cuisine: ${recipe.cuisine}
Duration target: ${recipe.duration}
Difficulty: ${recipe.difficulty}
Ingredients:
${recipe.ingredients.map(ing => `- ${ing}`).join('\n')}

Return ONLY a JSON array with this exact schema:
[{"index":1,"instruction":"...","timerSeconds":300}]

Rules:
1) Return 6 to 10 steps.
2) "index" must be sequential starting at 1.
3) "instruction" must be one clear sentence, plain words, no numbering prefix.
4) Add "timerSeconds" only when there is actual waiting time (simmer, boil, bake, rest).
5) Include practical cues such as heat level, texture, color, smell, or doneness where useful.
6) Keep output valid JSON only.`,
      }], {maxTokens: 1200, temperature: 0.3});
      const clean = text.replace(/```json|```/g, '').trim();
      const parsedRaw: Step[] = JSON.parse(clean);
      const parsed = parsedRaw
        .filter(step => typeof step?.instruction === 'string' && step.instruction.trim().length > 0)
        .map((step, idx) => ({
          index: idx + 1,
          instruction: String(step.instruction).trim().replace(/^\d+[.)]\s*/, ''),
          timerSeconds: typeof step.timerSeconds === 'number' && step.timerSeconds > 0
            ? Math.round(step.timerSeconds)
            : undefined,
        }));
      setSteps(parsed);
      const user = auth().currentUser;
      if (user && recipe.id) {
        const stepText = parsed.map(step => step.instruction).filter(Boolean);
        if (stepText.length > 0) {
          await cacheSavedRecipeSteps(user.uid, recipe.id, stepText, contentLanguage);
        }
      }
      if (parsed.length > 0) {
        speak(parsed[0].instruction, muted);
      }
    } catch {
      const languageCached = recipe.stepsByLanguage?.[contentLanguage] ?? [];
      const cached = normalizeSteps(languageCached.length > 0 ? languageCached : (recipe.steps ?? []));
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
        content: `You are Rémy, a helpful AI chef. Be concise and practical.
${getAiLanguageInstruction(contentLanguage)}
${buildFoodPreferenceInstruction(contentLanguage, {
  dietaryPreferences: dietaryPrefs,
  allergies: allergyPrefs,
  excludedIngredients,
  strictness: preferenceStrictness,
})}`,
      }, {
        role: 'user',
        content: `I am making "${recipe?.title}" but I am missing: ${missing.join(', ')}. For each missing ingredient, suggest a practical substitute I might already have at home.
Use a friendly, conversational tone like a real person helping me cook.
Write only short, complete sentences with plain words.
Do not use bullet points, arrows, symbols, abbreviations, or list markers.
For each item, clearly say the missing ingredient, a substitute, and one short reason it works.
Keep it brief and natural for text-to-speech.`,
      }]);
      const formatted = formatSuggestionsForTts(text);
      setSubSuggestions(formatted);
      speak(formatted, muted);
    } catch {
      setSubSuggestions(isTagalog(contentLanguage)
        ? 'Pasensya na, hindi ako nakapagbigay ng mungkahi. Pakisubukan ulit.'
        : 'Sorry, could not get suggestions. Please try again.');
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

  const showTimerToast = (title: string, message: string) => {
    setTimerToast({title, message});
    if (timerToastTimerRef.current) {
      clearTimeout(timerToastTimerRef.current);
    }
    timerToastTimerRef.current = setTimeout(() => {
      setTimerToast(null);
    }, 3000);
  };

  // ── No recipe passed ─────────────────────────────────────────────────────
  if (!recipe) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No recipe selected</Text>
        <Text style={styles.emptySub}>Search for a recipe on Discover and tap "Start Cooking".</Text>
        <Pressable
          onPress={() => navigation.navigate('home')}
          style={({pressed}) => [styles.primaryBtn, styles.emptyCtaBtn, pressed && styles.primaryBtnPressed]}>
          <Text style={[styles.primaryBtnText, styles.emptyCtaText]}>Go to Discover</Text>
        </Pressable>
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
                <Image source={REMY_LOGO} style={styles.subCardAvatar} resizeMode="contain" />
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
                  {step.timerSeconds && (
                    <StepTimer
                      seconds={step.timerSeconds}
                      muted={muted}
                      language={contentLanguage}
                      onFinished={showTimerToast}
                    />
                  )}
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
          <Image source={REMY_LOGO} style={styles.fabAvatar} resizeMode="contain" />
          <Text style={styles.fabText}>Ask Rémy</Text>
        </Pressable>

        {timerToast && (
          <View style={styles.floatingToastWrap} pointerEvents="none">
            <View style={styles.floatingToastCard}>
              <Ion name="checkmark-circle" size={18} color={palette.terracotta} />
              <View style={styles.floatingToastTextWrap}>
                <Text style={styles.floatingToastTitle}>{timerToast.title}</Text>
                <Text style={styles.floatingToastSub}>{timerToast.message}</Text>
              </View>
            </View>
          </View>
        )}

        <AskRemy
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          recipeTitle={recipe?.title}
          currentStepInstruction={steps[currentStep]?.instruction}
          language={contentLanguage}
          dietaryPrefs={dietaryPrefs}
          allergyPrefs={allergyPrefs}
          excludedIngredients={excludedIngredients}
          strictness={preferenceStrictness}
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
            onPress={() => {
              clearCookOnNextBlurRef.current = true;
              navigation.navigate('home');
            }}
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
    fontSize: 27,
    color: palette.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 18,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCtaBtn: {
    marginTop: spacing.lg,
    minWidth: 156,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaText: {
    fontSize: 16,
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
    fontSize: 15,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Recipe title + meta
  recipeTitle: {
    fontFamily: typography.serif,
    fontSize: 32,
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
    fontSize: 16,
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
    fontSize: 19,
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
    fontSize: 17,
    color: palette.muted,
  },

  // Phase labels
  phaseLabel: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  phaseTitle: {
    fontFamily: typography.serif,
    fontSize: 32,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  phaseSub: {
    fontFamily: typography.cormorantItalic,
    fontSize: 17,
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
    fontSize: 18,
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
    fontSize: 14,
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
    fontSize: 20,
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
    fontSize: 19,
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
    fontSize: 19,
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
  fabAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  fabText: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    letterSpacing: 0.8,
    color: palette.white,
  },

  floatingToastWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxxl + spacing.xxl,
  },
  floatingToastCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 3},
    elevation: 5,
  },
  floatingToastTextWrap: {
    flex: 1,
  },
  floatingToastTitle: {
    fontFamily: typography.cormorant,
    fontSize: 17,
    color: palette.ink,
    marginBottom: 2,
  },
  floatingToastSub: {
    fontFamily: typography.cormorant,
    fontSize: 14,
    color: palette.muted,
    lineHeight: 18,
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
    fontSize: 18,
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
  subCardAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  subCardTitle: {
    fontFamily: typography.cormorant,
    fontSize: 15,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subCardText: {
    fontFamily: typography.cormorant,
    fontSize: 18,
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
    fontSize: 18,
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
    fontSize: 15,
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
    fontSize: 19,
    color: palette.terracotta,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  doneTitle: {
    fontFamily: typography.serif,
    fontSize: 34,
    color: palette.ink,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: spacing.sm,
    maxWidth: '85%',
  },
  doneSub: {
    fontFamily: typography.cormorant,
    fontSize: 16,
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
    fontSize: 19,
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