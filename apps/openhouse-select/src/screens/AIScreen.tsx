/**
 * AI Screen — Full-screen modal with frosted glass, gold radial light source,
 * hero header, horizontal chip scroll, chat bubbles.
 * Mock QA responses from prototype.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, IC, RADIUS } from '../tokens';
import { Icon } from '../components/Icon';

const QA: Record<string, string> = {
  'Who installed my heating?':
    'Your heating was installed by **Cronin Plumbing & Heating** in Douglas — 021 489 7654. Viessmann Vitodens 200-W, commissioned 14th November 2024. Their 2-year aftercare covers all parts and labour.',
  'What tiles are in my en suite?':
    'En suite floor: **Porcelanosa Urban Caliza 59.6×59.6cm** matt. Walls: **Porcelanosa Bali Caliza 33.3×100cm**. Available at Porcelanosa Cork, South Douglas Road.',
  'When is my boiler service due?':
    'First annual service due **November 2025**. Cronin Plumbing cover it under your aftercare at no charge. I\'ll send you a reminder in October.',
  "What's my BER rating?":
    'Your home is **BER A2** — 61 kWh/m²/yr. That puts you in the top 8% of Irish homes. Certificate issued 8th December 2024, saved in your Documents.',
};

const CHIPS = [
  { q: 'Who installed my heating?', over: 'Tradespeople', icon: IC.heat },
  { q: 'What tiles are in my en suite?', over: 'Finishes', icon: IC.docs },
  { q: 'When is my boiler service due?', over: 'Maintenance', icon: IC.story },
  { q: "What's my BER rating?", over: 'Energy', icon: IC.solar },
];

interface Msg { r: 'ai' | 'u'; t: string }

function ThinkingOrbs() {
  return (
    <View style={styles.thinkRow}>
      <View style={styles.thinkBadge}>
        <Icon d={IC.spark} size={13} color={C.bg} strokeWidth={2.4} />
      </View>
      <View style={styles.thinkBubble}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.thinkDot} />
        ))}
      </View>
    </View>
  );
}

export default function AIScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Msg[]>([{
    r: 'ai',
    t: 'Morning, Sarah. 14 Innishmore Rise is running perfectly — solar generating 3.1 kW right now. What would you like to know?',
  }]);
  const [inp, setInp] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (txt?: string) => {
    const t = (txt || inp).trim();
    if (!t) return;
    setInp('');
    setMsgs(m => [...m, { r: 'u', t }]);
    setBusy(true);
    await new Promise(r => setTimeout(r, 1100));
    setMsgs(m => [...m, {
      r: 'ai',
      t: QA[t] || 'I have full records for your home — could you be a bit more specific?',
    }]);
    setBusy(false);
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs, busy]);

  const hasInput = inp.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,2,8,0.93)' }]} />

      {/* Top gold line */}
      <View style={styles.topLine} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Icon d={IC.close} size={13} color={C.t3} />
        </TouchableOpacity>

        <View style={styles.headerBadge}>
          <Icon d={IC.spark} size={22} color={C.bg} strokeWidth={2.4} />
        </View>

        <Text style={styles.headerOverline}>OpenHouse Intelligence</Text>
        <Text style={styles.headerTitle}>Home Assistant</Text>
        <Text style={styles.headerSub}>14 Innishmore Rise</Text>

        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>All systems normal</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.msgScroll}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {msgs.map((m, i) => (
          <View key={i} style={[styles.msgRow, m.r === 'u' && styles.msgRowUser]}>
            {m.r === 'ai' && (
              <View style={styles.aiBadge}>
                <Icon d={IC.spark} size={12} color={C.bg} strokeWidth={2.4} />
              </View>
            )}
            <View style={[
              styles.bubble,
              m.r === 'u' ? styles.bubbleUser : styles.bubbleAi,
            ]}>
              <Text style={[styles.msgText, m.r === 'u' && styles.msgTextUser]}>{m.t}</Text>
            </View>
            {m.r === 'u' && <View style={styles.userAvatar}><View style={styles.userDot} /></View>}
          </View>
        ))}
        {busy && <ThinkingOrbs />}
      </ScrollView>

      {/* Chips — shown when conversation is fresh */}
      {msgs.length <= 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}>
          {CHIPS.map((chip, i) => (
            <TouchableOpacity key={i} style={styles.chip} activeOpacity={0.7} onPress={() => send(chip.q)}>
              <View style={styles.chipHeader}>
                <Icon d={chip.icon} size={11} color={C.g} strokeWidth={1.8} />
                <Text style={styles.chipOver}>{chip.over}</Text>
              </View>
              <Text style={styles.chipQ}>{chip.q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <TextInput
            value={inp}
            onChangeText={setInp}
            onSubmitEditing={() => send()}
            placeholder="Ask anything about your home…"
            placeholderTextColor={C.t3}
            style={styles.input}
            returnKeyType="send"
          />
        </View>
        <TouchableOpacity
          onPress={() => send()}
          style={[styles.sendBtn, hasInput && styles.sendBtnActive]}
          disabled={!hasInput}
        >
          <Icon d={IC.send} size={17} color={hasInput ? C.bg : C.t3} strokeWidth={hasInput ? 2 : 1.6} />
        </TouchableOpacity>
      </View>
      <Text style={styles.powered}>Powered by OpenHouse Intelligence · Knows your home completely</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topLine: {
    height: 1,
    backgroundColor: C.g,
    opacity: 0.4,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.10)',
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.g,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: C.g,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },
  headerOverline: { fontSize: 10, fontWeight: '700', color: C.g, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.75, marginBottom: 5 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.t1, letterSpacing: -0.34 },
  headerSub: { fontSize: 11.5, color: C.t2, marginTop: 3 },
  statusPill: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(45,200,122,0.08)', borderWidth: 1, borderColor: 'rgba(45,200,122,0.18)',
    borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.grn, shadowColor: C.grn, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4 },
  statusText: { fontSize: 10.5, color: C.grn, fontWeight: '600' },

  msgScroll: { flex: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16, gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  aiBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: C.g,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
    shadowColor: C.g, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 5,
  },
  bubble: { maxWidth: '76%', borderRadius: 20 },
  bubbleAi: {
    backgroundColor: 'rgba(16,14,26,0.85)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)',
    paddingVertical: 13, paddingHorizontal: 16, borderTopLeftRadius: 6,
  },
  bubbleUser: {
    backgroundColor: C.g, paddingVertical: 11, paddingHorizontal: 16, borderBottomRightRadius: 6,
    shadowColor: C.g, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12,
  },
  msgText: { fontSize: 13.5, lineHeight: 22, color: C.t1, fontWeight: '400' },
  msgTextUser: { color: C.bg, fontWeight: '500' },
  userAvatar: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.30)', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  userDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.g, opacity: 0.7 },

  thinkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 18 },
  thinkBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: C.g,
    alignItems: 'center', justifyContent: 'center', shadowColor: C.g, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 7,
  },
  thinkBubble: {
    flexDirection: 'row', gap: 5, alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 18, backgroundColor: 'rgba(14,12,22,0.80)',
    borderRadius: 20, borderTopLeftRadius: 5, borderWidth: 1, borderColor: 'rgba(212,175,55,0.14)',
  },
  thinkDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.g, opacity: 0.5 },

  chipScroll: { paddingBottom: 14 },
  chip: {
    minWidth: 140, backgroundColor: 'rgba(14,12,22,0.80)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.16)', borderRadius: 16,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  chipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  chipOver: { fontSize: 9, fontWeight: '800', color: C.g, letterSpacing: 1.3, textTransform: 'uppercase', opacity: 0.75 },
  chipQ: { fontSize: 12, color: C.t1, lineHeight: 17 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.09)',
    backgroundColor: 'rgba(4,3,10,0.60)',
  },
  input: {
    backgroundColor: 'rgba(12,10,22,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 28, paddingVertical: 13, paddingHorizontal: 20,
    color: C.t1, fontSize: 13.5,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: C.g,
    shadowColor: C.g, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12,
  },
  powered: { textAlign: 'center', fontSize: 9.5, color: C.t3, letterSpacing: 0.75, paddingBottom: 8, paddingTop: 4 },
});
