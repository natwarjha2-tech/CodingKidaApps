import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiMentorApi, type AiSource } from '@/api';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';
import { CodoAnswerCard } from '@/components/lesson/CodoHelp';
import { PdfViewer } from '@/components/lesson/PdfViewer';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  // AI-answer extras so the Codo card can show sources + play voice (mirrors
  // desktop sendAI). `thinking` marks the transient placeholder bubble.
  source?: string;
  sources?: AiSource[];
  audio?: string | null;
  thinking?: boolean;
}

export default function AiMentorScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'ai', text: "Hi, I'm Codo 🤖 — CodingKida's AI assistant. Ask me anything about coding!" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);
  // In-app PDF viewer for source documents (so taps stay inside the app).
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const openPdf = (url: string) => setPdfUrl(url);

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
    const thinkingMsg: Message = { id: 'thinking', role: 'ai', text: 'Codo is thinking…', thinking: true };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setLoading(true);
    // 1a + 1b: show the user's full message immediately — scroll to the end right
    // after it's added, without waiting for the AI response.
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

    // Pre-assign the answer message its final id so we can locate it reliably
    // (no text-matching guesswork) to scroll its top into view (1c).
    const answerId = `ai-${Date.now()}`;
    const finish = (patch: Partial<Message>) => {
      let answerIndex = -1;
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === 'thinking' ? { ...m, id: answerId, thinking: false, ...patch } : m
        );
        answerIndex = next.findIndex((m) => m.id === answerId);
        return next;
      });
      // 1c: bring the AI answer's TOP into view (read from the start).
      scrollToMsgTop(answerIndex);
    };

    try {
      const res = await aiMentorApi.ask(text, undefined, 'general');
      finish({
        text: res.answer ?? 'No response.',
        source: res.source,
        sources: res.sources,
      });
    } catch {
      finish({ text: '⏳ AI is busy. Please try again.' });
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
          renderItem={({ item }) => {
            // Finished Codo answer → rich card (markdown, sources, voice).
            if (item.role === 'ai' && !item.thinking) {
              return (
                <View style={styles.aiCardWrap}>
                  <CodoAnswerCard
                    text={item.text}
                    source={item.source}
                    sources={item.sources}
                    audio={item.audio}
                    autoPlay
                    onOpenPdf={openPdf}
                  />
                </View>
              );
            }
            // User message or the transient "Codo is thinking…" placeholder.
            return (
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                <Text style={styles.bubbleLabel}>{item.role === 'user' ? 'You' : '🤖 Codo'}</Text>
                <Text style={styles.bubbleText}>{item.text}</Text>
              </View>
            );
          }}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask a coding question..."
            placeholderTextColor={Colors.muted}
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

      {/* In-app PDF viewer for Codo's source documents (stays inside the app). */}
      <PdfViewer
        visible={!!pdfUrl}
        pdfUrl={pdfUrl ?? ''}
        onClose={() => setPdfUrl(null)}
      />
    </SafeAreaView>
  );
}

// Dark theme to match the desktop Codo chat (and the rest of the app). The
// previous light palette made some text invisible against the Codo card.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.white, fontSize: Typography.xl, fontWeight: FontWeight.extrabold, padding: Spacing.xl, paddingBottom: Spacing.md },
  messages: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  aiCardWrap: { maxWidth: '92%', alignSelf: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: 'rgba(108,71,255,0.18)', borderColor: Colors.primary },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.04)', borderColor: Colors.border },
  bubbleLabel: { color: Colors.muted, fontSize: Typography.xs, fontWeight: FontWeight.bold, marginBottom: 4 },
  bubbleText: { color: Colors.text, fontSize: Typography.sm, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.white,
    fontSize: Typography.sm, minHeight: 44, maxHeight: 140, textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: Typography.sm },
});
