/**
 * Custom bottom tab bar — gold sliding accent bar, 8.5px uppercase labels.
 * Matches prototype exactly: no generic UI, hand-built from StyleSheet.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, TAB_H, IC } from '../tokens';
import { Icon } from './Icon';

const TAB_ICONS: Record<string, readonly string[]> = {
  Home:     IC.home,
  Systems:  IC.solar,
  Story:    IC.story,
  Docs:     IC.docs,
  Warranty: IC.shield,
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;
  const screenWidth = Dimensions.get('window').width;
  const tabWidth = screenWidth / tabCount;

  // Animated sliding gold accent bar
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: state.index * tabWidth,
      duration: 380,
      useNativeDriver: true,
      // Approximate cubic-bezier(0.16,1,0.3,1) with native driver
    }).start();
  }, [state.index, tabWidth]);

  return (
    <View
      style={[
        styles.container,
        { height: TAB_H + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {/* Gold sliding accent bar */}
      <Animated.View
        style={[
          styles.accentBar,
          {
            width: tabWidth,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.tab}
          >
            <Icon
              d={TAB_ICONS[route.name] || IC.home}
              size={20}
              color={isFocused ? C.g : C.t3}
              strokeWidth={isFocused ? 2 : 1.55}
            />
            <Text
              style={[
                styles.label,
                { color: isFocused ? C.g : C.t3, fontWeight: isFocused ? '800' : '500' },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 9,
    backgroundColor: 'rgba(4,4,10,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.045)',
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    height: 1.5,
    backgroundColor: C.g,
    // Gold glow via shadow
    shadowColor: C.g,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  label: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
  },
});
