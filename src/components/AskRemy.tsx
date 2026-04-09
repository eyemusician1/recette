import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
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
import Ion from 'react-native-vector-icons/Ionicons';
import {palette, spacing, typography} from '../tokens';
import {ENV} from '../env';
import {FoodPreferenceStrictness, TtsLanguage} from '../services/authService';
import {buildFoodPreferenceInstruction} from '../utils/foodPreferences';

// Point this to your deployed backend cache API
const BACKEND_AI_API_URL = 'https://recette-production.up.railway.app/ai/ask';
const REMY_LOGO = require('../../assets/images/remy.png');

type ChatMessage = {
  role: 'remy' | 'user';
  text: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  recipeTitle?: string;
  currentStepInstruction?: string;
  language?: TtsLanguage;
  dietaryPrefs?: string[];
  allergyPrefs?: string[];
  excludedIngredients?: string[];
  strictness?: FoodPreferenceStrictness;
};

// Simple in-memory cache for repeated queries (per session)
const aiCache = new Map<string, string>();

function hashMessages(messages: {role: string; content: string}[]): string {
  return messages.map(m => `${m.role}:${m.content}`).join('\n');
}

async function askGroq(messages: {role: string; content: string}[]) {
  const key = hashMessages(messages);
  if (aiCache.has(key)) {
    return aiCache.get(key)!;
  }

  const res = await fetch(BACKEND_AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({messages}),
  });

  // Throw on HTTP-level errors so the catch block in send() shows the error message
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error ?? `Server error: ${res.status}`);
  }

  const data = await res.json();
  const reply = data.reply ?? '';

  if (!reply) {
    throw new Error('Empty reply from server');
  }

  // Only cache valid non-empty replies
  aiCache.set(key, reply);
  return reply;
}

function buildRemySystemPrompt(
  language: TtsLanguage,
  dietaryPrefs: string[],
  allergyPrefs: string[],
  excludedIngredients: string[],
  strictness: FoodPreferenceStrictness,
  recipeTitle?: string,
  currentStepInstruction?: string,
) {
  const recipeContext = recipeTitle
    ? `Recipe context: The user is cooking "${recipeTitle}".`
    : 'Recipe context: No recipe title provided yet.';
  const stepContext = currentStepInstruction
    ? `Current step context: ${currentStepInstruction}`
    : 'Current step context: Not provided.';
  const languageRule = language === 'tl-PH'
    ? 'Respond in natural conversational Tagalog (Filipino). Avoid English unless user explicitly asks for English.'
    : 'Respond in clear conversational English.';

  return [
    'You are Remy, a calm and practical chef coach helping a home cook in real time.',
    recipeContext,
    stepContext,
    languageRule,
    buildFoodPreferenceInstruction(language, {
      dietaryPreferences: dietaryPrefs,
      allergies: allergyPrefs,
      excludedIngredients,
      strictness,
    }),
    'Response rules:',
    '1) Keep replies concise and actionable in 2-5 short sentences.',
    '2) Prefer concrete guidance with quantities, timing, heat level, and visual cues when useful.',
    '3) If the question is unclear, ask one brief clarifying question before guessing.',
    '4) Suggest safe food-handling advice when relevant (raw meat, eggs, storage, temperature).',
    '5) If suggesting substitutions, provide one best option first, then one backup if needed.',
    '6) Use plain conversational language suitable for text-to-speech.',
    '7) Do not use markdown tables or code blocks.',
  ].join('\n');
}

