'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Animal } from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Edit, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import ApiClient from '@/app/lib/api';
import { COLLAR_COLORS, getCollarColor, type CollarColor } from '@/app/lib/collarColors';

interface Breed {
  id: string;
  name: string;
  species: string;
  display_name: string;
}

interface ColorImage {
  color: string;
  image_url: string;
}

interface EditableAnimalDetailsProps {
  animal: Animal;
  onAnimalUpdate: (updatedAnimal: Animal) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'adopted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'fostered':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'transferred':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'deceased':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    case 'escaped':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getColorLabel = (color: string): string => {
  // Simple color label mapping without i18n dependency
  const labels: Record<string, string> = {
    black: 'Black',
    brown: 'Brown',
    white: 'White',
    golden: 'Golden',
    grey: 'Grey',
    gray: 'Gray',
    fawn: 'Fawn',
    black_white: 'Black & White',
    blue_tan: 'Blue & Tan',
    'black-tan-white': 'Tricolor',
    black_tan_white: 'Tricolor',
    tan: 'Tan',
    red: 'Red',
    cream: 'Cream',
    brindle: 'Brindle',
  };
  return labels[color] || color;
};

export function EditableAnimalDetails({ animal, onAnimalUpdate }: EditableAnimalDetailsProps) {
  const locale = useLocale();
  const t = useTranslations('animals');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [colorImages, setColorImages] = useState<ColorImage[]>([]);
  const [loadingColors, setLoadingColors] = useState(false);

  // Compute initial age years from birth_date_estimated
  const getInitialAgeYears = (): string => {
    const bd = (animal as any).birth_date_estimated as string | null | undefined;
    if (!bd) return '';
    const diffMs = Date.now() - new Date(bd).getTime();
    const yrs = diffMs / (365.25 * 24 * 60 * 60 * 1000);
    return String(Math.round(yrs * 10) / 10);
  };

  const [editedData, setEditedData] = useState({
    sex: animal.sex,
    breed_id: animal.breeds?.[0]?.breed_id || '',
    color: animal.color || '',
    collar_color: animal.collar_color || '',
    ageMode: 'years' as 'years' | 'date',
    ageYears: getInitialAgeYears(),
    ageBirthDate: ((animal as any).birth_date_estimated as string | null) ?? '',
  });

  // Fetch breeds on mount
  useEffect(() => {
    ApiClient.getBreeds(animal.species, locale)
      .then(setBreeds)
      .catch(() => setBreeds([]));
  }, [animal.species, locale]);

  // Fetch colors when breed changes
  useEffect(() => {
    if (!editedData.breed_id) {
      setColorImages([]);
      return;
    }
    setLoadingColors(true);
    ApiClient.getBreedColorImages(editedData.breed_id)
      .then(setColorImages)
      .catch(() => setColorImages([]))
      .finally(() => setLoadingColors(false));
  }, [editedData.breed_id]);

  const startEdit = () => {
    setEditedData({
      sex: animal.sex,
      breed_id: animal.breeds?.[0]?.breed_id || '',
      color: animal.color || '',
      collar_color: animal.collar_color || '',
      ageMode: 'years',
      ageYears: getInitialAgeYears(),
      ageBirthDate: ((animal as any).birth_date_estimated as string | null) ?? '',
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditedData({
      sex: animal.sex,
      breed_id: animal.breeds?.[0]?.breed_id || '',
      color: animal.color || '',
      collar_color: animal.collar_color || '',
      ageMode: 'years',
      ageYears: getInitialAgeYears(),
      ageBirthDate: ((animal as any).birth_date_estimated as string | null) ?? '',
    });
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      const updateData: any = {};

      if (editedData.sex !== animal.sex) {
        updateData.sex = editedData.sex;
      }
      if (editedData.breed_id !== (animal.breeds?.[0]?.breed_id || '')) {
        updateData.breeds = editedData.breed_id ? [{ breed_id: editedData.breed_id }] : [];
      }
      if (editedData.color !== (animal.color || '')) {
        updateData.color = editedData.color || null;
      }
      if (editedData.collar_color !== (animal.collar_color || '')) {
        updateData.collar_color = editedData.collar_color || null;
      }
      // Compute birth_date_estimated from age input
      let newBirthDate: string | null = null;
      if (editedData.ageMode === 'years' && editedData.ageYears !== '') {
        const years = parseFloat(editedData.ageYears);
        if (!isNaN(years) && years >= 0) {
          const d = new Date();
          d.setDate(d.getDate() - Math.round(years * 365.25));
          newBirthDate = d.toISOString().split('T')[0];
        }
      } else if (editedData.ageMode === 'date' && editedData.ageBirthDate) {
        newBirthDate = editedData.ageBirthDate;
      }
      const currentBirthDate = ((animal as any).birth_date_estimated as string | null) ?? null;
      if (newBirthDate !== currentBirthDate) {
        updateData.birth_date_estimated = newBirthDate;
      }

      if (Object.keys(updateData).length === 0) {
        cancelEdit();
        return;
      }

      const updatedAnimal = await ApiClient.updateAnimal(animal.id, updateData);
      onAnimalUpdate(updatedAnimal);
      setIsEditing(false);
      toast.success('Informace o zvířeti byly aktualizovány');
    } catch (error) {
      toast.error('Nepodařilo se aktualizovat informace');
      console.error('Error updating animal details:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" onKeyDown={handleKeyDown}>
        {/* Sex */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Sex</p>
          <Select value={editedData.sex} onValueChange={(value: 'male' | 'female' | 'unknown') => setEditedData(prev => ({ ...prev, sex: value }))}>
            <SelectTrigger disabled={isSaving}>
              <SelectValue placeholder="Vyberte pohlaví" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">♂ Male</SelectItem>
              <SelectItem value="female">♀ Female</SelectItem>
              <SelectItem value="unknown">? Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Breed */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Breed</p>
          <Select
            value={editedData.breed_id || 'none'}
            onValueChange={(value) => setEditedData(prev => ({ ...prev, breed_id: value === 'none' ? '' : value, color: '' }))}
          >
            <SelectTrigger disabled={isSaving}>
              <SelectValue placeholder="Vyberte plemeno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— bez plemene —</SelectItem>
              {breeds.map((breed) => (
                <SelectItem key={breed.id} value={breed.id}>
                  {breed.display_name || breed.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Color */}
        {editedData.breed_id && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Color</p>
            {loadingColors ? (
              <p className="text-sm text-muted-foreground">Načítání barev...</p>
            ) : colorImages.length > 0 ? (
              <Select
                value={editedData.color || 'none'}
                onValueChange={(value) => setEditedData(prev => ({ ...prev, color: value === 'none' ? '' : value }))}
              >
                <SelectTrigger disabled={isSaving}>
                  <SelectValue placeholder="Vyberte barvu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— bez barvy —</SelectItem>
                  {colorImages.map((ci) => (
                    <SelectItem key={ci.color} value={ci.color}>
                      {getColorLabel(ci.color)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={editedData.color}
                onChange={(e) => setEditedData(prev => ({ ...prev, color: e.target.value || '' }))}
                disabled={isSaving}
                placeholder="Zadejte barvu"
              />
            )}
          </div>
        )}

        {/* Collar Color (for litter identification) */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{t('collar.label')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`px-3 py-1.5 rounded border transition-colors ${!editedData.collar_color ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'}`}
              onClick={() => setEditedData(prev => ({ ...prev, collar_color: '' }))}
              disabled={isSaving}
            >
              {t('collar.none')}
            </button>
            {COLLAR_COLORS.map((color) => {
              const config = getCollarColor(color);
              if (!config) return null;
              return (
                <button
                  key={color}
                  type="button"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${editedData.collar_color === color ? 'ring-2 ring-primary ring-offset-2' : 'border-input hover:bg-accent'}`}
                  onClick={() => setEditedData(prev => ({ ...prev, collar_color: color }))}
                  disabled={isSaving}
                >
                  <div className={`w-4 h-4 rounded-full ${config.bg} ${config.darkBg} border-2 border-white dark:border-gray-800`} />
                  <span className="text-sm capitalize">{t(`collar.colors.${color}`)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('collar.hint')}</p>
        </div>

        {/* Age / Birth date */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Věk</p>
          <div className="flex gap-1 text-xs mb-1">
            <button
              type="button"
              className={`px-2 py-0.5 rounded border transition-colors ${editedData.ageMode === 'years' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'}`}
              onClick={() => setEditedData(prev => ({ ...prev, ageMode: 'years' }))}
              disabled={isSaving}
            >
              Odhadovaný věk
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded border transition-colors ${editedData.ageMode === 'date' ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'}`}
              onClick={() => setEditedData(prev => ({ ...prev, ageMode: 'date' }))}
              disabled={isSaving}
            >
              Datum narození
            </button>
          </div>
          {editedData.ageMode === 'years' ? (
            <>
              <Input
                type="text"
                value={editedData.ageYears}
                onChange={(e) => setEditedData(prev => ({ ...prev, ageYears: e.target.value }))}
                disabled={isSaving}
                placeholder="např. 1.5"
              />
              <p className="text-xs text-muted-foreground">roky (desetinné číslo)</p>
            </>
          ) : (
            <Input
              type="date"
              value={editedData.ageBirthDate}
              onChange={(e) => setEditedData(prev => ({ ...prev, ageBirthDate: e.target.value }))}
              disabled={isSaving}
            />
          )}
        </div>

        {/* Save/Cancel buttons */}
        <div className="col-span-1 md:col-span-2 flex gap-2 justify-end mt-4">
          <Button
            onClick={cancelEdit}
            disabled={isSaving}
            variant="outline"
          >
            <X className="h-4 w-4 mr-2" />
            Zrušit
          </Button>
          <Button
            onClick={saveEdit}
            disabled={isSaving}
          >
            <Check className="h-4 w-4 mr-2" />
            {isSaving ? 'Ukládám...' : 'Uložit'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Public Code - static */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Public Code</p>
        <p className="font-medium">#{animal.public_code}</p>
      </div>

      {/* Species - static */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Species</p>
        <p className="font-medium capitalize">{animal.species}</p>
      </div>

      {/* Sex - editable */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          Sex
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </p>
        <p className="font-medium">
          {animal.sex === 'male' ? '♂ Male' : animal.sex === 'female' ? '♀ Female' : '? Unknown'}
        </p>
      </div>

      {/* Color - editable */}
      {animal.color !== null && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Color
            <Button
              size="sm"
              variant="outline"
              onClick={startEdit}
              className="h-6 w-6 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
          </p>
          <p className="font-medium">{animal.color ? t(`colors.${animal.color}` as any) || animal.color : '—'}</p>
        </div>
      )}

      {/* Collar Color - editable */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          {t('collar.label')}
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </p>
        {animal.collar_color ? (
          <div className="flex items-center gap-2">
            {(() => {
              const config = getCollarColor(animal.collar_color);
              if (!config) return <span className="text-muted-foreground">—</span>;
              return (
                <>
                  <div className={`w-4 h-4 rounded-full ${config.bg} ${config.darkBg} border-2 border-white dark:border-gray-800`} />
                  <span className="font-medium capitalize">{t(`collar.colors.${animal.collar_color}`)}</span>
                </>
              );
            })()}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* Age (computed from birth_date_estimated) - editable */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          Věk
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </p>
        <p className="font-medium">
          {(() => {
            const bd = (animal as any).birth_date_estimated as string | null | undefined;
            if (!bd) return '—';
            const diffMs = Date.now() - new Date(bd).getTime();
            const years = diffMs / (365.25 * 24 * 60 * 60 * 1000);
            if (years < 1 / 12) {
              const days = Math.floor(years * 365.25);
              return `${days} ${days === 1 ? 'den' : days <= 4 ? 'dny' : 'dní'}`;
            }
            if (years < 1) {
              const months = Math.round(years * 12);
              return `${months} ${months === 1 ? 'měsíc' : months <= 4 ? 'měsíce' : 'měsíců'}`;
            }
            const yr = Math.round(years * 10) / 10;
            if (yr === 1) return '1 rok';
            if (yr <= 4) return `${yr} ${Number.isInteger(yr) ? 'roky' : 'roku'}`;
            return `${yr} let`;
          })()}
        </p>
      </div>

      {/* Intake Date - read-only (from stays data) */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Intake Date
        </p>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <p className="font-medium">{animal.current_intake_date ? new Date(animal.current_intake_date).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {/* Breed - editable */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          Breed
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </p>
        <p className="font-medium">
          {animal.breeds && animal.breeds.length > 0
            ? animal.breeds.map(b => {
                const found = breeds.find(br => br.id === b.breed_id);
                return found?.display_name || found?.name || b.breed_name || '—';
              }).join(', ')
            : <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      {/* Status - static */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Status</p>
        <Badge className={getStatusColor(animal.status)}>
          {animal.status}
        </Badge>
      </div>
    </div>
  );
}
