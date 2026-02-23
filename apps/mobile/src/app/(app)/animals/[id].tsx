import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../lib/api';
import type { Animal, AnimalStatus, AnimalSex, AnimalSpecies } from '../../../types/animals';

const STATUS_CONFIG: Record<AnimalStatus, { bg: string; text: string; label: string }> = {
  available:          { bg: '#DCFCE7', text: '#166534', label: 'K adopci' },
  reserved:           { bg: '#FEF3C7', text: '#92400E', label: 'Rezervováno' },
  adopted:            { bg: '#DBEAFE', text: '#1E40AF', label: 'Adoptováno' },
  fostered:           { bg: '#EDE9FE', text: '#5B21B6', label: 'Pěstounka' },
  transferred:        { bg: '#FEF9C3', text: '#854D0E', label: 'Přemístěno' },
  deceased:           { bg: '#F3F4F6', text: '#374151', label: 'Uhynulo' },
  euthanized:         { bg: '#F3F4F6', text: '#374151', label: 'Utraceno' },
  escaped:            { bg: '#FEE2E2', text: '#991B1B', label: 'Uprchlé' },
  quarantine:         { bg: '#FFEDD5', text: '#9A3412', label: 'Karanténa' },
  intake:             { bg: '#E0F2FE', text: '#075985', label: 'Příjem' },
  registered:         { bg: '#F3F4F6', text: '#374151', label: 'Registrováno' },
  returned:           { bg: '#DBEAFE', text: '#1E40AF', label: 'Vráceno' },
  hold:               { bg: '#F3F4F6', text: '#374151', label: 'Pozastaveno' },
  returned_to_owner:  { bg: '#DBEAFE', text: '#1E40AF', label: 'U majitele' },
  hotel:              { bg: '#E0F2FE', text: '#075985', label: 'Hotel' },
  with_owner:         { bg: '#F0FDF4', text: '#166534', label: 'S majitelem' },
};

const SPECIES_EMOJI: Record<AnimalSpecies, string> = {
  dog:    '🐕',
  cat:    '🐈',
  rodent: '🐹',
  bird:   '🐦',
  other:  '🐾',
};

const SEX_LABEL: Record<AnimalSex, string> = {
  male:    '♂ Samec',
  female:  '♀ Samice',
  unknown: '? Neznámé',
};

