import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import OfflineDialog from './components/OfflineDialog';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, View, ActivityIndicator } from 'react-native';
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

// Screen Imports
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
import AuthScreen from './screens/AuthScreen';
import AccessDeniedScreen from './screens/AccessDeniedScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

/**
 * Loading component for auth transitions
 */
const LoadingScreen = () => (
  <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#18181B" />
  </View>
);

function Navigation() {
  const { isDark } = useTheme();
  const { user, loading, isWhitelisted } = useAuth();

  useEffect(() => {
    const configureFullscreen = async () => {
      if (Platform.OS === 'android') {
        try {
          await NavigationBar.setVisibilityAsync("hidden");
          await NavigationBar.setBehaviorAsync("overlay-swipe");
          await NavigationBar.setBackgroundColorAsync("transparent");
        } catch (error) {
          console.error('Android fullscreen configuration error:', error);
        }
      }
    };

    configureFullscreen();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        configureFullscreen();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isDark]);

  // Auth Guard Logic
  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // 1. Auth Flow
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !isWhitelisted ? (
          // 2. Access Restricted Flow
          <Stack.Screen name="AccessDenied" component={AccessDeniedScreen} />
        ) : (
          // 3. Authenticated & Whitelisted App Flow
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Library" component={LibraryScreen} />
            <Stack.Screen name="Categories" component={CategoriesScreen} />
            <Stack.Screen name="Downloads" component={DownloadsScreen} />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                animation: 'fade',
                presentation: 'transparentModal'
              }}
            />
            <Stack.Screen name="Recording" component={RecordingScreen} />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen name="Flashcards" component={FlashcardsScreen} />
            <Stack.Screen name="Quiz" component={QuizScreen} />
            <Stack.Screen name="AIChat" component={AIChatScreen} />
            <Stack.Screen name="Notes" component={NotesScreen} />
          </>
        )}
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
    <AuthProvider>
      <ThemeProvider>
        <NetworkProvider>
          <StatusBarWrapper />
          <Navigation />
          <OfflineDialog />
        </NetworkProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

const StatusBarWrapper = () => {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
};
