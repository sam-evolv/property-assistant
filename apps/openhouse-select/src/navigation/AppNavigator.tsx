/**
 * Root navigator — bottom tabs (5 tabs) + AI modal stack.
 * Tab bar uses custom TabBar component with gold sliding accent.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { C } from '../tokens';
import { TabBar } from '../components/TabBar';
import { TopStatusBar } from '../components/TopStatusBar';

import HomeScreen from '../screens/HomeScreen';
import SystemsScreen from '../screens/SystemsScreen';
import StoryScreen from '../screens/StoryScreen';
import DocsScreen from '../screens/DocsScreen';
import WarrantyScreen from '../screens/WarrantyScreen';
import AIScreen from '../screens/AIScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const WELCOME_KEY = 'oh_select_welcomed';

function TabsScreen() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <View style={styles.root}>
      <Tab.Navigator
        tabBar={(props: any) => {
          const idx = props.state.index;
          if (idx !== activeTab) {
            setTimeout(() => setActiveTab(idx), 0);
          }
          return <TabBar {...props} />;
        }}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Systems" component={SystemsScreen} />
        <Tab.Screen name="Story" component={StoryScreen} />
        <Tab.Screen name="Docs" component={DocsScreen} />
        <Tab.Screen name="Warranty" component={WarrantyScreen} />
      </Tab.Navigator>

      {/* Top status bar overlay */}
      <TopStatusBar activeIndex={activeTab} />
    </View>
  );
}

export default function AppNavigator() {
  const [welcomed, setWelcomed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_KEY).then(val => {
      setWelcomed(val === 'true');
    });
  }, []);

  const handleWelcomeComplete = useCallback(async () => {
    await AsyncStorage.setItem(WELCOME_KEY, 'true');
    setWelcomed(true);
  }, []);

  if (welcomed === null) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <NavigationContainer>
      <View style={styles.root}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={TabsScreen} />
          <Stack.Screen
            name="AI"
            component={AIScreen}
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade_from_bottom',
            }}
          />
        </Stack.Navigator>

        {/* Welcome screen — shown once, covers everything */}
        {!welcomed && <WelcomeScreen onEnter={handleWelcomeComplete} />}
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
});
