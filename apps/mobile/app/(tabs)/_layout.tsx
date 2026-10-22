import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, PawPrint, DollarSign, HandCoins, Menu } from 'lucide-react-native';
import { AppHeader } from '@/src/components/shell/AppHeader';
import { colors, fonts } from '@/src/theme';

// Same bottom bar as the web app on phones: Home, Animals, Sales, Dues, More.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        header: () => <AppHeader />,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.slate500,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { height: 66 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6, borderTopColor: colors.line, backgroundColor: 'rgba(255,255,255,0.97)' },
        tabBarItemStyle: { height: 54 },
        tabBarIconStyle: { marginBottom: 2 },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Home color={color} size={20} /> }} />
      <Tabs.Screen name="cows" options={{ title: 'Animals', tabBarIcon: ({ color }) => <PawPrint color={color} size={20} /> }} />
      <Tabs.Screen name="sales" options={{ title: 'Sales', tabBarIcon: ({ color }) => <DollarSign color={color} size={20} /> }} />
      <Tabs.Screen name="dues" options={{ title: 'Dues', tabBarIcon: ({ color }) => <HandCoins color={color} size={20} /> }} />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', headerShown: false, tabBarIcon: ({ color }) => <Menu color={color} size={20} /> }}
        listeners={({ navigation }) => ({
          // Tapping More always shows the menu, not the last screen opened from it.
          tabPress: () => navigation.navigate('more', { screen: 'index' }),
        })}
      />
    </Tabs>
  );
}
