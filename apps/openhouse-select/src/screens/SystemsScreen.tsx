/**
 * Systems screen — Arc rings, 3 system cards with live stats.
 * Placeholder with full layout matching prototype.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { C, IC, TYPE, RADIUS } from '../tokens';
import { Icon } from '../components/Icon';

function ArcRing({ pct, color, size = 76, value, unit, label }: {
  pct: number; color: string; size?: number; value: string; unit: string; label: string;
}) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      <View style={{ width: size, height: size, position: 'relative' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <SvgCircle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
          <SvgCircle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 15, fontWeight: '800', color, letterSpacing: -0.3, lineHeight: 15 }}>{value}</Text>
          <Text style={{ fontSize: 9, color: C.t2, marginTop: 1 }}>{unit}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 9.5, color: C.t2, letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

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

export default function SystemsScreen() {
  const rows = [
    { icon: IC.solar, name: 'Solar PV', sub: 'SE Systems · 6.2 kWp', val: '3.1', unit: 'kW', label: 'generating now', col: C.amb, stats: [['4.2 kWh','today'],['112 kWh','month'],['68%','self-use']] },
    { icon: IC.heat, name: 'Heat Pump', sub: 'Mitsubishi Ecodan 8.5kW', val: '42', unit: '°C', label: 'flow temp', col: C.blu, stats: [['3.8','COP today'],['Heating','mode'],['55°C','DHW']] },
    { icon: IC.ev, name: 'EV Charger', sub: 'Hypervolt · 7.4 kW', val: '—', unit: '', label: 'standby', col: C.pur, stats: [['On','smart charge'],['Solar','priority'],['Off-peak','schedule']] },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Section header */}
      <View style={styles.overlineRow}>
        <View style={styles.overlineLine} />
        <Text style={styles.overlineText}>Your Home</Text>
      </View>
      <Text style={styles.heading}>Systems</Text>
      <Text style={styles.subtitle}>Live status · All normal</Text>

      {/* Arc rings summary */}
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          <ArcRing pct={68} color={C.amb} value="3.1" unit="kW" label="Solar" />
          <View style={{ width: 1, height: 64, backgroundColor: C.b1 }} />
          <ArcRing pct={82} color={C.blu} value="42" unit="°C" label="Heat pump" />
          <View style={{ width: 1, height: 64, backgroundColor: C.b1 }} />
          <ArcRing pct={100} color={C.pur} value="—" unit="" label="EV charger" />
        </View>
        <View style={styles.nominalRow}>
          <View style={[styles.statusDot, { backgroundColor: C.grn, shadowColor: C.grn }]} />
          <Text style={styles.nominalText}>All systems nominal · Updated just now</Text>
        </View>
      </Card>

      {/* System cards */}
      {rows.map((s, i) => (
        <Card key={i} style={{ marginBottom: 10 }}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: `${s.col}14`, borderColor: `${s.col}22` }]}>
              <Icon d={s.icon} size={18} color={s.col} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.t1 }}>{s.name}</Text>
              <Text style={{ fontSize: 11, color: C.t2, marginTop: 1 }}>{s.sub}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 21, fontWeight: '800', color: s.col, letterSpacing: -0.4, lineHeight: 21 }}>
                {s.val}<Text style={{ fontSize: 11 }}>{s.unit}</Text>
              </Text>
              <Text style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{s.label}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {s.stats.map(([v, l], j) => (
              <View key={j} style={[styles.statCell, j < 2 && { borderRightWidth: 1, borderRightColor: C.b1 }]}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: C.t1 }}>{v}</Text>
                <Text style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{l}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 18, paddingTop: 60 },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  overlineLine: { width: 20, height: 1.5, backgroundColor: C.g },
  overlineText: { fontSize: 9.5, fontWeight: '800', color: C.g, letterSpacing: 2.1, textTransform: 'uppercase', opacity: 0.8 },
  heading: { ...TYPE.heading, color: C.t1, marginBottom: 3 },
  subtitle: { fontSize: 12.5, color: C.t2, marginBottom: 20 },
  nominalRow: {
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.b1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4 },
  nominalText: { fontSize: 11, color: C.t2 },
  cardHeader: {
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.b1,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  statCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 13 },
});
