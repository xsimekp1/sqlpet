import { Tabs } from 'expo-router';
import { Home, PawPrint, Building2, Pill, Grid } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6B4EFF',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          height: 56 + (insets.bottom > 0 ? insets.bottom : 8),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          headerShown: false,
          tabBarLabel: 'Domů',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="animals"
        options={{
          headerShown: false,
          tabBarLabel: 'Zvířata',
          tabBarIcon: ({ color, size }) => <PawPrint size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kennels"
        options={{
          headerShown: false,
          tabBarLabel: 'Boxy',
          tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="medical"
        options={{
          headerShown: false,
          tabBarLabel: 'Dnes',
          tabBarIcon: ({ color, size }) => <Pill size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          headerShown: false,
          tabBarLabel: 'Více',
          tabBarIcon: ({ color, size }) => <Grid size={size} color={color} />,
        }}
      />
      {/* Hidden screens - accessible via router but not shown in tab bar */}
      <Tabs.Screen name="tasks"     options={{ href: null }} />
      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen name="people"    options={{ href: null }} />
      <Tabs.Screen name="feeding"   options={{ href: null }} />
    </Tabs>
  );
}
