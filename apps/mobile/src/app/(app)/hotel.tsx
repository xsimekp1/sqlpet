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
import { Hotel, UtensilsCrossed } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import type { HotelReservation } from '../../types/hotel';

type Filter = 'active' | 'all' | 'archive';

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: 'active',  label: 'Aktivní' },
  { value: 'all',     label: 'Vše' },
  { value: 'archive', label: 'Archiv' },
];

const ACTIVE_STATUSES = ['pending', 'confirmed', 'checked_in'];
const ARCHIVE_STATUSES = ['checked_out', 'cancelled'];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:    { label: 'Čeká',       bg: '#FEF9C3', text: '#CA8A04' },
  confirmed:  { label: 'Potvrzeno',  bg: '#DBEAFE', text: '#1D4ED8' },
  checked_in: { label: 'Nastoupila', bg: '#DCFCE7', text: '#15803D' },
  checked_out:{ label: 'Odjela',     bg: '#F3F4F6', text: '#374151' },
  cancelled:  { label: 'Zrušeno',    bg: '#FEE2E2', text: '#B91C1C' },
};

const SPECIES_EMOJI: Record<string, string> = {
  dog:    '🐕',
  cat:    '🐈',
  rodent: '🐹',
  bird:   '🐦',
  other:  '🐾',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function ReservationCard({
  item,
  onCheckin,
  onCheckout,
  onCancel,
}: {
  item: HotelReservation;
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
  onCancel: (id: string, name: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[item.status] ?? { label: item.status, bg: '#F3F4F6', text: '#374151' };
  const emoji = SPECIES_EMOJI[item.animal_species] ?? '🐾';
  const dateRange = `${formatDate(item.reserved_from)} → ${formatDate(item.reserved_to)}`;
  const priceLabel = item.total_price != null ? `${item.total_price} Kč` : null;

  const showCheckin  = item.status === 'pending' || item.status === 'confirmed';
  const showCheckout = item.status === 'checked_in';
  const showCancel   = item.status === 'pending' || item.status === 'confirmed';

  return (
    <View style={styles.card}>
      {/* Main row */}
      <View style={styles.cardRow}>
        {/* Left: species + animal */}
        <View style={styles.cardLeft}>
          <Text style={styles.speciesEmoji}>{emoji}</Text>
          <Text style={styles.animalName} numberOfLines={1}>{item.animal_name}</Text>
          {item.animal_breed ? (
            <Text style={styles.breedText} numberOfLines={1}>{item.animal_breed}</Text>
          ) : null}
        </View>

        {/* Center: dates + kennel + price + own food */}
        <View style={styles.cardCenter}>
          <Text style={styles.dateRange}>{dateRange}</Text>
          {item.kennel_name ? (
            <View style={styles.kennelBadge}>
              <Text style={styles.kennelBadgeText}>{item.kennel_name}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            {priceLabel ? <Text style={styles.priceText}>{priceLabel}</Text> : null}
            {item.own_food ? (
              <View style={styles.ownFoodBadge}>
                <UtensilsCrossed size={11} color="#D97706" />
                <Text style={styles.ownFoodText}>vlastní</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Right: status badge */}
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusCfg.text }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Action row */}
      {(showCheckin || showCheckout || showCancel) ? (
        <View style={styles.actionRow}>
          {showCheckin ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnCheckin]}
              onPress={() => onCheckin(item.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Check-in</Text>
            </TouchableOpacity>
          ) : null}
          {showCheckout ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnCheckout]}
              onPress={() => onCheckout(item.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Check-out</Text>
            </TouchableOpacity>
          ) : null}
          {showCancel ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnCancel]}
              onPress={() => onCancel(item.id, item.animal_name)}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnCancelText]}>✕ Zrušit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function HotelScreen() {
  const [filter, setFilter] = useState<Filter>('active');
  const { selectedOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<HotelReservation[]>({
    queryKey: ['hotel-reservations', selectedOrganizationId],
    queryFn: () =>
      api.get<HotelReservation[]>('/hotel/reservations', {
        'x-organization-id': selectedOrganizationId!,
      }),
    enabled: !!selectedOrganizationId,
  });

  const all = data ?? [];
  const filtered =
    filter === 'all'
      ? all
      : filter === 'active'
      ? all.filter((r) => ACTIVE_STATUSES.includes(r.status))
      : all.filter((r) => ARCHIVE_STATUSES.includes(r.status));

  const activeCount = all.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['hotel-reservations'] });

  const handleCheckin = async (id: string) => {
    try {
      await api.post(`/hotel/reservations/${id}/checkin`, undefined, {
        'x-organization-id': selectedOrganizationId!,
      });
      invalidate();
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se provést check-in.');
    }
  };

  const handleCheckout = async (id: string) => {
    try {
      await api.post(`/hotel/reservations/${id}/checkout`, undefined, {
        'x-organization-id': selectedOrganizationId!,
      });
      invalidate();
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se provést check-out.');
    }
  };

  const handleCancel = (id: string, animalName: string) => {
    Alert.alert(
      'Zrušit rezervaci',
      `Opravdu chcete zrušit rezervaci pro ${animalName}?`,
      [
        { text: 'Zpět', style: 'cancel' },
        {
          text: 'Zrušit rezervaci',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/hotel/reservations/${id}`, {
                'x-organization-id': selectedOrganizationId!,
              });
            } catch (err) {
              // 204 No Content causes JSON parse to throw — still a success
              if (err instanceof Error && err.message.startsWith('Request failed')) {
                Alert.alert('Chyba', 'Nepodařilo se zrušit rezervaci.');
                return;
              }
            }
            invalidate();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Hotel</Text>
          {activeCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </View>

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
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReservationCard
              item={item}
              onCheckin={handleCheckin}
              onCheckout={handleCheckout}
              onCancel={handleCancel}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6B4EFF" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Hotel size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {filter === 'active'
                  ? 'Žádné aktivní rezervace'
                  : filter === 'archive'
                  ? 'Žádné archivované rezervace'
                  : 'Žádné rezervace'}
              </Text>
            </View>
          }
        />
      )}
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    alignItems: 'center',
    width: 56,
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
  breedText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 1,
  },
  cardCenter: {
    flex: 1,
  },
  dateRange: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  kennelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  kennelBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B4EFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  ownFoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ownFoodText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  cardRight: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnCheckin: {
    backgroundColor: '#DCFCE7',
  },
  actionBtnCheckout: {
    backgroundColor: '#DBEAFE',
  },
  actionBtnCancel: {
    backgroundColor: '#FEE2E2',
    flex: 0,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  actionBtnCancelText: {
    color: '#B91C1C',
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
});
