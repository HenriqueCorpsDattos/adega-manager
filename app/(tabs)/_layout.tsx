import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, GOLD } from '../../src/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(outline: IconName, filled: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={24} color={color} />
  );
}

export default function TabLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: t.sub,
        tabBarStyle: {
          backgroundColor: t.tabBar,
          borderTopColor: t.tabBorder,
        },
        headerStyle: { backgroundColor: t.headerBg },
        headerTintColor: t.headerText,
        headerTitleStyle: { fontWeight: 'bold', color: GOLD },
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
      <Tabs.Screen
        name="relatorio"
        options={{
          title: 'Relatório',
          tabBarIcon: icon('receipt-outline', 'receipt'),
        }}
      />
    </Tabs>
  );
}
