import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { COLORS } from './constants/theme';

import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LibraryScreen from './screens/LibraryScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import DownloadsScreen from './screens/DownloadsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { StatusBar } from 'expo-status-bar';

const Tab = createBottomTabNavigator();

function MainNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Search') {
                iconName = focused ? 'search' : 'search-outline';
              } else if (route.name === 'Library') {
                iconName = focused ? 'library' : 'library-outline';
              } else if (route.name === 'Categories') {
                iconName = focused ? 'list' : 'list-outline';
              } else if (route.name === 'Favorites') {
                iconName = focused ? 'heart' : 'heart-outline';
              } else if (route.name === 'Downloads') {
                iconName = focused ? 'download' : 'download-outline';
              } else if (route.name === 'Settings') {
                iconName = focused ? 'settings' : 'settings-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: isDark ? '#666' : '#999',
            tabBarStyle: {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              paddingBottom: 5,
              paddingTop: 5,
            },
            headerShown: false,
          })}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarLabel: 'Home',
            }}
          />
          <Tab.Screen
            name="Search"
            component={SearchScreen}
            options={{
              tabBarLabel: 'Search',
            }}
          />
          <Tab.Screen
            name="Library"
            component={LibraryScreen}
            options={{
              tabBarLabel: 'Library',
            }}
          />
          <Tab.Screen
            name="Categories"
            component={CategoriesScreen}
            options={{
              tabBarLabel: 'Categories',
            }}
          />
          <Tab.Screen
            name="Favorites"
            component={FavoritesScreen}
            options={{
              tabBarLabel: 'Favorites',
            }}
          />
          <Tab.Screen
            name="Downloads"
            component={DownloadsScreen}
            options={{
              tabBarLabel: 'Downloads',
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarLabel: 'Settings',
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainNavigator />
    </ThemeProvider>
  );
}