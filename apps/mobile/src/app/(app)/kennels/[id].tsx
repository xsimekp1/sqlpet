import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
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
  overcapacity:           '⚠️ Překročena kapacita',
  animals_in_maintenance: '⚠️ Zvířata v boxu v opravě',
  quarantine_mix:         '⚠️ Míchání karantény',
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export default function KennelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { selectedOrganizationId } = useAuthStore();

  const { data: kennel, isLoading, isError, refetch } = useQuery({
    queryKey: ['kennel', id, selectedOrganizationId],
    queryFn: async () => {
      if (!selectedOrganizationId || !id) throw new Error('Missing params');
      // Try direct endpoint first, fall back to list filter
      return api.get<Kennel>(`/kennels/${id}`, {
        'x-organization-id': selectedOrganizationId,
      });
    },
    enabled: !!selectedOrganizationId && !!id,
  });

  const NavBar = () => (
    <View style={styles.navBar}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ChevronLeft size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.navTitle} numberOfLines={1}>
        {kennel ? `${kennel.code} — ${kennel.name}` : 'Detail boxu'}
      </Text>
      <View style={styles.navSpacer} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerArea}>
          <NavBar />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B4EFF" />
          <Text style={styles.loadingText}>Načítám box…</Text>
        </View>
      </View>
    );
  }

  if (isError || !kennel) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerArea}>
          <NavBar />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Nepodařilo se načíst box</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Zkusit znovu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusCfg = KENNEL_STATUS_CONFIG[kennel.status] ?? KENNEL_STATUS_CONFIG.available;
  const occupancyPct = kennel.capacity > 0 ? kennel.occupied_count / kennel.capacity : 0;
  const occupancyColor = occupancyPct >= 1 ? '#EF4444' : occupancyPct >= 0.8 ? '#F59E0B' : '#10B981';

  return (
    <View style={styles.screen}>
      <View style={styles.headerArea}>
        <NavBar />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status + capacity hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroCode}>{kennel.code}</Text>
              <Text style={styles.heroName}>{kennel.name}</Text>
              {kennel.zone_name && (
                <Text style={styles.heroZone}>📍 {kennel.zone_name}</Text>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
            </View>
          </View>

          {/* Capacity bar */}
          <View style={styles.capacitySection}>
            <View style={styles.capacityHeader}>
              <Text style={styles.capacityLabel}>Obsazenost</Text>
              <Text style={[styles.capacityCount, { color: occupancyColor }]}>
                {kennel.occupied_count} / {kennel.capacity}
              </Text>
            </View>
            <View style={styles.capacityBarBg}>
              <View
                style={[
                  styles.capacityBarFill,
                  { width: `${Math.min(occupancyPct * 100, 100)}%`, backgroundColor: occupancyColor },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Alerts */}
        {kennel.alerts && kennel.alerts.length > 0 && (
          <View style={styles.alertsContainer}>
            {kennel.alerts.map((alert, i) => (
              <View key={i} style={styles.alertItem}>
                <Text style={styles.alertText}>
                  {ALERT_LABELS[alert] ?? `⚠️ ${alert}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Animals in kennel */}
        {kennel.animals_preview && kennel.animals_preview.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zvířata v boxu</Text>
            <View style={styles.card}>
              {kennel.animals_preview.map((animal) => (
                <TouchableOpacity
                  key={animal.id}
                  style={styles.animalRow}
                  activeOpacity={0.75}
                  onPress={() => router.push(`/animals/${animal.id}`)}
                >
                  <Text style={styles.animalEmoji}>
                    {SPECIES_EMOJI[animal.species] ?? '🐾'}
                  </Text>
                  <Text style={styles.animalName}>{animal.name}</Text>
                  {animal.public_code && (
                    <Text style={styles.animalCode}>#{animal.public_code}</Text>
                  )}
                  <Text style={styles.animalArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informace o boxu</Text>
          <View style={styles.card}>
            <InfoRow label="Typ" value={kennel.type} />
            <InfoRow label="Kategorie velikosti" value={kennel.size_category} />
            <InfoRow label="Poslední úklid" value={formatDate(kennel.last_cleaned_at)} />
            {kennel.maintenance_start_at && (
              <InfoRow
                label="Oprava od"
                value={`${formatDate(kennel.maintenance_start_at)}${kennel.maintenance_end_at ? ` do ${formatDate(kennel.maintenance_end_at)}` : ''}`}
              />
            )}
            <InfoRow label="Důvod opravy" value={kennel.maintenance_reason} />
          </View>
        </View>

        {/* Notes */}
        {kennel.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Poznámky</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{kennel.notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerArea: {
    backgroundColor: '#6B4EFF',
    paddingTop: 52,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B4EFF',
    backgroundColor: '#EDE9FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 4,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  heroZone: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  capacitySection: {
    gap: 6,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  capacityLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  capacityCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  capacityBarBg: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: 8,
    borderRadius: 4,
  },
  alertsContainer: {
    marginHorizontal: 16,
    gap: 6,
    marginBottom: 4,
  },
  alertItem: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  animalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  animalEmoji: {
    fontSize: 18,
  },
  animalName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  animalCode: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  animalArrow: {
    fontSize: 18,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    paddingVertical: 12,
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
  bottomPadding: {
    height: 40,
  },
});
