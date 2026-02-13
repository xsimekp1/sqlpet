'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Scale,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUIStore } from '@/app/stores/uiStore';
import ApiClient from '@/app/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

interface DefaultImage {
  id: string;
  species: string;
  breed_id: string | null;
  breed_name: string | null;
  color_pattern: string | null;
  public_url: string;
  filename_pattern: string | null;
  is_active: boolean;
  created_at: string;
}

interface Breed {
  id: string;
  name: string;
  species: string;
  display_name: string;
}

interface BreedTranslation {
  locale: string;
  name: string;
}

interface BreedAdmin {
  id: string;
  species: string;
  name: string;
  translations: BreedTranslation[];
}

const SPECIES_VALUES = ['dog', 'cat', 'rabbit', 'bird', 'other'] as const;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const { weightUnit, setWeightUnit } = useUIStore();

  // Default images state
  const [images, setImages] = useState<DefaultImage[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isLoadingBreeds, setIsLoadingBreeds] = useState(false);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [species, setSpecies] = useState('');
  const [breedId, setBreedId] = useState('');
  const [customBreed, setCustomBreed] = useState('');
  const [colorValue, setColorValue] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<DefaultImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Breeds admin state
  const [breedsAdmin, setBreedsAdmin] = useState<BreedAdmin[]>([]);
  const [breedsSearch, setBreedsSearch] = useState('');
  const [isLoadingBreedsAdmin, setIsLoadingBreedsAdmin] = useState(false);
  const [breedEdits, setBreedEdits] = useState<Record<string, { cs: string; en: string }>>({});
  const [savingBreedId, setSavingBreedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    setIsLoadingImages(true);
    try {
      const res = await fetch(`${API_URL}/admin/default-images`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load images');
      setImages(await res.json());
    } catch {
      // silently fail — user hasn't navigated to this tab yet
    } finally {
      setIsLoadingImages(false);
    }
  }, []);

  const loadColors = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/default-images/colors`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      setColors(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadImages();
    loadColors();
  }, [loadImages, loadColors]);

  useEffect(() => {
    if (!species) {
      setBreeds([]);
      setBreedId('');
      return;
    }
    setIsLoadingBreeds(true);
    ApiClient.getBreeds(species, locale)
      .then((data) => {
        setBreeds(data);
        setBreedId('');
      })
      .catch(() => setBreeds([]))
      .finally(() => setIsLoadingBreeds(false));
  }, [species, locale]);

  const readDimensions = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    const img = new window.Image();
    img.onload = () => {
      setDimensions({ w: img.width, h: img.height });
      URL.revokeObjectURL(url);
      setPreview(URL.createObjectURL(file));
    };
    img.onerror = () => {
      setDimensions(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setDimensions(null);
    readDimensions(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleFileSelect(file);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleSubmit = async () => {
    if (!selectedFile || !species) return;

    const effectiveColor =
      colorValue === 'other' ? customColor.trim() :
      colorValue === '' || colorValue === 'none' ? '' : colorValue;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('species', species);
    if (breedId === 'new') {
      if (customBreed.trim()) formData.append('breed_name', customBreed.trim());
    } else if (breedId && breedId !== 'none') {
      formData.append('breed_id', breedId);
    }
    if (effectiveColor) formData.append('color_pattern', effectiveColor);

    setIsUploading(true);
    try {
      const res = await fetch(`${API_URL}/admin/default-images`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: t('defaultImages.uploadError') }));
        toast.error(err.detail || t('defaultImages.uploadError'));
        return;
      }

      toast.success(t('defaultImages.uploadSuccess'));
      // Reset form
      setSelectedFile(null);
      setPreview(null);
      setDimensions(null);
      setSpecies('');
      setBreedId('');
      setCustomBreed('');
      setColorValue('');
      setCustomColor('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadImages();
      await loadColors();
    } catch {
      toast.error(t('defaultImages.uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (image: DefaultImage) => {
    setDeleteTarget(image);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/admin/default-images/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        toast.error(t('defaultImages.deleteError'));
        return;
      }
      toast.success(t('defaultImages.deleteSuccess'));
      setDeleteTarget(null);
      await loadImages();
    } catch {
      toast.error(t('defaultImages.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const loadBreedsAdmin = useCallback(async () => {
    setIsLoadingBreedsAdmin(true);
    try {
      const res = await fetch(`${API_URL}/admin/breeds`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data: BreedAdmin[] = await res.json();
      setBreedsAdmin(data);
      // Initialise edit state from existing translations
      const edits: Record<string, { cs: string; en: string }> = {};
      for (const b of data) {
        edits[b.id] = {
          cs: b.translations.find((t) => t.locale === 'cs')?.name ?? '',
          en: b.translations.find((t) => t.locale === 'en')?.name ?? '',
        };
      }
      setBreedEdits(edits);
    } catch {
      // ignore
    } finally {
      setIsLoadingBreedsAdmin(false);
    }
  }, []);

  const saveBreedTranslations = async (breedId: string) => {
    const edits = breedEdits[breedId];
    if (!edits) return;
    setSavingBreedId(breedId);
    try {
      const res = await fetch(`${API_URL}/admin/breeds/${breedId}/translations`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cs: edits.cs || null, en: edits.en || null }),
      });
      if (!res.ok) {
        toast.error(t('breedsAdmin.saveError'));
        return;
      }
      toast.success(t('breedsAdmin.saveSuccess'));
    } catch {
      toast.error(t('breedsAdmin.saveError'));
    } finally {
      setSavingBreedId(null);
    }
  };

  const isSquare = dimensions ? dimensions.w === dimensions.h : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      <Tabs defaultValue="general" onValueChange={(v) => { if (v === 'breeds') loadBreedsAdmin(); }}>
        <TabsList>
          <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
          <TabsTrigger value="defaultImages">{t('tabs.defaultImages')}</TabsTrigger>
          <TabsTrigger value="breeds">{t('tabs.breeds')}</TabsTrigger>
        </TabsList>

        {/* ── General tab ── */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t('preferences')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Scale className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{t('weightUnit')}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('weightUnitDesc')}</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant={weightUnit === 'kg' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setWeightUnit('kg')}
                    >
                      {t('kg')}
                    </Button>
                    <Button
                      variant={weightUnit === 'lbs' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setWeightUnit('lbs')}
                    >
                      {t('lbs')}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Default Images tab ── */}
        <TabsContent value="defaultImages" className="space-y-6">
          {/* Upload form */}
          <Card>
            <CardHeader>
              <CardTitle>{t('defaultImages.uploadTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Drop zone */}
                <div className="space-y-3">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      relative flex flex-col items-center justify-center border-2 border-dashed
                      rounded-lg cursor-pointer transition-colors min-h-40
                      ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'}
                    `}
                  >
                    {preview ? (
                      <Image
                        src={preview}
                        alt="preview"
                        fill
                        className="object-contain rounded-lg p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span className="text-sm font-medium">{t('defaultImages.dropZone')}</span>
                        <span className="text-xs">{t('defaultImages.dropZoneAccept')}</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                  />
                  {/* Dimension badge */}
                  {dimensions && (
                    <div className={`flex items-center gap-1.5 text-sm rounded-md px-2 py-1 w-fit ${
                      isSquare
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {isSquare ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      {isSquare
                        ? t('defaultImages.squareOk')
                        : `${t('defaultImages.notSquare')} (${dimensions.w}×${dimensions.h})`}
                    </div>
                  )}
                </div>

                {/* Form fields */}
                <div className="space-y-4">
                  {/* Species */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('defaultImages.species')}</label>
                    <Select value={species} onValueChange={setSpecies}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('defaultImages.speciesPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIES_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`defaultImages.species_${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Breed */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('defaultImages.breed')}</label>
                    <Select
                      value={breedId}
                      onValueChange={(v) => { setBreedId(v); if (v !== 'new') setCustomBreed(''); }}
                      disabled={!species || isLoadingBreeds}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingBreeds
                              ? t('defaultImages.breedLoading')
                              : t('defaultImages.breedPlaceholder')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('defaultImages.breedPlaceholder')}</SelectItem>
                        {breeds.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.display_name || b.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="new">{t('defaultImages.breedNew')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {breedId === 'new' && (
                      <Input
                        value={customBreed}
                        onChange={(e) => setCustomBreed(e.target.value)}
                        placeholder={t('defaultImages.breedNewPlaceholder')}
                        className="mt-1"
                      />
                    )}
                  </div>

                  {/* Color */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('defaultImages.color')}</label>
                    {colors.length > 0 ? (
                      <Select value={colorValue} onValueChange={setColorValue}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('defaultImages.colorPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('defaultImages.colorPlaceholder')}</SelectItem>
                          {colors.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                          <SelectItem value="other">{t('defaultImages.colorNew')}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                    {(colors.length === 0 || colorValue === 'other') && (
                      <Input
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        placeholder={t('defaultImages.colorNewPlaceholder')}
                        className="mt-1"
                      />
                    )}
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedFile || !species || isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t('defaultImages.uploading')}
                      </>
                    ) : (
                      t('defaultImages.submit')
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Existing images grid */}
          <div>
            <h2 className="text-lg font-semibold mb-3">{t('defaultImages.listTitle')}</h2>
            {isLoadingImages ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : images.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('defaultImages.listEmpty')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative border rounded-lg overflow-hidden bg-muted/30"
                  >
                    <div className="relative aspect-square w-full">
                      <Image
                        src={img.public_url}
                        alt={img.filename_pattern || img.species}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="p-2 space-y-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {t(`defaultImages.species_${img.species}`)}
                        </Badge>
                        {img.color_pattern && (
                          <Badge variant="outline" className="text-xs">
                            {img.color_pattern}
                          </Badge>
                        )}
                      </div>
                      {img.breed_name && (
                        <p className="text-xs text-muted-foreground truncate">{img.breed_name}</p>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => handleDelete(img)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {t('defaultImages.deleteConfirm')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Breeds tab ── */}
        <TabsContent value="breeds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('breedsAdmin.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder={t('breedsAdmin.searchPlaceholder')}
                value={breedsSearch}
                onChange={(e) => setBreedsSearch(e.target.value)}
              />

              {isLoadingBreedsAdmin ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : breedsAdmin.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('breedsAdmin.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-xs text-muted-foreground font-medium">
                    <span>{t('breedsAdmin.breedName')}</span>
                    <span>{t('breedsAdmin.nameCz')}</span>
                    <span>{t('breedsAdmin.nameEn')}</span>
                    <span />
                  </div>
                  {breedsAdmin
                    .filter((b) => {
                      const q = breedsSearch.toLowerCase();
                      if (!q) return true;
                      return (
                        b.name.toLowerCase().includes(q) ||
                        (breedEdits[b.id]?.cs ?? '').toLowerCase().includes(q) ||
                        (breedEdits[b.id]?.en ?? '').toLowerCase().includes(q)
                      );
                    })
                    .map((breed) => (
                      <div
                        key={breed.id}
                        className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
                      >
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {breed.species}
                          </Badge>
                          <span className="text-sm font-mono truncate">{breed.name}</span>
                        </div>
                        <Input
                          value={breedEdits[breed.id]?.cs ?? ''}
                          onChange={(e) =>
                            setBreedEdits((prev) => ({
                              ...prev,
                              [breed.id]: { ...prev[breed.id], cs: e.target.value },
                            }))
                          }
                          className="h-8 text-sm"
                        />
                        <Input
                          value={breedEdits[breed.id]?.en ?? ''}
                          onChange={(e) =>
                            setBreedEdits((prev) => ({
                              ...prev,
                              [breed.id]: { ...prev[breed.id], en: e.target.value },
                            }))
                          }
                          className="h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2"
                          onClick={() => saveBreedTranslations(breed.id)}
                          disabled={savingBreedId === breed.id}
                        >
                          {savingBreedId === breed.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation inline dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">{t('defaultImages.deleteConfirmTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('defaultImages.deleteConfirmDesc')}</p>
            {deleteTarget.filename_pattern && (
              <p className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {deleteTarget.filename_pattern}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                {t('defaultImages.deleteCancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('defaultImages.deleteConfirm')
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
