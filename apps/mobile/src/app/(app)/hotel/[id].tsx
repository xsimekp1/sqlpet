import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Check, X, Save, Calendar, Dog, Cat } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../lib/api';
import type { HotelReservation } from '../../../types/hotel';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:     { label: 'Čeká na potvrzení', bg: '#FEF9C3', text: '#CA8A04' },
  confirmed:   { label: 'Potvrzeno', bg: '#DBEAFE', text: '#1D4ED8' },
  checked_in:  { label: 'Nastoupil/a', bg: '#DCFCE7', text: '#15803D' },
  checked_out: { label: 'Odjel/a', bg: '#F3F4F6', text: '#374151' },
  cancelled:   { label: 'Zrušeno', bg: '#FEE2E2', text: '#B91C1C' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function InfoRow({ label, value, editable, onChangeText }: {
  label: string;
  value: string | null | undefined;
  editable?: boolean;
  onChangeText?: (text: string) => void;
}) {
  if (!editable && !value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {editable && onChangeText ? (
        <TextInput
          style={styles.infoInput}
          value={value || ''}
          onChangeText={onChangeText}
          placeholder="—"
          placeholderTextColor="#9CA3AF"
        />
      ) : (
        <Text style={styles.infoValue}>{value || '—'}</Text>
      )}
    </View>
  );
}

export default function HotelReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { selectedOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<HotelReservation>>({});

  const headers = selectedOrganizationId
    ? { 'x-organization-id': selectedOrganizationId }
    : {};

  const { data: reservation, isLoading, isError, refetch } = useQuery({
    queryKey: ['hotel-reservation', id, selectedOrganizationId],
    queryFn: async () => {
      if (!selectedOrganizationId || !id) throw new Error('Missing params');
      return api.get<HotelReservation>(`/hotel/reservations/${id}`, headers);
    },
    enabled: !!selectedOrganizationId && !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<HotelReservation>) =>
      api.put(`/hotel/reservations/${id}`, data, headers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-reservation', id] });
      queryClient.invalidateQueries({ queryKey: ['hotel-reservations'] });
      setIsEditing(false);
      Alert.alert('Uloženo', 'Změny byly uloženy.');
    },
    onError: () => {
      Alert.alert('Chyba', 'Nepodařilo se uložit změny.');
    },
  });

  const checkinMutation = useMutation({
    mutationFn: () => api.post(`/hotel/reservations/${id}/checkin`, undefined, headers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-reservation', id] });
      queryClient.invalidateQueries({ queryKey: ['hotel-reservations'] });
      Alert.alert('Check-in proveden', 'Zvíře bylo přijato.');
    },
    onError: () => {
      Alert.alert('Chyba', 'Nepodařilo se provést check-in.');
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () => api.post(`/hotel/reservations/${id}/checkout`, undefined, headers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-reservation', id] });
      queryClient.invalidateQueries({ queryKey: ['hotel-reservations'] });
      Alert.alert('Check-out proveden', 'Zvíře odjelo.');
    },
    onError: () => {
      Alert.alert('Chyba', 'Nepodařilo se provést check-out.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.delete(`/hotel/reservations/${id}`, headers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-reservations'] });
      Alert.alert('Zrušeno', 'Rezervace byla zrušena.');
      router.back();
    },
    onError: () => {
      // 204 No Content may cause JSON parse to throw — still a success
      queryClient.invalidateQueries({ queryKey: ['hotel-reservations'] });
      router.back();
    },
  });

  const handleStartEdit = () => {
    if (reservation) {
      setEditedData({
        animal_name: reservation.animal_name,
        animal_breed: reservation.animal_breed,
        animal_notes: reservation.animal_notes,
        notes: reservation.notes,
        price_per_day: reservation.price_per_day,
        is_paid: reservation.is_paid,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editedData);
  };

  const handleCancel = () => {
    Alert.alert(
      'Zrušit rezervaci',
      `Opravdu chcete zrušit tuto rezervaci?`,
      [
        { text: 'Zpět', style: 'cancel' },
        {
          text: 'Zrušit rezervaci',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ]
    );
  };

  const Header = () => (
    <View style={styles.navBar}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ChevronLeft size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.navTitle} numberOfLines={1}>
        {reservation?.animal_name ?? 'Detail rezervace'}
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

  if (isError || !reservation) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerArea}>
          <Header />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Nepodařilo se načíst rezervaci</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Zkusit znovu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[reservation.status] ?? STATUS_CONFIG.pending;
  const isEditable = reservation.status !== 'checked_out' && reservation.status !== 'cancelled';
  const showCheckin = reservation.status === 'pending' || reservation.status === 'confirmed';
  const showCheckout = reservation.status === 'checked_in';

  const totalDays = Math.max(
    1,
    Math.ceil(
      (new Date(reservation.reserved_to).getTime() - new Date(reservation.reserved_from).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );

  const SpeciesIcon = reservation.animal_species === 'dog' ? Dog : Cat;

  return (
    <View style={styles.screen}>
      <View style={styles.headerArea}>
        <Header />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero section */}
        <View style={styles.heroContainer}>
          <View style={styles.heroIcon}>
            <SpeciesIcon
              size={48}
              color={reservation.animal_species === 'dog' ? '#3B82F6' : '#F97316'}
            />
          </View>
          <Text style={styles.heroName}>{reservation.animal_name}</Text>
          {reservation.animal_breed && (
            <Text style={styles.heroBreed}>{reservation.animal_breed}</Text>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
          </View>
        </View>

        {/* Quick actions */}
        {isEditable && (
          <View style={styles.actionsContainer}>
            {showCheckin && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonGreen]}
                onPress={() => checkinMutation.mutate()}
                disabled={checkinMutation.isPending}
              >
                <Check size={18} color="#15803D" />
                <Text style={styles.actionButtonTextGreen}>Check-in</Text>
              </TouchableOpacity>
            )}
            {showCheckout && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonBlue]}
                onPress={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
              >
                <Check size={18} color="#1D4ED8" />
                <Text style={styles.actionButtonTextBlue}>Check-out</Text>
              </TouchableOpacity>
            )}
            {(showCheckin || showCheckout) && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonRed]}
                onPress={handleCancel}
                disabled={cancelMutation.isPending}
              >
                <X size={18} color="#B91C1C" />
                <Text style={styles.actionButtonTextRed}>Zrušit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Termín pobytu</Text>
          <View style={styles.card}>
            <View style={styles.dateRow}>
              <Calendar size={20} color="#6B4EFF" />
              <Text style={styles.dateText}>
                {formatDate(reservation.reserved_from)} – {formatDate(reservation.reserved_to)}
              </Text>
            </View>
            <Text style={styles.daysText}>
              {totalDays} {totalDays === 1 ? 'den' : totalDays < 5 ? 'dny' : 'dní'}
            </Text>
          </View>
        </View>

        {/* Animal info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Zvíře</Text>
            {isEditable && !isEditing && (
              <TouchableOpacity onPress={handleStartEdit}>
                <Text style={styles.editLink}>Upravit</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.card}>
            <InfoRow
              label="Jméno"
              value={isEditing ? editedData.animal_name : reservation.animal_name}
              editable={isEditing}
              onChangeText={(text) => setEditedData({ ...editedData, animal_name: text })}
            />
            <InfoRow
              label="Plemeno"
              value={isEditing ? editedData.animal_breed : reservation.animal_breed}
              editable={isEditing}
              onChangeText={(text) => setEditedData({ ...editedData, animal_breed: text })}
            />
            <InfoRow
              label="Poznámky"
              value={isEditing ? editedData.animal_notes : reservation.animal_notes}
              editable={isEditing}
              onChangeText={(text) => setEditedData({ ...editedData, animal_notes: text })}
            />
          </View>
        </View>

        {/* Kennel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kotec</Text>
          <View style={styles.card}>
            <InfoRow label="Kotec" value={reservation.kennel_name} />
            <InfoRow
              label="Samostatný kotec"
              value={reservation.requires_single_cage ? 'Ano' : 'Ne'}
            />
            <InfoRow label="Vlastní krmivo" value={reservation.own_food ? 'Ano' : 'Ne'} />
          </View>
        </View>

        {/* Price */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cena</Text>
          <View style={styles.card}>
            <InfoRow
              label="Cena/den"
              value={reservation.price_per_day ? `${reservation.price_per_day} Kč` : '—'}
            />
            <InfoRow
              label="Celkem"
              value={reservation.total_price ? `${reservation.total_price} Kč` : '—'}
            />
            <View style={styles.paidRow}>
              <Text style={styles.infoLabel}>Zaplaceno</Text>
              <TouchableOpacity
                style={[
                  styles.paidBadge,
                  { backgroundColor: (isEditing ? editedData.is_paid : reservation.is_paid) ? '#DCFCE7' : '#FEE2E2' },
                ]}
                onPress={() => {
                  if (isEditing) {
                    setEditedData({ ...editedData, is_paid: !editedData.is_paid });
                  }
                }}
                disabled={!isEditing}
              >
                <Text
                  style={[
                    styles.paidBadgeText,
                    { color: (isEditing ? editedData.is_paid : reservation.is_paid) ? '#15803D' : '#B91C1C' },
                  ]}
                >
                  {(isEditing ? editedData.is_paid : reservation.is_paid) ? 'Ano' : 'Ne'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Poznámky</Text>
          <View style={styles.card}>
            {isEditing ? (
              <TextInput
                style={styles.notesInput}
                value={editedData.notes || ''}
                onChangeText={(text) => setEditedData({ ...editedData, notes: text })}
                placeholder="Poznámky k rezervaci..."
                placeholderTextColor="#9CA3AF"
                multiline
              />
            ) : (
              <Text style={styles.notesText}>{reservation.notes || 'Žádné poznámky'}</Text>
            )}
          </View>
        </View>

        {/* Save button when editing */}
        {isEditing && (
          <View style={styles.saveContainer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Save size={18} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Uložit změny</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelEditButton}
              onPress={() => setIsEditing(false)}
              disabled={updateMutation.isPending}
            >
              <Text style={styles.cancelEditButtonText}>Zrušit úpravy</Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  heroBreed: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  actionButtonGreen: {
    backgroundColor: '#DCFCE7',
  },
  actionButtonBlue: {
    backgroundColor: '#DBEAFE',
  },
  actionButtonRed: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonTextGreen: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  actionButtonTextBlue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  actionButtonTextRed: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B4EFF',
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
    paddingVertical: 12,
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
  infoInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  daysText: {
    fontSize: 13,
    color: '#6B7280',
    paddingBottom: 12,
    paddingLeft: 32,
  },
  paidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  paidBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  paidBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  notesInput: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    paddingVertical: 12,
  },
  saveContainer: {
    marginHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#6B4EFF',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelEditButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelEditButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
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
