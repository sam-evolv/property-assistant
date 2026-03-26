/**
 * Warranty screen — Summary stats, warranty list, aftercare card.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, IC, TYPE, RADIUS } from '../tokens';
import { Icon } from '../components/Icon';

const WARRANTIES = [
  ['HomeBond structural', 'HomeBond', '2034'],
  ['Flat roofing', 'Sika Liquid Plastics', '2044'],
  ['Heating & plumbing', 'Cronin Plumbing', '2026'],
  ['Kitchen appliances', 'Neff / Sigma Homes', '2027'],
  ['Windows & doors', 'Munster Joinery', '2029'],
  ['Solar PV system', 'SE Systems', '2034'],
  ['Heat pump', 'Mitsubishi', '2034'],
] as const;

function Card({ children, gold = false, style = {} }: { children: React.ReactNode; gold?: boolean; style?: any }) {
  return (
    <View style={[{
      backgroundColor: gold ? 'rgba(212,175,55,0.06)' : C.s2,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: gold ? C.gB : C.b1,
      overflow: 'hidden',
    }, style]}>
      {children}
    </View>
  );
}

export default function WarrantyScreen() {
  const STATS: [string, string, string, boolean][] = [
    ['10yr', 'HomeBond', C.g, true],
    ['20yr', 'Roofing', C.grn, false],
    ['7', 'Active', C.blu, false],
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.overlineRow}>
        <View style={styles.overlineLine} />
        <Text style={styles.overlineText}>Your Home</Text>
      </View>
      <Text style={styles.heading}>Warranty</Text>
      <Text style={styles.subtitle}>7 active warranties · All current</Text>

      {/* Summary stats */}
      <View style={styles.statsGrid}>
        {STATS.map(([v, l, c, gold], i) => (
          <Card key={i} gold={gold} style={styles.statCard}>
            <Text style={[styles.statValue, { color: c }]}>{v}</Text>
            <Text style={styles.statLabel}>{l}</Text>
          </Card>
        ))}
      </View>

      {/* Warranty list */}
      {WARRANTIES.map(([name, by, yr], i) => (
        <View key={i} style={styles.warrantyRow}>
          <View style={styles.checkIcon}>
            <Icon d={IC.check} size={14} color={C.grn} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.warrantyName}>{name}</Text>
            <Text style={styles.warrantyProvider}>{by}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.warrantyActive}>Active</Text>
            <Text style={styles.warrantyUntil}>Until {yr}</Text>
          </View>
        </View>
      ))}

      {/* Aftercare card */}
      <Card gold style={{ padding: 18, marginTop: 4 }}>
        <Text style={styles.aftercareOverline}>Aftercare contact</Text>
        <View style={styles.aftercareRow}>
          <View>
            <Text style={styles.aftercareName}>Sigma Homes</Text>
            <Text style={styles.aftercareHrs}>Mon–Fri · 8am–5pm</Text>
          </View>
          <View style={styles.phonePill}>
            <Icon d={IC.phone} size={13} color={C.g} />
            <Text style={styles.phoneText}>021 436 5866</Text>
          </View>
        </View>
      </Card>
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
  subtitle: { fontSize: 12.5, color: C.t2, marginBottom: 20 },

  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, paddingVertical: 13, paddingHorizontal: 10, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { fontSize: 9.5, color: C.t3, marginTop: 5, letterSpacing: 0.6, textTransform: 'uppercase' },

  warrantyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 13, backgroundColor: C.s2, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.b1, marginBottom: 7, gap: 10,
  },
  checkIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(45,200,122,0.08)', borderWidth: 1, borderColor: 'rgba(45,200,122,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  warrantyName: { fontSize: 13, color: C.t1, fontWeight: '500' },
  warrantyProvider: { fontSize: 10.5, color: C.t3, marginTop: 1 },
  warrantyActive: { fontSize: 11, color: C.grn, fontWeight: '700' },
  warrantyUntil: { fontSize: 10, color: C.t3, marginTop: 2 },

  aftercareOverline: { fontSize: 9.5, fontWeight: '700', color: C.t3, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 10 },
  aftercareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aftercareName: { fontSize: 15, fontWeight: '700', color: C.t1 },
  aftercareHrs: { fontSize: 11.5, color: C.t2, marginTop: 2 },
  phonePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: C.gB,
    borderRadius: 11, paddingVertical: 7, paddingHorizontal: 11,
  },
  phoneText: { fontSize: 12.5, color: C.g, fontWeight: '600' },
});
