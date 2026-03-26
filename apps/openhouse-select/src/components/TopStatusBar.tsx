/**
 * Top status bar overlay — OpenHouse Select wordmark + page dot indicators.
 * Positioned absolutely over content, pointer-events passthrough.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, TABS } from '../tokens';

interface TopStatusBarProps {
  activeIndex: number;
}

export function TopStatusBar({ activeIndex }: TopStatusBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 13 }]} pointerEvents="none">
      <Text style={styles.wordmark}>OpenHouse Select</Text>
      <View style={styles.dots}>
        {TABS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 9,
    fontWeight: '800',
    color: C.g,
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 5,
    width: 5,
    borderRadius: 3,
    backgroundColor: C.b2,
  },
  dotActive: {
    width: 22,
    backgroundColor: C.g,
    // Gold glow
    shadowColor: C.g,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
  },
});
