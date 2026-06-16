import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { FinancialProvider } from './src/context/FinancialContext';
import DashboardScreen from './src/screens/DashboardScreen';
import ComplianceScreen from './src/screens/ComplianceScreen';
import LedgerScreen from './src/screens/LedgerScreen';
import CurrencyConverterHeader from './src/components/CurrencyConverterHeader';
import TenantSelector from './src/components/TenantSelector';

const Tab = createBottomTabNavigator();

const COLORS = {
  navy: '#0B1437',
  navyLight: '#111D4A',
  slate: '#1E2D5A',
  border: '#1E3060',
  emerald: '#10B981',
  amber: '#F59E0B',
  crimson: '#EF4444',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  tabActive: '#3B82F6',
};

function TabBarIcon({ name, color, size }) {
  return <Feather name={name} size={size} color={color} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FinancialProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor={COLORS.navy} />
          <View style={styles.root}>
            <TenantSelector />
            <CurrencyConverterHeader />
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: COLORS.tabActive,
                tabBarInactiveTintColor: COLORS.textSecondary,
                tabBarLabelStyle: styles.tabLabel,
                tabBarIcon: ({ color, size }) => {
                  const icons = {
                    Dashboard: 'grid',
                    Compliance: 'shield',
                    Ledger: 'list',
                  };
                  return <TabBarIcon name={icons[route.name]} color={color} size={size - 2} />;
                },
              })}
            >
              <Tab.Screen name="Dashboard" component={DashboardScreen} />
              <Tab.Screen name="Compliance" component={ComplianceScreen} />
              <Tab.Screen name="Ledger" component={LedgerScreen} />
            </Tab.Navigator>
          </View>
        </NavigationContainer>
      </FinancialProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1437',
  },
  tabBar: {
    backgroundColor: '#0B1437',
    borderTopColor: '#1E3060',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
