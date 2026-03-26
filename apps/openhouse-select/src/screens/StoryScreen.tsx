/**
 * Story screen — Timeline with photo thumbnails, builder card.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, TYPE, RADIUS } from '../tokens';

const STAGES = [
  { date: 'January 2024', label: 'Site preparation', done: true, photos: 3 },
  { date: 'March 2024', label: 'Foundations poured', done: true, photos: 5 },
  { date: 'May 2024', label: 'Superstructure complete', done: true, photos: 8 },
  { date: 'June 2024', label: 'Roof structure on', done: true, photos: 4 },
  { date: 'August 2024', label: 'First fix complete', done: true, photos: 6 },
  { date: 'October 2024', label: 'Second fix & finishes', done: true, photos: 11 },
  { date: 'December 2024', label: 'Keys handed over', done: true, photos: 7, gold: true },
  { date: 'November 2025', label: 'First annual service', done: false, upcoming: true },
];

const THUMB_COLORS = ['#16151E', '#151720', '#17151C'];

export default function StoryScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.overlineRow}>
        <View style={styles.overlineLine} />
        <Text style={styles.overlineText}>Your Home</Text>
      </View>
      <Text style={styles.heading}>Home Story</Text>
      <Text style={styles.subtitle}>From groundbreak to forever home · 44 photos</Text>

      {STAGES.map((s, i) => (
        <View key={i} style={styles.stageRow}>
          {/* Timeline spine */}
          <View style={styles.spine}>
            <View style={[
              styles.dot,
              s.gold && styles.dotGold,
              s.done && !s.gold && styles.dotDone,
              s.upcoming && styles.dotUpcoming,
              !s.done && !s.upcoming && styles.dotEmpty,
            ]} />
            {i < STAGES.length - 1 && (
              <View style={[styles.line, s.done && styles.lineDone]} />
            )}
          </View>

          {/* Stage content */}
          <View style={styles.stageContent}>
            <Text style={styles.stageDate}>{s.date}</Text>
            <View style={styles.stageLabelRow}>
              <Text style={[
                styles.stageLabel,
                s.gold && { color: C.g, fontWeight: '700' },
                s.upcoming && { color: C.t3 },
              ]}>
                {s.label}
              </Text>
              {s.gold && (
                <View style={styles.handoverBadge}>
                  <Text style={styles.handoverText}>✦ Handover</Text>
                </View>
              )}
            </View>

            {/* Photo thumbnails */}
            {s.photos && (
              <View style={styles.thumbRow}>
                {[...Array(Math.min(s.photos, 3))].map((_, j) => (
                  <View key={j} style={[styles.thumb, { backgroundColor: THUMB_COLORS[j % 3] }]}>
                    <View style={[styles.thumbPlaceholder, { opacity: 0.045 + j * 0.02 }]} />
                  </View>
                ))}
                {s.photos > 3 && (
                  <View style={styles.thumbMore}>
                    <Text style={styles.thumbMoreText}>+{s.photos - 3}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      ))}

      {/* Builder card */}
      <View style={styles.builderCard}>
        <Text style={styles.builderOverline}>Built by</Text>
        <View style={styles.builderRow}>
          <View>
            <Text style={styles.builderName}>Sigma Homes</Text>
            <Text style={styles.builderLoc}>Douglas, Cork</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.builderPhone}>021 436 5866</Text>
            <Text style={styles.builderHrs}>Mon–Fri · 8am–5pm</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingTop: 60, paddingBottom: 30 },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  overlineLine: { width: 20, height: 1.5, backgroundColor: C.g },
  overlineText: { fontSize: 9.5, fontWeight: '800', color: C.g, letterSpacing: 2.1, textTransform: 'uppercase', opacity: 0.8 },
  heading: { ...TYPE.heading, color: C.t1, marginBottom: 3 },
  subtitle: { fontSize: 12.5, color: C.t2, marginBottom: 22 },

  stageRow: { flexDirection: 'row', gap: 14 },
  spine: { alignItems: 'center', width: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, zIndex: 1 },
  dotGold: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: C.g,
    shadowColor: C.g, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 7,
  },
  dotDone: { backgroundColor: 'rgba(212,175,55,0.3)' },
  dotUpcoming: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(212,175,55,0.27)', backgroundColor: 'transparent' },
  dotEmpty: { borderWidth: 1, borderColor: C.b2, backgroundColor: 'transparent' },
  line: { width: 1.5, flex: 1, minHeight: 28, backgroundColor: C.b1 },
  lineDone: { backgroundColor: 'rgba(212,175,55,0.18)' },

  stageContent: { paddingBottom: 18, flex: 1 },
  stageDate: { fontSize: 10, color: C.t3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3, fontWeight: '700' },
  stageLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  stageLabel: { fontSize: 14.5, fontWeight: '400', color: C.t1 },
  handoverBadge: { borderWidth: 1, borderColor: C.gB, borderRadius: 5, paddingVertical: 2, paddingHorizontal: 7 },
  handoverText: { fontSize: 9.5, fontWeight: '800', color: C.g, letterSpacing: 0.75, textTransform: 'uppercase' },

  thumbRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  thumb: {
    width: 56, height: 42, borderRadius: 9, borderWidth: 1, borderColor: C.b1,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbPlaceholder: { width: '54%', height: '48%', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' },
  thumbMore: {
    width: 56, height: 42, borderRadius: 9, backgroundColor: C.s3,
    borderWidth: 1, borderColor: C.gB, alignItems: 'center', justifyContent: 'center',
  },
  thumbMoreText: { fontSize: 11, color: C.g, fontWeight: '800' },

  builderCard: {
    backgroundColor: 'rgba(212,175,55,0.06)', borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: C.gB, padding: 18, marginTop: 4,
  },
  builderOverline: { fontSize: 9.5, fontWeight: '700', color: C.t3, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 10 },
  builderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  builderName: { fontSize: 15, fontWeight: '700', color: C.t1 },
  builderLoc: { fontSize: 11.5, color: C.t2, marginTop: 2 },
  builderPhone: { fontSize: 12, color: C.g, fontWeight: '600' },
  builderHrs: { fontSize: 10.5, color: C.t3, marginTop: 2 },
});
