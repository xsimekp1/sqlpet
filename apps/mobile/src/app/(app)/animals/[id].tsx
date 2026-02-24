import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../lib/api';
import type { Animal, AnimalStatus, AnimalSex, AnimalSpecies } from '../../../types/animals';
import type { Kennel } from '../../../types/kennels';

const SPECIES_DEFAULT: Record<string, any> = {
  dog: require('../../../../assets/dog-default.png'),
  cat: require('../../../../assets/cat-default.png'),
};

const COLOR_LABELS: Record<string, string> = {
  black:          'Černá',
  white:          'Bílá',
  brown:          'Hnědá',
  golden:         'Zlatá',
  grey:           'Šedá',
  gray:           'Šedá',
  tan:            'Světle hnědá',
  fawn:           'Plavá',
  blue:           'Modrá',
  'black-tan-white': 'Trikolora',
  black_tan_white:   'Trikolora',
  'black-white':  'Černobílá',
  black_white:    'Černobílá',
  'blue-tan':     'Modroohnivá',
  blue_tan:       'Modroohnivá',
  red:            'Rezavá',
  cream:          'Krémová',
  brindle:        'Pruhovaná',
  orange:         'Oranžová',
  tabby:          'Tygrovitý',
};

function formatIntakeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const dateLabel = `${d}. ${m}. ${y}`;
  if (diffDays < 60) {
    const label = diffDays === 1 ? 'den' : diffDays < 5 ? 'dny' : 'dní';
    return `${dateLabel} (${diffDays} ${label})`;
  }
  const months = Math.round(diffDays / 30);
  const label = months === 1 ? 'měsíc' : months < 5 ? 'měsíce' : 'měsíců';
  return `${dateLabel} (${months} ${label})`;
}

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
  const queryClient = useQueryClient();

  const [kennelModalVisible, setKennelModalVisible] = useState(false);

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

  const headers = selectedOrganizationId
    ? { 'x-organization-id': selectedOrganizationId }
    : {};

  const { data: kennelsData } = useQuery({
    queryKey: ['kennels', selectedOrganizationId],
    queryFn: () => api.get<Kennel[]>('/kennels', headers),
    enabled: kennelModalVisible && !!selectedOrganizationId,
    select: (data) => data.filter((k) => k.status === 'available'),
  });

  const moveKennelMutation = useMutation({
    mutationFn: (targetKennelId: string) =>
      api.post(
        '/stays/move',
        { animal_id: id, target_kennel_id: targetKennelId, reason: 'move' },
        headers,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animal', id] });
      queryClient.invalidateQueries({ queryKey: ['kennels'] });
      setKennelModalVisible(false);
    },
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
  const photoUrl = animal.thumbnail_url ?? animal.primary_photo_url ?? animal.default_image_url;
  const defaultImg = SPECIES_DEFAULT[animal.species] ?? null;

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
          ) : defaultImg ? (
            <Image source={defaultImg} style={styles.heroPhoto} resizeMode="cover" />
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
            <InfoRow label="Barva" value={animal.color ? (COLOR_LABELS[animal.color] ?? animal.color) : null} />
            <InfoRow label="Srst" value={animal.coat} />
            <InfoRow label="V útulku od" value={formatIntakeDate(animal.current_intake_date)} />
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
                  <Text style={styles.infoLabel}>{breed.display_name ?? breed.breed_name}</Text>
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
            <TouchableOpacity
              style={styles.card}
              activeOpacity={animal.current_kennel_id ? 0.75 : 1}
              onPress={() => {
                if (animal.current_kennel_id) {
                  router.push(`/kennels/${animal.current_kennel_id}`);
                }
              }}
            >
              <View style={styles.kennelLinkRow}>
                <View style={styles.kennelLinkInfo}>
                  <InfoRow label="Box" value={animal.current_kennel_name} />
                  <InfoRow label="Kód boxu" value={animal.current_kennel_code} />
                </View>
                {animal.current_kennel_id && (
                  <ChevronRight size={18} color="#9CA3AF" />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moveKennelBtn}
              onPress={() => setKennelModalVisible(true)}
            >
              <Text style={styles.moveKennelBtnText}>Přesunout do boxu</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Kennel move modal */}
      <Modal
        visible={kennelModalVisible}
        animationType="slide"
        onRequestClose={() => setKennelModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Vyberte box</Text>
            <TouchableOpacity onPress={() => setKennelModalVisible(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Zrušit</Text>
            </TouchableOpacity>
          </View>
          {kennelsData && kennelsData.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Žádné volné boxy</Text>
            </View>
          )}
          <FlatList
            data={kennelsData}
            keyExtractor={(k) => k.id}
            contentContainerStyle={styles.kennelList}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => moveKennelMutation.mutate(item.id)}
                style={styles.kennelItem}
                disabled={moveKennelMutation.isPending}
              >
                <View style={styles.kennelItemLeft}>
                  <Text style={styles.kennelItemCode}>{item.code}</Text>
                  <Text style={styles.kennelItemName}>{item.name}</Text>
                  {item.zone_name && (
                    <Text style={styles.kennelItemZone}>{item.zone_name}</Text>
                  )}
                </View>
                <Text style={styles.kennelItemCapacity}>
                  {item.occupied_count}/{item.capacity}
                </Text>
              </TouchableOpacity>
            )}
          />
          {moveKennelMutation.isPending && (
            <View style={styles.modalLoading}>
              <ActivityIndicator color="#6B4EFF" />
              <Text style={styles.modalLoadingText}>Přesouvám…</Text>
            </View>
          )}
        </View>
      </Modal>
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
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  bottomPadding: {
    height: 40,
  },
  kennelLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kennelLinkInfo: {
    flex: 1,
  },
  moveKennelBtn: {
    marginTop: 8,
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  moveKennelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B4EFF',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: 52,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 15,
    color: '#6B4EFF',
    fontWeight: '600',
  },
  kennelList: {
    padding: 16,
    gap: 8,
  },
  kennelItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  kennelItemLeft: {
    flex: 1,
    gap: 2,
  },
  kennelItemCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B4EFF',
    backgroundColor: '#EDE9FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 2,
  },
  kennelItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  kennelItemZone: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  kennelItemCapacity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 12,
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  modalLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
