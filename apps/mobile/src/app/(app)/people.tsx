import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Heart,
  Stethoscope,
  Users,
  Home,
  Building2,
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import type { OrgMember, Contact } from '../../types/people';

type Tab = 'members' | 'contacts';

const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
  admin:     { bg: '#EDE9FE', text: '#6B4EFF' },
  manager:   { bg: '#DBEAFE', text: '#1D4ED8' },
  vet_staff: { bg: '#DCFCE7', text: '#15803D' },
  caretaker: { bg: '#FED7AA', text: '#C2410C' },
  volunteer: { bg: '#F3F4F6', text: '#374151' },
};

const ROLE_LABELS: Record<string, string> = {
  admin:     'Admin',
  manager:   'Manažer',
  vet_staff: 'Veterinář',
  caretaker: 'Ošetřovatel',
  volunteer: 'Dobrovolník',
  foster:    'Pěstoun',
  readonly:  'Jen čtení',
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  donor:        'Dárce',
  veterinarian: 'Veterinář',
  volunteer:    'Dobrovolník',
  foster:       'Pěstoun',
  supplier:     'Dodavatel',
  partner:      'Partner',
  other:        'Jiný',
};

function ContactTypeIcon({ type, color }: { type: string; color: string }) {
  const size = 14;
  switch (type) {
    case 'donor':        return <Heart size={size} color={color} />;
    case 'veterinarian': return <Stethoscope size={size} color={color} />;
    case 'foster':       return <Home size={size} color={color} />;
    case 'supplier':
    case 'partner':      return <Building2 size={size} color={color} />;
    default:             return <Users size={size} color={color} />;
  }
}

function MemberCard({ item }: { item: OrgMember }) {
  const fullName = [item.first_name, item.last_name].filter(Boolean).join(' ') || item.email;
  const primaryRole = item.roles?.[0]?.name ?? '';
  const roleStyle = ROLE_STYLES[primaryRole] ?? { bg: '#F3F4F6', text: '#374151' };
  const roleLabel = ROLE_LABELS[primaryRole] ?? primaryRole;

  return (
    <View style={styles.card}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>
          {(item.first_name?.[0] ?? item.email[0]).toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{fullName}</Text>
        <Text style={styles.cardSub}>{item.email}</Text>
      </View>
      {primaryRole ? (
        <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
          <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>{roleLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ContactCard({ item }: { item: Contact }) {
  const fullName = [item.first_name, item.last_name].filter(Boolean).join(' ') || '—';
  const typeLabel = CONTACT_TYPE_LABELS[item.type] ?? item.type;

  return (
    <View style={styles.card}>
      <View style={[styles.avatarCircle, { backgroundColor: '#E0F2FE' }]}>
        <Text style={[styles.avatarText, { color: '#0891B2' }]}>
          {(item.first_name?.[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{fullName}</Text>
        {item.email ? <Text style={styles.cardSub}>{item.email}</Text> : null}
        {item.phone ? <Text style={styles.cardSub}>{item.phone}</Text> : null}
        {item.organization_name ? (
          <Text style={styles.cardOrg}>{item.organization_name}</Text>
        ) : null}
      </View>
      <View style={styles.contactTypeBadge}>
        <ContactTypeIcon type={item.type} color="#0891B2" />
        <Text style={styles.contactTypeText}>{typeLabel}</Text>
      </View>
    </View>
  );
}

export default function PeopleScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const { selectedOrganizationId } = useAuthStore();

  const {
    data: membersData,
    isLoading: membersLoading,
    refetch: refetchMembers,
    isRefetching: membersRefetching,
  } = useQuery<{ items: OrgMember[]; total: number }>({
    queryKey: ['org-members', selectedOrganizationId],
    queryFn: () =>
      api.get(`/organizations/${selectedOrganizationId}/members`, {
        'x-organization-id': selectedOrganizationId!,
      }),
    enabled: !!selectedOrganizationId && activeTab === 'members',
  });

  const {
    data: contactsData,
    isLoading: contactsLoading,
    refetch: refetchContacts,
    isRefetching: contactsRefetching,
  } = useQuery<{ items: Contact[]; total: number }>({
    queryKey: ['contacts', selectedOrganizationId],
    queryFn: () =>
      api.get(`/contacts`, {
        'x-organization-id': selectedOrganizationId!,
      }),
    enabled: !!selectedOrganizationId && activeTab === 'contacts',
  });

  const members = membersData?.items ?? [];
  const contacts = contactsData?.items ?? [];
  const isLoading = activeTab === 'members' ? membersLoading : contactsLoading;
  const isRefreshing = activeTab === 'members' ? membersRefetching : contactsRefetching;

  const handleRefresh = () => {
    if (activeTab === 'members') refetchMembers();
    else refetchContacts();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lidé</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'members' && styles.tabActive]}
            onPress={() => setActiveTab('members')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
              Členové
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'contacts' && styles.tabActive]}
            onPress={() => setActiveTab('contacts')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'contacts' && styles.tabTextActive]}>
              Kontakty
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B4EFF" />
        </View>
      ) : activeTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MemberCard item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#6B4EFF" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>Žádní členové</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ContactCard item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#6B4EFF" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>Žádné kontakty</Text>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  tabTextActive: {
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
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B4EFF',
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardOrg: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contactTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  },
  contactTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0891B2',
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
