import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState } from 'react-native';
import * as NavigationBar from "expo-navigation-bar";

import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

import HomeScreen from './screens/HomeScreen';
import ResultsScreen from './screens/ResultsScreen';
import LibraryScreen from './screens/LibraryScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import RecordingScreen from './screens/RecordingScreen';
import DownloadsScreen from './screens/DownloadsScreen';
import SettingsScreen from './screens/SettingsScreen';
import FlashcardsScreen from './screens/FlashcardsScreen';
import QuizScreen from './screens/QuizScreen';
import AIChatScreen from './screens/AIChatScreen';
import NotesScreen from './screens/NotesScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

function Navigation() {
  const { isDark } = useTheme();

  useEffect(() => {
    // Robust configuration for true Android fullscreen
    const configureFullscreen = async () => {
      if (Platform.OS === 'android') {
        try {
          // 1. Hide the navigation bar completely
          await NavigationBar.setVisibilityAsync("hidden");

          // 2. set behavior to 'overlay-swipe'
          // This ensures that even if the user swipes it up, 
          // it overlays content (doesn't resize app) and hides again automatically.
          await NavigationBar.setBehaviorAsync("overlay-swipe");

          // 3. Make it transparent just in case it momentarily appears
          await NavigationBar.setBackgroundColorAsync("transparent");
        } catch (error) {
          console.error('Android fullscreen configuration error:', error);
        }
      }
    };

    // Apply on mount and theme change
    configureFullscreen();

    // Re-apply when the app returns from background (resume)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        configureFullscreen();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isDark]);

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Library" component={LibraryScreen} />
        <Stack.Screen name="Categories" component={CategoriesScreen} />
        <Stack.Screen name="Downloads" component={DownloadsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Recording" component={RecordingScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen name="Flashcards" component={FlashcardsScreen} />
        <Stack.Screen name="Quiz" component={QuizScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="Notes" component={NotesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <Navigation />
    </ThemeProvider>
  );
}