const IDENTIFIER_LABELS: Record<string, string> = {
  microchip: 'Čip',
  tattoo:    'Tetování',
  ear_tag:   'Ušní známka',
  passport:  'Pas',
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

export default function AnimalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { selectedOrganizationId } = useAuthStore();

  const { data: animal, isLoading, isError, refetch } = useQuery({
    queryKey: ['animal', id, selectedOrganizationId],
    queryFn: async () => {
      if (!selectedOrganizationId || !id) throw new Error('Missing params');
      return api.get<Animal>(`/animals/${id}`, {
        'x-organization-id': selectedOrganizationId,
      });
    },
    enabled: !!selectedOrganizationId && !!id,
  });

  const Header = () => (
    <View style={styles.navBar}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ChevronLeft size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.navTitle} numberOfLines={1}>
        {animal?.name ?? 'Detail zvířete'}
      </Text>
      <View style={styles.navSpacer} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerArea}>
          <Header />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B4EFF" />
          <Text style={styles.loadingText}>Načítám detail…</Text>
        </View>
      </View>
    );
  }

  if (isError || !animal) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerArea}>
          <Header />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Nepodařilo se načíst zvíře</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Zkusit znovu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const status = STATUS_CONFIG[animal.status] ?? STATUS_CONFIG.registered;
  const emoji = SPECIES_EMOJI[animal.species] ?? '🐾';
  const photoUrl = animal.primary_photo_url ?? animal.default_image_url;

  const ageLabel = (() => {
    if (animal.estimated_age_years != null) {
      const y = animal.estimated_age_years;
      if (y < 1) return '< 1 rok';
      if (y === 1) return '1 rok';
      if (y < 5) return `${y} roky`;
      return `${y} let`;
    }
    return null;
  })();

  return (
    <View style={styles.screen}>
      {/* Fixed header bar */}
      <View style={styles.headerArea}>
        <Header />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Photo hero */}
        <View style={styles.heroContainer}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.heroPhoto} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroEmoji}>{emoji}</Text>
            </View>
          )}
          {/* Gradient overlay */}
          <View style={styles.heroOverlay} />
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{animal.name}</Text>
            <View style={styles.heroBadges}>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
              </View>
              {animal.current_kennel_code && (
                <View style={styles.kennelBadge}>
                  <Text style={styles.kennelBadgeText}>📍 {animal.current_kennel_code}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>{emoji}</Text>
            <Text style={styles.statLabel}>
              {animal.species === 'dog' ? 'Pes' :
               animal.species === 'cat' ? 'Kočka' :
               animal.species === 'rodent' ? 'Hlodavec' :
               animal.species === 'bird' ? 'Pták' : 'Jiné'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>
              {animal.sex === 'male' ? '♂' : animal.sex === 'female' ? '♀' : '?'}
            </Text>
            <Text style={styles.statLabel}>{SEX_LABEL[animal.sex]}</Text>
          </View>
          {ageLabel && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🎂</Text>
                <Text style={styles.statLabel}>{ageLabel}</Text>
              </View>
            </>
          )}
          {animal.weight_current_kg != null && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>⚖️</Text>
                <Text style={styles.statLabel}>{parseFloat(String(animal.weight_current_kg)).toString()} kg</Text>
              </View>
            </>
          )}
        </View>

        {/* Warning flags */}
        {(animal.is_aggressive || animal.is_critical || animal.status === 'quarantine') && (
          <View style={styles.flagsContainer}>
            {animal.is_aggressive && (
              <View style={styles.flagItem}>
                <Text style={styles.flagText}>⚠️ Agresivní</Text>
              </View>
            )}
            {animal.is_critical && (
              <View style={styles.flagItem}>
                <Text style={styles.flagText}>🚨 Kritický stav</Text>
              </View>
            )}
            {animal.status === 'quarantine' && (
              <View style={styles.flagItem}>
                <Text style={styles.flagText}>🔒 Karanténa</Text>
              </View>
            )}
          </View>
        )}

        {/* Basic info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Základní informace</Text>
          <View style={styles.card}>
            {animal.public_code && (
              <InfoRow label="Kód" value={`#${animal.public_code}`} />
            )}
            <InfoRow label="Barva" value={animal.color} />
            <InfoRow label="Srst" value={animal.coat} />
            <InfoRow label="Velikost" value={animal.size_estimated} />
            {animal.description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.infoLabel}>Popis</Text>
                <Text style={styles.descriptionText}>{animal.description}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Breeds */}
        {animal.breeds && animal.breeds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rasy</Text>
            <View style={styles.card}>
              {animal.breeds.map((breed) => (
                <View key={breed.breed_id} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{breed.breed_name}</Text>
                  {breed.percent != null && (
                    <Text style={styles.infoValue}>{breed.percent}%</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Identifiers */}
        {animal.identifiers && animal.identifiers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identifikátory</Text>
            <View style={styles.card}>
              {animal.identifiers.map((ident) => (
                <InfoRow
                  key={ident.id}
                  label={IDENTIFIER_LABELS[ident.type] ?? ident.type}
                  value={ident.value}
                />
              ))}
            </View>
          </View>
        )}

        {/* Location */}
        {animal.current_kennel_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Umístění</Text>
            <View style={styles.card}>
              <InfoRow label="Box" value={animal.current_kennel_name} />
              <InfoRow label="Kód boxu" value={animal.current_kennel_code} />
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
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  heroContainer: {
    height: 240,
    backgroundColor: '#EDE9FE',
    position: 'relative',
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9FE',
  },
  heroEmoji: {
    fontSize: 80,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroInfo: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kennelBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  kennelBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  statEmoji: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  flagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  flagItem: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  flagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
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
  descriptionContainer: {
    paddingVertical: 10,
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 4,
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
