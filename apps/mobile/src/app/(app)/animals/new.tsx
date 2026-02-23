import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../lib/api';
import type { Animal, AnimalSpecies, AnimalSex } from '../../../types/animals';
import type { BreedOption, BreedColorImage } from '../../../lib/api';

const SPECIES_OPTIONS: { value: AnimalSpecies; label: string; emoji: string }[] = [
  { value: 'dog',    label: 'Pes',      emoji: '🐕' },
  { value: 'cat',    label: 'Kočka',    emoji: '🐈' },
  { value: 'rodent', label: 'Hlodavec', emoji: '🐹' },
  { value: 'bird',   label: 'Pták',     emoji: '🐦' },
  { value: 'other',  label: 'Jiné',     emoji: '🐾' },
];

const SEX_OPTIONS: { value: AnimalSex; label: string }[] = [
  { value: 'male',    label: 'Samec' },
  { value: 'female',  label: 'Samice' },
  { value: 'unknown', label: 'Neznámé' },
];

const COLOR_LABELS: Record<string, string> = {
  black:           'Černá',
  white:           'Bílá',
  brown:           'Hnědá',
  golden:          'Zlatá',
  grey:            'Šedá',
  gray:            'Šedá',
  tan:             'Světle hnědá',
  fawn:            'Plavá',
  blue:            'Modrá',
  'black-tan-white': 'Trikolora',
  black_tan_white: 'Trikolora',
  'black-white':   'Černobílá',
  black_white:     'Černobílá',
  'blue-tan':      'Modroohnivá',
  blue_tan:        'Modroohnivá',
  red:             'Rezavá',
  cream:           'Krémová',
  brindle:         'Pruhovaná',
  orange:          'Oranžová',
  tabby:           'Tygrovitý',
};

export default function NewAnimalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedOrganizationId } = useAuthStore();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<AnimalSpecies | null>(null);
  const [sex, setSex] = useState<AnimalSex | null>(null);
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch breeds when species is selected
  const { data: breeds, isFetching: isLoadingBreeds } = useQuery<BreedOption[]>({
    queryKey: ['breeds', species, selectedOrganizationId],
    queryFn: () => api.getBreeds(species!, selectedOrganizationId!),
    enabled: !!species && !!selectedOrganizationId,
  });

  // Fetch color images when breed is selected
  const { data: colorImages, isFetching: isLoadingColors } = useQuery<BreedColorImage[]>({
    queryKey: ['breed-colors', selectedBreedId, selectedOrganizationId],
    queryFn: () => api.getBreedColorImages(selectedBreedId!, selectedOrganizationId!),
    enabled: !!selectedBreedId && !!selectedOrganizationId,
  });

  const previewImageUrl = colorImages?.find((ci) => ci.color === selectedColor)?.image_url ?? null;
  const selectedBreedName = breeds?.find((b) => b.id === selectedBreedId)?.name ?? null;

  const canSubmit = name.trim().length > 0 && species !== null && sex !== null;

  const handleSpeciesChange = (newSpecies: AnimalSpecies) => {
    setSpecies(newSpecies);
    setSelectedBreedId(null);
    setSelectedColor(null);
  };

  const handleBreedChange = (breedId: string) => {
    setSelectedBreedId(breedId);
    setSelectedColor(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedOrganizationId) return;

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        species,
        sex,
        status: 'registered',
      };
      if (selectedBreedId) body.breed_id = selectedBreedId;
      if (selectedColor) body.color = selectedColor;

      const newAnimal = await api.post<Animal>(
        '/animals',
        body,
        { 'x-organization-id': selectedOrganizationId }
      );
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      router.replace(`/animals/${newAnimal.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Neznámá chyba';
      Alert.alert('Chyba', `Nepodařilo se přidat zvíře: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nové zvíře</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        {/* Preview image */}
        {previewImageUrl && (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <Text style={styles.previewCaption}>
              {selectedBreedName ?? ''}{selectedColor ? ` · ${COLOR_LABELS[selectedColor] ?? selectedColor}` : ''}
            </Text>
          </View>
        )}

        {/* Name */}
        <Text style={styles.label}>Jméno *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Jméno zvířete"
          placeholderTextColor="#9CA3AF"
          autoFocus
          returnKeyType="done"
        />

        {/* Species */}
        <Text style={styles.label}>Druh *</Text>
        <View style={styles.optionsRow}>
          {SPECIES_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionButton, species === opt.value && styles.optionButtonActive]}
              onPress={() => handleSpeciesChange(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <Text style={[styles.optionLabel, species === opt.value && styles.optionLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sex */}
        <Text style={styles.label}>Pohlaví *</Text>
        <View style={styles.optionsRow}>
          {SEX_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sexButton, sex === opt.value && styles.optionButtonActive]}
              onPress={() => setSex(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.sexLabel, sex === opt.value && styles.optionLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Breeds — shown after species selection */}
        {species && (
          <>
            <Text style={styles.label}>
              Plemeno{' '}
              {isLoadingBreeds && <ActivityIndicator size="small" color="#6B4EFF" />}
            </Text>
            {breeds && breeds.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {breeds.map((breed) => (
                  <TouchableOpacity
                    key={breed.id}
                    style={[
                      styles.chip,
                      selectedBreedId === breed.id && styles.chipActive,
                    ]}
                    onPress={() => handleBreedChange(breed.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      styles.chipLabel,
                      selectedBreedId === breed.id && styles.chipLabelActive,
                    ]}>
                      {breed.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : !isLoadingBreeds ? (
              <Text style={styles.emptyHint}>Žádná plemena pro tento druh</Text>
            ) : null}
          </>
        )}

        {/* Colors — shown after breed selection */}
        {selectedBreedId && (
          <>
            <Text style={styles.label}>
              Barva{' '}
              {isLoadingColors && <ActivityIndicator size="small" color="#6B4EFF" />}
            </Text>
            {colorImages && colorImages.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {colorImages.map((ci) => (
                  <TouchableOpacity
                    key={ci.color}
                    style={[
                      styles.chip,
                      selectedColor === ci.color && styles.chipActive,
                    ]}
                    onPress={() => setSelectedColor(ci.color)}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      styles.chipLabel,
                      selectedColor === ci.color && styles.chipLabelActive,
                    ]}>
                      {COLOR_LABELS[ci.color] ?? ci.color}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : !isLoadingColors ? (
              <Text style={styles.emptyHint}>Žádné barvy pro toto plemeno</Text>
            ) : null}
          </>
        )}

        <Text style={styles.hint}>* Povinná pole. Ostatní údaje lze doplnit v detailu.</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Přidat zvíře</Text>
          )}
        </TouchableOpacity>
      </View>
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
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 36,
    marginTop: Platform.OS === 'android' ? -4 : 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 36,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
  },
  previewContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#EDE9FE',
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  previewCaption: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 8,
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 64,
  },
  optionButtonActive: {
    borderColor: '#6B4EFF',
    backgroundColor: '#EDE9FE',
  },
  optionEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  optionLabelActive: {
    color: '#6B4EFF',
  },
  sexButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  sexLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: '#6B4EFF',
    backgroundColor: '#EDE9FE',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipLabelActive: {
    color: '#6B4EFF',
  },
  emptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  hint: {
    marginTop: 24,
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#6B4EFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
