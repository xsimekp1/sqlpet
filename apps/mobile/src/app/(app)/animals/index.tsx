import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../lib/api';
import type { AnimalListItem, AnimalsListResponse, AnimalStatus, AnimalSex } from '../../../types/animals';

const COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 8 * (COLUMNS - 1)) / COLUMNS;

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

const SPECIES_EMOJI: Record<string, string> = {
  dog:    '🐕',
  cat:    '🐈',
  rodent: '🐹',
  bird:   '🐦',
  other:  '🐾',
};

const SEX_OUTLINE: Record<AnimalSex, string | null> = {
  male:    '#2563EB',
  female:  '#DB2777',
  unknown: null,
};

function AnimalCard({ animal }: { animal: AnimalListItem }) {
  const router = useRouter();
  const status = STATUS_CONFIG[animal.status] ?? STATUS_CONFIG.registered;
  const emoji = SPECIES_EMOJI[animal.species] ?? '🐾';
  const sexOutline = SEX_OUTLINE[animal.sex];

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/animals/${animal.id}`)}
    >
      {/* Photo */}
      <View
        style={[
          styles.photoContainer,
          sexOutline ? { borderWidth: 2, borderColor: sexOutline } : null,
        ]}
      >
        {(animal.thumbnail_url ?? animal.primary_photo_url ?? animal.default_image_url) ? (
          <Image
            source={{ uri: (animal.thumbnail_url ?? animal.primary_photo_url ?? animal.default_image_url)! }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoEmoji}>{emoji}</Text>
          </View>
        )}

        {/* Kennel code badge (bottom-left) */}
        {animal.current_kennel_code && (
          <View style={styles.kennelBadge}>
            <Text style={styles.kennelBadgeText}>{animal.current_kennel_code}</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={1}>{animal.name}</Text>
        {animal.public_code && (
          <Text style={styles.publicCode}>#{animal.public_code}</Text>
        )}
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]} numberOfLines={1}>
            {status.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AnimalsScreen() {
  const router = useRouter();
  const { selectedOrganizationId } = useAuthStore();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['animals', selectedOrganizationId],
    queryFn: async () => {
      if (!selectedOrganizationId) throw new Error('No organization selected');
      return api.get<AnimalsListResponse>('/animals?page_size=100', {
        'x-organization-id': selectedOrganizationId,
      });
    },
    enabled: !!selectedOrganizationId,
  });

  const animals = data?.items ?? [];

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Zvířata</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B4EFF" />
          <Text style={styles.loadingText}>Načítám zvířata…</Text>
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Zvířata</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Nepodařilo se načíst zvířata</Text>
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
        <Text style={styles.headerTitle}>Zvířata</Text>
        {data && (
          <Text style={styles.headerCount}>{data.total} celkem</Text>
        )}
      </View>

      {animals.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🐾</Text>
          <Text style={styles.emptyText}>Žádná zvířata nenalezena</Text>
        </View>
      ) : (
        <FlatList
          data={animals}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => <AnimalCard animal={item} />}
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

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/animals/new')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
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
  grid: {
    padding: 16,
    paddingBottom: 32,
  },
  row: {
    gap: 8,
    marginBottom: 8,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  photoContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    overflow: 'hidden',
    borderRadius: 10,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: {
    fontSize: 48,
  },
  kennelBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  kennelBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  publicCode: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  statusBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6B4EFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
    marginTop: Platform.OS === 'android' ? -2 : 0,
  },
});
