import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
// type-only import — erased at runtime, no module-level side effects
import type MapViewType from 'react-native-maps';
import { MapPin, ChevronLeft } from 'lucide-react-native';
import { useTranslations } from '../../i18n';
import { publicApi } from '../../lib/api';
import { MapErrorBoundary } from '../../components/MapErrorBoundary';

type Species = 'dog' | 'cat' | 'other';

interface NearbyShelter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
  accepts_dogs: boolean | null;
  accepts_cats: boolean | null;
}

const RADIUS_KM = 50;

// react-native-maps is only available in custom dev builds (expo-dev-client).
// In Expo Go (executionEnvironment === 'storeClient') the native module is not
// registered and attempting to render MapView causes an unrecoverable crash.
const MAP_AVAILABLE = Constants.executionEnvironment !== 'storeClient';

// Conditional require — only runs in custom dev builds where the native module
// is actually registered. Static import is intentionally avoided: in Expo Go
// even importing (without rendering) triggers native registration side effects
// that corrupt findNodeHandle and crash both the app and LogBox.
let MapView: typeof MapViewType | null = null;
let Marker: React.ComponentType<any> | null = null;
let Callout: React.ComponentType<any> | null = null;

if (MAP_AVAILABLE) {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Callout = maps.Callout;
  } catch {
    // Silently fail — render fallback instead
  }
}

const PIN_COLORS = ['#22C55E', '#F97316', '#EF4444'];

