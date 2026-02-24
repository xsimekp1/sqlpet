import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckSquare, Package, Users, UtensilsCrossed, Hotel, ChevronRight } from 'lucide-react-native';

const MENU_ITEMS = [
  {
    label: 'Úkoly',
    description: 'Správa úkolů a připomínek',
    icon: CheckSquare,
    route: '/tasks',
    color: '#6B4EFF',
    bg: '#EDE9FE',
  },
  {
    label: 'Inventář',
    description: 'Přehled zásob a vybavení',
    icon: Package,
    route: '/inventory',
    color: '#0891B2',
    bg: '#E0F2FE',
  },
  {
    label: 'Lidi',
    description: 'Kontakty, adoptéři, dobrovolníci',
    icon: Users,
    route: '/people',
    color: '#059669',
    bg: '#DCFCE7',
  },
  {
    label: 'Krmení',
    description: 'Plány krmení zvířat',
    icon: UtensilsCrossed,
    route: '/feeding',
    color: '#D97706',
    bg: '#FEF3C7',
  },
  {
    label: 'Hotel',
    description: 'Hotelové rezervace zvířat',
    icon: Hotel,
    route: '/hotel',
    color: '#7C3AED',
    bg: '#EDE9FE',
  },
] as const;

export default function MoreScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Více</Text>
      </View>

      <View style={styles.menuList}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.route}
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => router.push(item.route)}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.bg }]}>
                <Icon size={22} color={item.color} />
              </View>
              <View style={styles.menuTextGroup}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#6B4EFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  menuList: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTextGroup: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
});
