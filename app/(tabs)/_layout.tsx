import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const WINE = '#722F37';
const GRAY = '#8E8E93';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(outline: IconName, filled: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={24} color={color} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: WINE,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
        },
        headerStyle: { backgroundColor: WINE },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Produtos',
          tabBarIcon: icon('wine-outline', 'wine'),
        }}
      />
      <Tabs.Screen
        name="estoque"
        options={{
          title: 'Estoque',
          tabBarIcon: icon('bar-chart-outline', 'bar-chart'),
        }}
      />
      <Tabs.Screen
        name="lista"
        options={{
          title: 'Lista',
          tabBarIcon: icon('list-outline', 'list'),
        }}
      />
      <Tabs.Screen
        name="entrada"
        options={{
          title: 'Entrada',
          tabBarIcon: icon('arrow-down-circle-outline', 'arrow-down-circle'),
        }}
      />
      <Tabs.Screen
        name="baixa"
        options={{
          title: 'Baixa',
          tabBarIcon: icon('arrow-up-circle-outline', 'arrow-up-circle'),
        }}
      />
    </Tabs>
  );
}
