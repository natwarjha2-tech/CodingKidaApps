/**
 * CodoPromptModal — a reusable Codo "popup" that shows the mascot, speaks a
 * fixed line (voiced via the Codo voice service, which uses the cached /api/tts
 * audio — no AI cost), and offers Accept / Reject actions.
 *
 * Used for the lesson-complete nudge ("you finished the lesson — take a quiz?")
 * and the post-quiz thank-you (single OK button). The spoken text is a constant
 * fetched from /api/codo-scripts (DB-backed), so it is identical for everyone.
 */
import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';
import { speakCodo, stopCodoVoice, isVoiceAvailable } from '@/services';

const CODO_IMG = require('../../../assets/codo.jpg');

interface CodoPromptModalProps {
  visible: boolean;
  // The line Codo shows + speaks. Comes from /api/codo-scripts (DB constant).
  message: string;
  // Primary (accept) button label + handler. Omit acceptLabel to hide it
  // (e.g. the thank-you popup only needs a single dismiss button).
  acceptLabel?: string;
  onAccept?: () => void;
  // Secondary / dismiss button label + handler.
  rejectLabel: string;
  onReject: () => void;
}

export function CodoPromptModal({
  visible,
  message,
  acceptLabel,
  onAccept,
  rejectLabel,
  onReject,
}: CodoPromptModalProps) {
  // Speak the line when the popup opens; stop if it closes.
  useEffect(() => {
    if (visible && message && isVoiceAvailable()) {
      speakCodo(message);
    }
    return () => { stopCodoVoice(); };
  }, [visible, message]);

  const handleAccept = () => { stopCodoVoice(); onAccept?.(); };
  const handleReject = () => { stopCodoVoice(); onReject(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleReject}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Image source={CODO_IMG} style={styles.codoImg} />
          <Text style={styles.message}>{message}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={handleReject} activeOpacity={0.85}>
              <Text style={styles.rejectText}>{rejectLabel}</Text>
            </TouchableOpacity>
            {acceptLabel ? (
              <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={handleAccept} activeOpacity={0.85}>
                <Text style={styles.acceptText}>{acceptLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1230',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },
  codoImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0b0e14',
    marginBottom: Spacing.md,
  },
  message: {
    color: '#e2e8f0',
    fontSize: Typography.md,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.lg,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  acceptBtn: { backgroundColor: Colors.purple },
  acceptText: { color: '#fff', fontSize: Typography.sm, fontWeight: FontWeight.bold },
  rejectBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  rejectText: { color: '#cbd5e1', fontSize: Typography.sm, fontWeight: FontWeight.bold },
});
