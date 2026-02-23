import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from '@sqlpet/i18n';
import api from '../../lib/api';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🐾</Text>
        <Text style={styles.title}>{t('app.name')}</Text>
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
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#6B4EFF',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
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
    display: 'inline-flex',
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
