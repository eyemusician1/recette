import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
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
import {ENV} from '../env';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

type ChatMessage = {
  role: 'remy' | 'user';
  text: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  recipeTitle?: string;
  currentStepInstruction?: string;
};

async function askGroq(messages: {role: string; content: string}[]) {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ENV.GROQ_API_KEY}`,
    },
    body: JSON.stringify({model: MODEL, max_tokens: 1000, messages}),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export function AskRemy({visible, onClose, recipeTitle, currentStepInstruction}: Props) {
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
      const context = recipeTitle
        ? `We're cooking "${recipeTitle}". ${currentStepInstruction ? `Current step: ${currentStepInstruction}.` : ''}`
        : '';
      const reply = await askGroq([
        {
          role: 'system',
          content: `You are Rémy, a warm AI chef assistant. ${context} Answer questions helpfully and concisely.`,
        },
        {role: 'user', content: userMsg},
      ]);
      setMessages(m => [...m, {role: 'remy', text: reply}]);
    } catch {
      setMessages(m => [...m, {role: 'remy', text: 'Sorry, I had trouble answering that. Try again!'}]);
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
                Ask me anything about this recipe — substitutions, techniques, timing...
              </Text>
            )}

            {messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.bubbleUser : styles.bubbleRemy,
                ]}>
                {msg.role === 'remy' && <View style={styles.remyDot} />}
                <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>
                  {msg.text}
                </Text>
              </View>
            ))}

            {loading && (
              <View style={[styles.bubble, styles.bubbleRemy]}>
                <View style={styles.remyDot} />
                <ActivityIndicator color={palette.terracotta} size="small" style={{padding: spacing.sm}} />
              </View>
            )}

          </ScrollView>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask something..."
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
              <View style={styles.sendArrow} />
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
  remyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.terracotta,
    marginTop: spacing.md,
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
  sendArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderBottomWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: palette.white,
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    marginLeft: 3,
  },
});