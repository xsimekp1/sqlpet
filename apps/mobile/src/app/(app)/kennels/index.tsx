import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../lib/api';
import type { Kennel, KennelStatus } from '../../../types/kennels';

const KENNEL_STATUS_CONFIG: Record<KennelStatus, { bg: string; text: string; label: string }> = {
  available:   { bg: '#DCFCE7', text: '#166534', label: 'Volný' },
  maintenance: { bg: '#FFEDD5', text: '#9A3412', label: 'Oprava' },
  quarantine:  { bg: '#FEE2E2', text: '#991B1B', label: 'Karanténa' },
  reserved:    { bg: '#FEF3C7', text: '#92400E', label: 'Rezervováno' },
};

const SPECIES_EMOJI: Record<string, string> = {
  dog:    '🐕',
  cat:    '🐈',
  rodent: '🐹',
  bird:   '🐦',
  other:  '🐾',
};

const ALERT_LABELS: Record<string, string> = {
  overcapacity:          '⚠️ Překročena kapacita',
  animals_in_maintenance:'⚠️ Zvířata v boxu v opravě',
  quarantine_mix:        '⚠️ Míchání karantény',
};

function KennelCard({ kennel }: { kennel: Kennel }) {
  const router = useRouter();
  const statusCfg = KENNEL_STATUS_CONFIG[kennel.status] ?? KENNEL_STATUS_CONFIG.available;
  const occupancyPct = kennel.capacity > 0 ? kennel.occupied_count / kennel.capacity : 0;
  const occupancyColor = occupancyPct >= 1 ? '#EF4444' : occupancyPct >= 0.8 ? '#F59E0B' : '#10B981';

  const previewAnimals = kennel.animals_preview.slice(0, 4);
  const extraCount = kennel.animals_preview.length - previewAnimals.length;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/kennels/${kennel.id}`)}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardCode}>{kennel.code}</Text>
          <Text style={styles.cardName} numberOfLines={1}>{kennel.name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Animals preview */}
      {previewAnimals.length > 0 ? (
        <View style={styles.animalsRow}>
          {previewAnimals.map((a) => (
            <Text key={a.id} style={styles.animalChip}>
              {SPECIES_EMOJI[a.species] ?? '🐾'} {a.name}
            </Text>
          ))}
          {extraCount > 0 && (
            <Text style={styles.animalChipExtra}>+{extraCount}</Text>
          )}
        </View>
      ) : (
        <Text style={styles.emptySlots}>Prázdný box</Text>
      )}

      {/* Capacity bar */}
      <View style={styles.capacityRow}>
        <View style={styles.capacityBarBg}>
          <View
            style={[
              styles.capacityBarFill,
              { width: `${Math.min(occupancyPct * 100, 100)}%`, backgroundColor: occupancyColor },
            ]}
          />
        </View>
        <Text style={[styles.capacityText, { color: occupancyColor }]}>
          {kennel.occupied_count}/{kennel.capacity}
        </Text>
      </View>

      {/* Alerts */}
      {kennel.alerts && kennel.alerts.length > 0 && (
        <View style={styles.alertRow}>
          <Text style={styles.alertText}>
            {kennel.alerts.map((a) => ALERT_LABELS[a] ?? `⚠️ ${a}`).join('  •  ')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function KennelsScreen() {
  const { selectedOrganizationId } = useAuthStore();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['kennels', selectedOrganizationId],
    queryFn: async () => {
      if (!selectedOrganizationId) throw new Error('No organization selected');
      return api.get<Kennel[]>('/kennels?page_size=200', {
        'x-organization-id': selectedOrganizationId,
      });
    },
    enabled: !!selectedOrganizationId,
  });

  // Group kennels by zone
  const sections = (() => {
    const kennels = data ?? [];
    const groups: Record<string, Kennel[]> = {};
    for (const k of kennels) {
      const zone = k.zone_name ?? 'Bez zóny';
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(k);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  })();

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Boxy</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B4EFF" />
          <Text style={styles.loadingText}>Načítám boxy…</Text>
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Boxy</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Nepodařilo se načíst boxy</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Zkusit znovu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Boxy</Text>
        {data && (
          <Text style={styles.headerCount}>{data.length} celkem</Text>
        )}
      </View>

      {sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏠</Text>
          <Text style={styles.emptyText}>Žádné boxy nenalezeny</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <KennelCard kennel={item} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#6B4EFF"
            />
          }
          showsVerticalScrollIndicator={false}
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
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerCount: {
    fontSize: 13,
    color: '#C4B5FD',
    fontWeight: '500',
  },
  list: {
    paddingBottom: 32,
  },
  sectionHeader: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  cardCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B4EFF',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  animalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  animalChip: {
    fontSize: 13,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  animalChipExtra: {
    fontSize: 13,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emptySlots: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  capacityBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: 6,
    borderRadius: 3,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'right',
  },
  alertRow: {
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6B4EFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