export function AskRemy({
  visible,
  onClose,
  recipeTitle,
  currentStepInstruction,
  language = 'en-US',
  dietaryPrefs = [],
  allergyPrefs = [],
  excludedIngredients = [],
  strictness = 'strict',
}: Props) {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    if (!chatInput.trim()) {return;}
    const userMsg = chatInput.trim();
    setChatInput('');
    setMessages(m => [...m, {role: 'user', text: userMsg}]);
    setLoading(true);

    try {
      const recentHistory = messages.slice(-6).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text,
      }));

      const reply = await askGroq([
        {
          role: 'system',
          content: buildRemySystemPrompt(
            language,
            dietaryPrefs,
            allergyPrefs,
            excludedIngredients,
            strictness,
            recipeTitle,
            currentStepInstruction,
          ),
        },
        ...recentHistory,
        {role: 'user', content: userMsg},
      ]);
      setMessages(m => [...m, {role: 'remy', text: reply}]);
    } catch {
      setMessages(m => [...m, {
        role: 'remy',
        text: language === 'tl-PH'
          ? 'Pasensya na, nagkaproblema ako sa pagsagot. Pakisubukan ulit!'
          : 'Sorry, I had trouble answering that. Try again!',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        <Pressable style={styles.dismiss} onPress={handleClose} />

        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <Image source={REMY_LOGO} style={styles.headerAvatar} resizeMode="contain" />
            <Text style={styles.title}>Ask Rémy</Text>
            <Text style={styles.subtitle}>Your AI chef is here to help</Text>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({animated: true})}
            showsVerticalScrollIndicator={false}>

            {messages.length === 0 && (
              <Text style={styles.emptyText}>
                {language === 'tl-PH'
                  ? 'Magtanong ka tungkol sa recipe na ito — pamalit na sangkap, techniques, timing...'
                  : 'Ask me anything about this recipe — substitutions, techniques, timing...'}
              </Text>
            )}

            {messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.bubbleUser : styles.bubbleRemy,
                ]}>
                {msg.role === 'remy' && <Image source={REMY_LOGO} style={styles.remyAvatar} resizeMode="contain" />}
                <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>
                  {msg.text}
                </Text>
              </View>
            ))}

            {loading && (
              <View style={[styles.bubble, styles.bubbleRemy]}>
                <Image source={REMY_LOGO} style={styles.remyAvatar} resizeMode="contain" />
                <ActivityIndicator color={palette.terracotta} size="small" style={{padding: spacing.sm}} />
              </View>
            )}

          </ScrollView>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={language === 'tl-PH' ? 'Magtanong...' : 'Ask something...'}
              placeholderTextColor={palette.muted}
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
            />
            <Pressable
              onPress={send}
              disabled={!chatInput.trim() || loading}
              style={({pressed}) => [
                styles.sendBtn,
                pressed && styles.sendBtnPressed,
                (!chatInput.trim() || loading) && styles.sendBtnDisabled,
              ]}>
              <Ion
                name="send"
                size={18}
                color={chatInput.trim() && !loading ? palette.white : palette.muted}
                style={styles.sendIcon}
              />
            </Pressable>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
    backgroundColor: 'rgba(44,26,14,0.3)',
  },
  sheet: {
    backgroundColor: palette.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderColor: palette.border,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    marginBottom: spacing.md,
  },
  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: typography.serif,
    fontSize: 23,
    color: palette.ink,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: typography.cormorantItalic,
    fontSize: 16,
    color: palette.muted,
  },

  // Messages
  messages: {flex: 1},
  messagesContent: {
    flexGrow: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: typography.cormorantItalic,
    fontSize: 17,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingVertical: spacing.xl,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    maxWidth: '85%',
  },
  bubbleRemy: {alignSelf: 'flex-start'},
  bubbleUser: {alignSelf: 'flex-end', flexDirection: 'row-reverse'},
  remyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginTop: 4,
    flexShrink: 0,
  },
  bubbleText: {
    fontFamily: typography.cormorant,
    fontSize: 18,
    color: palette.ink,
    lineHeight: 22,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: spacing.md,
    flex: 1,
  },
  bubbleTextUser: {
    backgroundColor: palette.terracotta,
    borderColor: palette.terracotta,
    color: palette.white,
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  input: {
    flex: 1,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: typography.cormorant,
    fontSize: 18,
    color: palette.ink,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: palette.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: {opacity: 0.85},
  sendBtnDisabled: {backgroundColor: palette.surface},
  sendIcon: {
    marginLeft: 1,
  },
});