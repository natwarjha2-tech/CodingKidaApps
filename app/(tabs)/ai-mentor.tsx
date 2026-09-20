import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiMentorApi } from '@/api';
import { Spacing, Typography, FontWeight, Radius } from '@/theme';

// Light theme palette (UI only — consistent with the rest of the app)
const L = {
  bg: '#EEF5FF', ink: '#1E2233', sub: '#8A90A2', blue: '#2F6BFF', blueSoft: '#E6EEFF',
  purple: '#7A3BFF', purpleSoft: '#E8DEFF', line: '#E2E7F0', card: '#FFFFFF',
};

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export default function AiMentorScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'ai', text: "Hi, I'm Codo 🤖 — CodingKida's AI assistant. Ask me anything about coding!" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Scroll so a given message's TOP is visible (used for the AI answer so the
  // user reads it from the start, not auto-scrolled past the top).
  const scrollToMsgTop = (index: number) => {
    if (index < 0) return;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
      } catch {
        // ignore — onScrollToIndexFailed handles out-of-range
      }
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    const thinkingMsg: Message = { id: 'thinking', role: 'ai', text: 'Codo is thinking…' };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setLoading(true);
    // 1a + 1b: show the user's full message immediately — scroll to the end right
    // after it's added, without waiting for the AI response.
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

    // Pre-assign the answer message its final id so we can locate it reliably
    // (no text-matching guesswork) to scroll its top into view (1c).
    const answerId = `ai-${Date.now()}`;
    const finish = (answerText: string) => {
      let answerIndex = -1;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === 'thinking' ? { ...m, id: answerId, text: answerText } : m));
        answerIndex = next.findIndex((m) => m.id === answerId);
        return next;
      });
      // 1c: bring the AI answer's TOP into view (read from the start).
      scrollToMsgTop(answerIndex);
    };

    try {
      const res = await aiMentorApi.ask(text, undefined, 'general');
      finish(res.answer ?? 'No response.');
    } catch {
      finish('⏳ AI is busy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🤖 Codo — AI Mentor</Text>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            // Item not measured yet — wait a tick, then retry (best-effort).
            setTimeout(() => {
              try {
                listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0, animated: true });
              } catch {
                listRef.current?.scrollToEnd({ animated: true });
              }
            }, 120);
          }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={styles.bubbleLabel}>{item.role === 'user' ? 'You' : '🤖 Codo'}</Text>
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
          )}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask anything..."
            placeholderTextColor={L.sub}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={send}
          />
          <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={send} disabled={loading}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: L.bg },
  title: { color: '#151A2E', fontSize: Typography.xl, fontWeight: FontWeight.extrabold, padding: Spacing.xl, paddingBottom: Spacing.md },
  messages: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  bubble: { maxWidth: '85%', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: L.blueSoft, borderColor: L.blue },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: L.card, borderColor: L.line },
  bubbleLabel: { color: L.sub, fontSize: Typography.xs, fontWeight: FontWeight.bold, marginBottom: 4 },
  bubbleText: { color: L.ink, fontSize: Typography.sm, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.lg, borderTopWidth: 1, borderTopColor: L.line,
    backgroundColor: L.bg,
  },
  input: {
    flex: 1, backgroundColor: L.card, borderWidth: 1, borderColor: L.line,
    borderRadius: Radius.md, padding: Spacing.md, color: L.ink,
    fontSize: Typography.sm, minHeight: 44, maxHeight: 140, textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: L.blue, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#FFFFFF', fontWeight: FontWeight.bold, fontSize: Typography.sm },
});
