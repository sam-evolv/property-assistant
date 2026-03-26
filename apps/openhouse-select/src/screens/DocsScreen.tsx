/**
 * Docs screen — Categorised document list with download icons.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { C, IC, TYPE, RADIUS } from '../tokens';
import { Icon } from '../components/Icon';

const CATEGORIES = [
  { label: 'Energy', col: C.amb, docs: ['BER Certificate — A2', 'Air Tightness Test', 'Heat Pump Commissioning Report'] },
  { label: 'Compliance', col: C.blu, docs: ['BCAR Certificate of Compliance', 'Planning Permission', "Structural Engineer's Report"] },
  { label: 'Warranty & Legal', col: C.grn, docs: ['HomeBond Structural Warranty', 'Kitchen Appliance Warranties', 'Window & Door Warranty'] },
  { label: 'Electrical', col: C.pur, docs: ['Electrical Completion Certificate'] },
];

export default function DocsScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.overlineRow}>
        <View style={styles.overlineLine} />
        <Text style={styles.overlineText}>Your Home</Text>
      </View>
      <Text style={styles.heading}>Documents</Text>
      <Text style={styles.subtitle}>10 certificates · All current</Text>

      {CATEGORIES.map((cat, ci) => (
        <View key={ci} style={{ marginBottom: 20 }}>
          {/* Category header */}
          <View style={styles.catHeader}>
            <View style={[styles.catDot, { backgroundColor: cat.col, shadowColor: cat.col }]} />
            <Text style={styles.catLabel}>{cat.label}</Text>
            <View style={styles.catLine} />
          </View>

          {/* Document rows */}
          {cat.docs.map((doc, di) => (
            <TouchableOpacity key={di} style={styles.docRow} activeOpacity={0.7}>
              <View style={[styles.docIcon, { backgroundColor: `${cat.col}10`, borderColor: `${cat.col}20` }]}>
                <Icon d={IC.docs} size={14} color={cat.col} />
              </View>
              <Text style={styles.docName}>{doc}</Text>
              <Icon d={IC.dl} size={14} color={C.t3} />
            </TouchableOpacity>
          ))}
        </View>
      ))}
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
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catDot: { width: 5, height: 5, borderRadius: 2.5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4 },
  catLabel: { fontSize: 10.5, fontWeight: '700', color: C.t3, letterSpacing: 1.2, textTransform: 'uppercase' },
  catLine: { flex: 1, height: 1, backgroundColor: C.b1 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 13, backgroundColor: C.s2,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.b1, marginBottom: 6, gap: 10,
  },
  docIcon: {
    width: 32, height: 32, borderRadius: 9, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  docName: { flex: 1, fontSize: 12.5, color: C.t1, fontWeight: '500' },
});
