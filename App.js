import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { StoreProvider, useStore } from './src/store';
import ErrorBoundary from './src/components/ErrorBoundary';
import { colors } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import GameScreen from './src/screens/GameScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import WinnersScreen from './src/screens/WinnersScreen';
import StandingsScreen from './src/screens/StandingsScreen';
import AdminScreen from './src/screens/AdminScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import AuditScreen from './src/screens/AuditScreen';
import EventScreen from './src/screens/EventScreen';
import LiveBoardScreen from './src/screens/LiveBoardScreen';
import { useFonts, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary } };

const headerStyle = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800' },
};

const icons = {
  Home: ['home', 'home-outline'],
  Schedule: ['calendar', 'calendar-outline'],
  Winners: ['trophy', 'trophy-outline'],
  Standings: ['podium', 'podium-outline'],
  Admin: ['settings', 'settings-outline'],
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerStyle,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={icons[route.name][focused ? 0 : 1]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'AGI Sports Fest 2026', tabBarLabel: 'Home' }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Winners" component={WinnersScreen} />
      <Tab.Screen name="Standings" component={StandingsScreen} />
      <Tab.Screen name="Admin" component={AdminScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { loaded } = useStore();
  // the live board uses the whole screen (TV / projector); everything else stays in a phone-width column on the web
  const [fullWidth, setFullWidth] = React.useState(Platform.OS === 'web' && typeof window !== 'undefined' && /^\/live\/?$/.test(window.location.pathname));
  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' && !fullWidth ? 760 : undefined, alignSelf: 'center' }}>
    <NavigationContainer theme={navTheme} onStateChange={(st) => setFullWidth(!!st && st.routes[st.index].name === 'Live')}>
      <Stack.Navigator screenOptions={headerStyle} initialRouteName={Platform.OS === 'web' && typeof window !== 'undefined' && /^\/live\/?$/.test(window.location.pathname) ? 'Live' : 'Tabs'}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Game" component={GameScreen} options={{ title: 'Game' }} />
        <Stack.Screen name="Live" component={LiveBoardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Event" component={EventScreen} options={({ route }) => ({ title: route.params.eventId === 'muse' ? 'Mr & Ms Team Ambassador' : 'Cheer Dance' })} />
        <Stack.Screen name="Accounts" component={AccountsScreen} options={{ title: 'Accounts' }} />
        <Stack.Screen name="Audit" component={AuditScreen} options={{ title: 'Audit trail' }} />
      </Stack.Navigator>
    </NavigationContainer>
    </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold });
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <StoreProvider>
          <Root />
        </StoreProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
