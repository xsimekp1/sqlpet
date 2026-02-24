import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UtensilsCrossed, Clock } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import type { FeedingPlan } from '../../types/feeding';

type Filter = 'active' | 'inactive' | 'all';

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: 'active',   label: 'Aktivní' },
  { value: 'inactive', label: 'Neaktivní' },
  { value: 'all',      label: 'Vše' },
];

const SPECIES_EMOJI: Record<string, string> = {
  dog:    '🐕',
  cat:    '🐈',
  rodent: '🐹',
  bird:   '🐦',
  other:  '🐾',
};

function PlanCard({
  item,
  onDeactivate,
}: {
  item: FeedingPlan;
  onDeactivate: (id: string) => void;
}) {
  const speciesEmoji = SPECIES_EMOJI[item.animal?.species ?? ''] ?? '🐾';
  const animalName = item.animal?.name ?? '—';
  const publicCode = item.animal?.public_code ? `#${item.animal.public_code}` : '';
  const foodName = item.food?.name ?? '—';
  const foodBrand = item.food?.brand ? ` · ${item.food.brand}` : '';
  const amountLabel = item.amount_g
    ? `${item.amount_g} g`
    : item.amount_text ?? '—';
  const timesLabel = item.times_per_day
    ? `${item.times_per_day}× denně`
    : null;

  const handleLongPress = () => {
    if (!item.is_active) return;
    Alert.alert(
      'Deaktivovat plán',
      `Opravdu chcete deaktivovat plán krmení pro ${animalName}?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Deaktivovat',
          style: 'destructive',
          onPress: () => onDeactivate(item.id),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onLongPress={handleLongPress}
    >
      {/* Left: species + animal */}
      <View style={styles.cardLeft}>
        <Text style={styles.speciesEmoji}>{speciesEmoji}</Text>
        <Text style={styles.animalName}>{animalName}</Text>
        {publicCode ? <Text style={styles.publicCode}>{publicCode}</Text> : null}
      </View>

      {/* Center: food info + schedule */}
      <View style={styles.cardCenter}>
        <Text style={styles.foodName} numberOfLines={1}>
          {foodName}{foodBrand}
        </Text>
        <Text style={styles.amountText}>{amountLabel}</Text>
        {item.schedule_json && item.schedule_json.length > 0 ? (
          <View style={styles.scheduleRow}>
            {item.schedule_json.slice(0, 4).map((time) => (
              <View key={time} style={styles.timeBadge}>
                <Clock size={10} color="#6B4EFF" />
                <Text style={styles.timeText}>{time}</Text>
              </View>
            ))}
            {item.schedule_json.length > 4 ? (
              <Text style={styles.moreTimesText}>+{item.schedule_json.length - 4}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Right: status + times/day */}
      <View style={styles.cardRight}>
        <View style={[styles.statusDot, item.is_active ? styles.statusDotActive : styles.statusDotInactive]} />
        {timesLabel ? <Text style={styles.timesLabel}>{timesLabel}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function FeedingPlansScreen() {
  const [filter, setFilter] = useState<Filter>('active');
  const { selectedOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();

  const queryParams = filter === 'all' ? '' : `?is_active=${filter === 'active'}`;

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ items: FeedingPlan[]; total: number }>({
    queryKey: ['feeding-plans', selectedOrganizationId, filter],
    queryFn: () =>
      api.get(`/feeding/plans${queryParams}`, {
        'x-organization-id': selectedOrganizationId!,
      }),
    enabled: !!selectedOrganizationId,
  });

  const plans = data?.items ?? [];
  const activePlansCount = plans.filter((p) => p.is_active).length;

  const handleDeactivate = async (id: string) => {
    try {
      await api.delete(`/feeding/plans/${id}`, {
        'x-organization-id': selectedOrganizationId!,
      });
      queryClient.invalidateQueries({ queryKey: ['feeding-plans'] });
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se deaktivovat plán krmení.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Plány krmení</Text>
          {filter === 'active' && activePlansCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activePlansCount}</Text>
            </View>
          ) : null}
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterPill, filter === opt.value && styles.filterPillActive]}
              onPress={() => setFilter(opt.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, filter === opt.value && styles.filterPillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B4EFF" />
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PlanCard item={item} onDeactivate={handleDeactivate} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6B4EFF" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <UtensilsCrossed size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {filter === 'active' ? 'Žádné aktivní plány krmení' : 'Žádné plány krmení'}
              </Text>
            </View>
          }
        />
      )}

      {plans.length > 0 ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Přidržením karty plán deaktivujete</Text>
        </View>
      ) : null}
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
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  filterPillTextActive: {
    color: '#6B4EFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLeft: {
    alignItems: 'center',
    width: 52,
    marginRight: 12,
  },
  speciesEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  animalName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  publicCode: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  cardCenter: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  amountText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B4EFF',
  },
  moreTimesText: {
    fontSize: 11,
    color: '#9CA3AF',
    alignSelf: 'center',
  },
  cardRight: {
    alignItems: 'center',
    marginLeft: 12,
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotActive: {
    backgroundColor: '#22C55E',
  },
  statusDotInactive: {
    backgroundColor: '#D1D5DB',
  },
  timesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  hint: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F8F9FA',
  },
  hintText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