export default function ShelterFinderScreen() {
  const router = useRouter();
  const { t } = useTranslations();
  const [step, setStep] = useState<'select' | 'results'>('select');
  const [species, setSpecies] = useState<Species | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const mapRef = useRef<InstanceType<typeof MapViewType>>(null);

  const handleSelectSpecies = async (s: Species) => {
    setSpecies(s);
    setLocationError(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError(t('shelterFinder.locationDenied'));
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setStep('results');
    } catch {
      setLocationError(t('shelterFinder.locationDenied'));
    }
  };

  const { data: shelters, isLoading } = useQuery<NearbyShelter[]>({
    queryKey: ['shelters-nearby', location, species],
    queryFn: () =>
      publicApi.getNearbyShelters({
        lat: location!.lat,
        lng: location!.lng,
        species: species!,
        radius_km: RADIUS_KM,
      }),
    enabled: !!location && !!species,
  });

  const topThree = shelters?.slice(0, 3) ?? [];

  useEffect(() => {
    if (topThree.length > 0 && location && mapRef.current) {
      const coords = [
        { latitude: location.lat, longitude: location.lng },
        ...topThree.map((s) => ({ latitude: s.lat, longitude: s.lng })),
      ];
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [topThree.length, location]);

  const renderShelterCard = ({ item }: { item: NearbyShelter }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MapPin size={16} color="#6B4EFF" />
        <Text style={styles.cardName}>{item.name}</Text>
      </View>
      <Text style={styles.cardAddress}>{item.address}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>
            {t('shelterFinder.distance').replace('{km}', String(item.distance_km))}
          </Text>
        </View>
        <View style={styles.speciesIcons}>
          {item.accepts_dogs && <Text style={styles.speciesIcon}>🐕</Text>}
          {item.accepts_cats && <Text style={styles.speciesIcon}>🐈</Text>}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#374151" />
          <Text style={styles.backText}>{t('shelterFinder.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('shelterFinder.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {step === 'select' ? (
        <View style={styles.selectContainer}>
          <Text style={styles.subtitle}>{t('shelterFinder.subtitle')}</Text>

          {locationError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{locationError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.speciesCard}
            onPress={() => handleSelectSpecies('dog')}
          >
            <Text style={styles.speciesEmoji}>🐕</Text>
            <Text style={styles.speciesLabel}>{t('shelterFinder.dog')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.speciesCard}
            onPress={() => handleSelectSpecies('cat')}
          >
            <Text style={styles.speciesEmoji}>🐈</Text>
            <Text style={styles.speciesLabel}>{t('shelterFinder.cat')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.speciesCard}
            onPress={() => handleSelectSpecies('other')}
          >
            <Text style={styles.speciesEmoji}>🐾</Text>
            <Text style={styles.speciesLabel}>{t('shelterFinder.other')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          {/* Species selector tabs */}
          <View style={styles.speciesTabs}>
            {(['dog', 'cat', 'other'] as Species[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.speciesTab, species === s && styles.speciesTabActive]}
                onPress={() => handleSelectSpecies(s)}
              >
                <Text style={styles.speciesTabEmoji}>
                  {s === 'dog' ? '🐕' : s === 'cat' ? '🐈' : '🐾'}
                </Text>
                <Text style={[styles.speciesTabText, species === s && styles.speciesTabTextActive]}>
                  {t(`shelterFinder.${s}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6B4EFF" />
              <Text style={styles.loadingText}>{t('shelterFinder.loading')}</Text>
            </View>
          ) : !shelters || shelters.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🏠</Text>
              <Text style={styles.emptyText}>
                {t('shelterFinder.empty').replace('{radius}', String(RADIUS_KM))}
              </Text>
            </View>
          ) : (
            <>
              {/* Map with top 3 nearest shelters */}
              {location && (
                MAP_AVAILABLE && MapView ? (
                  <MapErrorBoundary>
                    <View style={styles.mapContainer}>
                      <Text style={styles.mapLabel}>{t('shelterFinder.mapNearestThree')}</Text>
                      <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={{
                          latitude: location.lat,
                          longitude: location.lng,
                          latitudeDelta: 0.5,
                          longitudeDelta: 0.5,
                        }}
                        showsUserLocation
                        showsMyLocationButton={false}
                      >
                        {topThree.map((shelter, index) => (
                          <Marker
                            key={shelter.id}
                            coordinate={{ latitude: shelter.lat, longitude: shelter.lng }}
                            pinColor={PIN_COLORS[index]}
                          >
                            <Callout>
                              <View style={styles.callout}>
                                <Text style={styles.calloutName}>{shelter.name}</Text>
                                <Text style={styles.calloutDist}>
                                  {t('shelterFinder.distance').replace(
                                    '{km}',
                                    String(shelter.distance_km)
                                  )}
                                </Text>
                                <Text style={styles.calloutHint}>
                                  {t('shelterFinder.tapForDetails')}
                                </Text>
                              </View>
                            </Callout>
                          </Marker>
                        ))}
                      </MapView>
                    </View>
                  </MapErrorBoundary>
                ) : (
                  <View style={styles.mapUnavailable}>
                    <Text style={styles.mapUnavailableText}>
                      🗺️ {t('shelterFinder.mapUnavailable')}
                    </Text>
                  </View>
                )
              )}

              {/* Full list */}
              <FlatList
                data={shelters}
                keyExtractor={(item) => item.id}
                renderItem={renderShelterCard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  backText: {
    color: '#374151',
    fontSize: 15,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  headerSpacer: {
    minWidth: 80,
  },
  selectContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  speciesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  speciesEmoji: {
    fontSize: 36,
  },
  speciesLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  resultsContainer: {
    flex: 1,
  },
  speciesTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  speciesTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  speciesTabActive: {
    borderColor: '#6B4EFF',
    backgroundColor: '#F0ECFF',
  },
  speciesTabEmoji: {
    fontSize: 16,
  },
  speciesTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  speciesTabTextActive: {
    color: '#6B4EFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
  },
  mapContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  mapLabel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: '#FFFFFF',
  },
  map: {
    height: 260,
  },
  mapUnavailable: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  mapUnavailableText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  callout: {
    minWidth: 160,
    maxWidth: 220,
    padding: 8,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  calloutDist: {
    fontSize: 13,
    color: '#6B4EFF',
    fontWeight: '500',
    marginBottom: 2,
  },
  calloutHint: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    flex: 1,
  },
  cardAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
    marginLeft: 24,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distanceText: {
    color: '#6B4EFF',
    fontSize: 13,
    fontWeight: '600',
  },
  speciesIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  speciesIcon: {
    fontSize: 18,
  },
});
