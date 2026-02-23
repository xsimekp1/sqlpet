import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from '../../i18n';
import api from '../../lib/api';
import type { AnimalsListResponse } from '../../types/animals';

const SPECIES_EMOJI: Record<string, string> = {
  dog:    '🐕',
  cat:    '🐈',
  rodent: '🐹',
  bird:   '🐦',
  other:  '🐾',
};

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PETSLOG_LOGO = require('../../../assets/petslog.png');

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout, selectedOrganizationId, memberships } = useAuthStore();
  const { t } = useTranslations();

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await api.get('/health');
      return response.data;
    },
    retry: false,
  });

  const { data: recentData } = useQuery({
    queryKey: ['animals', 'recent', selectedOrganizationId],
    queryFn: () =>
      api.get<AnimalsListResponse>('/animals?page_size=5', {
        'x-organization-id': selectedOrganizationId!,
      }),
    enabled: !!selectedOrganizationId,
  });

  const recentAnimals = recentData?.items ?? [];

  const currentOrg = memberships.find(
    (m) => m.organization_id === selectedOrganizationId
  );

  const handleLogout = () => {
    Alert.alert(
      t('topbar.logout'),
      t('topbar.logout') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('topbar.logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Image source={PETSLOG_LOGO} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('home.signedIn')}</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {currentOrg && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('home.organization')}</Text>
            <Text style={styles.orgName}>{currentOrg.organization_name}</Text>
            <Text style={styles.roleBadge}>{currentOrg.role_name || 'Member'}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('home.apiStatus')}</Text>
          {healthLoading ? (
            <ActivityIndicator size="small" color="#6B4EFF" />
          ) : healthData ? (
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{t('home.connected')}</Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, styles.statusDotError]} />
              <Text style={[styles.statusText, styles.statusTextError]}>Disconnected</Text>
            </View>
          )}
        </View>

        {memberships.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Your Organizations</Text>
            {memberships.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.orgItem,
                  m.organization_id === selectedOrganizationId && styles.orgItemActive,
                ]}
                onPress={() => {}}
              >
                <Text style={styles.orgItemName}>{m.organization_name}</Text>
                <Text style={styles.orgItemRole}>{m.role_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recently Admitted */}
        {recentAnimals.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Naposledy přijatá</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroll}
            >
              {recentAnimals.map((animal) => {
                const days = daysSince(animal.current_intake_date ?? null);
                return (
                  <TouchableOpacity
                    key={animal.id}
                    style={styles.animalMiniCard}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/animals/${animal.id}`)}
                  >
                    <View style={styles.animalMiniPhoto}>
                      {animal.default_image_url ? (
                        <Image
                          source={{ uri: animal.default_image_url }}
                          style={styles.animalMiniImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.animalMiniEmoji}>
                          {SPECIES_EMOJI[animal.species] ?? '🐾'}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.animalMiniName} numberOfLines={1}>
                      {animal.name}
                    </Text>
                    <Text style={styles.animalMiniSpecies}>
                      {SPECIES_EMOJI[animal.species] ?? '🐾'}
                    </Text>
                    {days !== null && (
                      <Text style={styles.animalMiniDays}>
                        {days === 0 ? 'Dnes' : `${days} d`}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#6B4EFF',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 60,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  orgName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#EEF2FF',
    color: '#6B4EFF',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  statusDotError: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  statusTextError: {
    color: '#EF4444',
  },
  orgItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orgItemActive: {
    backgroundColor: '#F3F4F6',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  orgItemName: {
    fontSize: 16,
    color: '#1A1A2E',
  },
  orgItemRole: {
    fontSize: 12,
    color: '#6B7280',
  },
  recentSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  recentScroll: {
    gap: 10,
    paddingRight: 4,
  },
  animalMiniCard: {
    width: 88,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  animalMiniPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  animalMiniImg: {
    width: 60,
    height: 60,
  },
  animalMiniEmoji: {
    fontSize: 28,
  },
  animalMiniName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 2,
  },
  animalMiniSpecies: {
    fontSize: 14,
    marginBottom: 2,
  },
  animalMiniDays: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
