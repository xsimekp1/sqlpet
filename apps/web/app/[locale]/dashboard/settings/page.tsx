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
  Plus,
  KeyRound,
  Users,
  Shield,
  Palette,
  Coins,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useUIStore } from '@/app/stores/uiStore';
import { useAuth } from '@/app/context/AuthContext';
import { useTheme } from '@/app/hooks/useTheme';
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

const SPECIES_VALUES = ['dog', 'cat', 'rodent', 'bird', 'other'] as const;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const { weightUnit, setWeightUnit, currency, setCurrency, timeFormat, setTimeFormat } = useUIStore();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

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

  // Colors admin state
  interface ColorAdmin { code: string; cs: string | null; en: string | null; used_count: number }
  const [colorsAdmin, setColorsAdmin] = useState<ColorAdmin[]>([]);
  const [colorsSearch, setColorsSearch] = useState('');
  const [isLoadingColorsAdmin, setIsLoadingColorsAdmin] = useState(false);
  const [colorEdits, setColorEdits] = useState<Record<string, { cs: string; en: string }>>({});
  const [savingColorCode, setSavingColorCode] = useState<string | null>(null);
  const [newColorOpen, setNewColorOpen] = useState(false);
  const [newColorForm, setNewColorForm] = useState({ code: '', cs: '', en: '' });
  const [creatingColor, setCreatingColor] = useState(false);
  const [deletingColor, setDeletingColor] = useState<string | null>(null);

  // Members state
  interface MemberListItem { user_id: string; email: string; name: string; role_id?: string | null; role_name?: string | null; status: string }
  interface OrgRole { id: string; name: string }
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ name: '', email: '', password: '', role_id: '' });
  const [addingUser, setAddingUser] = useState(false);
  const [setPasswordTarget, setSetPasswordTarget] = useState<MemberListItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [changeRoleTarget, setChangeRoleTarget] = useState<MemberListItem | null>(null);
  const [changeRoleValue, setChangeRoleValue] = useState('');
  const [changingRole, setChangingRole] = useState(false);

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

  const loadColorsAdmin = useCallback(async () => {
    setIsLoadingColorsAdmin(true);
    try {
      const data = await ApiClient.getAdminColors();
      setColorsAdmin(data);
      const edits: Record<string, { cs: string; en: string }> = {};
      for (const c of data) {
        edits[c.code] = { cs: c.cs ?? '', en: c.en ?? '' };
      }
      setColorEdits(edits);
    } catch {
      // ignore
    } finally {
      setIsLoadingColorsAdmin(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const [membersRes, rolesRes] = await Promise.all([
        fetch(`${API_URL}/admin/members`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/roles`, { headers: getAuthHeaders() }),
      ]);
      if (membersRes.ok) setMembers(await membersRes.json());
      if (rolesRes.ok) setOrgRoles(await rolesRes.json());
    } catch { /* ignore */ } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  const handleAddUser = async () => {
    if (!addUserForm.name || !addUserForm.email || !addUserForm.password) {
      toast.error('Vyplňte všechna pole');
      return;
    }
    setAddingUser(true);
    try {
      const body: Record<string, string> = {
        name: addUserForm.name,
        email: addUserForm.email,
        password: addUserForm.password,
      };
      if (addUserForm.role_id) body.role_id = addUserForm.role_id;
      const res = await fetch(`${API_URL}/admin/members/create`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Chyba' }));
        toast.error(err.detail || 'Nepodařilo se vytvořit uživatele');
        return;
      }
      toast.success('Uživatel byl vytvořen');
      setAddUserOpen(false);
      setAddUserForm({ name: '', email: '', password: '', role_id: '' });
      await loadMembers();
    } catch { toast.error('Nepodařilo se vytvořit uživatele'); }
    finally { setAddingUser(false); }
  };

  const handleChangeRole = async () => {
    if (!changeRoleTarget) return;
    setChangingRole(true);
    try {
      const res = await fetch(`${API_URL}/admin/members/${changeRoleTarget.user_id}/role`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: changeRoleValue || null }),
      });
      if (!res.ok) {
        toast.error('Nepodařilo se změnit roli');
        return;
      }
      toast.success('Role byla změněna');
      setChangeRoleTarget(null);
      setChangeRoleValue('');
      await loadMembers();
    } catch { toast.error('Nepodařilo se změnit roli'); }
    finally { setChangingRole(false); }
  };

  const handleSetPassword = async () => {
    if (!setPasswordTarget || !newPassword) return;
    setSettingPassword(true);
    try {
      const res = await fetch(`${API_URL}/admin/members/${setPasswordTarget.user_id}/set-password`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });
      if (!res.ok) {
        toast.error('Nepodařilo se změnit heslo');
        return;
      }
      toast.success('Heslo bylo změněno');
      setSetPasswordTarget(null);
      setNewPassword('');
    } catch { toast.error('Nepodařilo se změnit heslo'); }
    finally { setSettingPassword(false); }
  };

  const saveColorTranslations = async (code: string) => {
    const edits = colorEdits[code];
    if (!edits) return;
    setSavingColorCode(code);
    try {
      await ApiClient.updateColorTranslation(code, {
        cs: edits.cs || null,
        en: edits.en || null,
      });
      toast.success(t('colorsAdmin.saveSuccess'));
    } catch {
      toast.error(t('colorsAdmin.saveError'));
    } finally {
      setSavingColorCode(null);
    }
  };

  const createNewColor = async () => {
    if (!newColorForm.code.trim()) {
      toast.error(t('colorsAdmin.codeRequired'));
      return;
    }
    setCreatingColor(true);
    try {
      await ApiClient.createColor({
        code: newColorForm.code.trim().toLowerCase(),
        cs: newColorForm.cs || undefined,
        en: newColorForm.en || undefined,
      });
      toast.success(t('colorsAdmin.createSuccess'));
      setNewColorOpen(false);
      setNewColorForm({ code: '', cs: '', en: '' });
      loadColorsAdmin();
    } catch (err: any) {
      toast.error(err.message || t('colorsAdmin.createError'));
    } finally {
      setCreatingColor(false);
    }
  };

  const deleteColor = async (code: string) => {
    if (!confirm(t('colorsAdmin.deleteConfirm'))) return;
    setDeletingColor(code);
    try {
      await ApiClient.deleteColor(code);
      toast.success(t('colorsAdmin.deleteSuccess'));
      loadColorsAdmin();
    } catch (err: any) {
      toast.error(err.message || t('colorsAdmin.deleteError'));
    } finally {
      setDeletingColor(null);
    }
  };

  const isSquare = dimensions ? dimensions.w === dimensions.h : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      <Tabs defaultValue="general" onValueChange={(v) => {
        if (v === 'breeds') loadBreedsAdmin();
        if (v === 'colors') loadColorsAdmin();
        if (v === 'members') loadMembers();
      }}>
        <TabsList>
          <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
          <TabsTrigger value="defaultImages">{t('tabs.defaultImages')}</TabsTrigger>
          {user?.is_superadmin && (
            <>
              <TabsTrigger value="breeds">{t('tabs.breeds')}</TabsTrigger>
              <TabsTrigger value="colors">{t('tabs.colors')}</TabsTrigger>
            </>
          )}
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-1.5" />
            {t('tabs.members')}
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="h-4 w-4 mr-1.5" />
            {t('tabs.roles')}
          </TabsTrigger>
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

              {/* Currency selector */}
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Coins className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{t('currency')}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('currencyDesc')}</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant={currency === 'CZK' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrency('CZK')}
                    >
                      Kč CZK
                    </Button>
                    <Button
                      variant={currency === 'EUR' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrency('EUR')}
                    >
                      € EUR
                    </Button>
                  </div>
                </div>
              </div>

              {/* Time format selector */}
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <KeyRound className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{t('timeFormat')}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('timeFormatDesc')}</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant={timeFormat === '24h' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTimeFormat('24h')}
                    >
                      {t('time24h')}
                    </Button>
                    <Button
                      variant={timeFormat === '12h' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTimeFormat('12h')}
                    >
                      {t('time12h')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Theme selector */}
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Palette className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Barevný profil</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Vyberte barevné schéma aplikace</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant={theme === 'teal' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme('teal')}
                      className={theme === 'teal' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                    >
                      <span className="w-3 h-3 rounded-full bg-teal-600 mr-2"></span>
                      Teal Shelter
                    </Button>
                    <Button
                      variant={theme === 'berry' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme('berry')}
                      className={theme === 'berry' ? 'bg-violet-600 hover:bg-violet-700' : ''}
                    >
                      <span className="w-3 h-3 rounded-full bg-violet-600 mr-2"></span>
                      Berry Rescue
                    </Button>
                    <Button
                      variant={theme === 'safari' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme('safari')}
                      className={theme === 'safari' ? 'bg-amber-700 hover:bg-amber-800' : ''}
                    >
                      <span className="w-3 h-3 rounded-full bg-amber-700 mr-2"></span>
                      Safari Shelter
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
        {/* ── Colors tab ── */}
        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('colorsAdmin.title')}</CardTitle>
              <Button size="sm" onClick={() => setNewColorOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t('colorsAdmin.addColor')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder={t('colorsAdmin.searchPlaceholder')}
                value={colorsSearch}
                onChange={(e) => setColorsSearch(e.target.value)}
              />

              {isLoadingColorsAdmin ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : colorsAdmin.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('colorsAdmin.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_1fr_1fr_80px_80px_auto] gap-2 px-1 text-xs text-muted-foreground font-medium">
                    <span>{t('colorsAdmin.colorCode')}</span>
                    <span>{t('colorsAdmin.nameCz')}</span>
                    <span>{t('colorsAdmin.nameEn')}</span>
                    <span>{t('colorsAdmin.used')}</span>
                    <span />
                    <span />
                  </div>
                  {colorsAdmin
                    .filter((c) => {
                      const q = colorsSearch.toLowerCase();
                      if (!q) return true;
                      return (
                        c.code.toLowerCase().includes(q) ||
                        (colorEdits[c.code]?.cs ?? '').toLowerCase().includes(q) ||
                        (colorEdits[c.code]?.en ?? '').toLowerCase().includes(q)
                      );
                    })
                    .map((color) => (
                      <div
                        key={color.code}
                        className="grid grid-cols-[1fr_1fr_1fr_80px_80px_auto] gap-2 items-center"
                      >
                        <span className="text-sm font-mono truncate">{color.code}</span>
                        <Input
                          value={colorEdits[color.code]?.cs ?? ''}
                          onChange={(e) =>
                            setColorEdits((prev) => ({
                              ...prev,
                              [color.code]: { ...prev[color.code], cs: e.target.value },
                            }))
                          }
                          className="h-8 text-sm"
                        />
                        <Input
                          value={colorEdits[color.code]?.en ?? ''}
                          onChange={(e) =>
                            setColorEdits((prev) => ({
                              ...prev,
                              [color.code]: { ...prev[color.code], en: e.target.value },
                            }))
                          }
                          className="h-8 text-sm"
                        />
                        <span className="text-sm text-muted-foreground text-center">
                          {color.used_count > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium dark:bg-blue-900 dark:text-blue-200">
                              {color.used_count}
                            </span>
                          ) : (
                            '-'
                          )}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2"
                          onClick={() => saveColorTranslations(color.code)}
                          disabled={savingColorCode === color.code}
                        >
                          {savingColorCode === color.code ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => deleteColor(color.code)}
                          disabled={deletingColor === color.code || color.used_count > 0}
                          title={color.used_count > 0 ? t('colorsAdmin.cannotDelete') : t('colorsAdmin.delete')}
                        >
                          {deletingColor === color.code ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* New Color Dialog */}
          <Dialog open={newColorOpen} onOpenChange={setNewColorOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('colorsAdmin.addColor')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('colorsAdmin.colorCode')} *</label>
                  <Input
                    value={newColorForm.code}
                    onChange={(e) => setNewColorForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g. black, brown-white, tricolor"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('colorsAdmin.nameCz')}</label>
                  <Input
                    value={newColorForm.cs}
                    onChange={(e) => setNewColorForm((prev) => ({ ...prev, cs: e.target.value }))}
                    placeholder="Český název"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('colorsAdmin.nameEn')}</label>
                  <Input
                    value={newColorForm.en}
                    onChange={(e) => setNewColorForm((prev) => ({ ...prev, en: e.target.value }))}
                    placeholder="English name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewColorOpen(false)}>{t('cancel')}</Button>
                <Button onClick={createNewColor} disabled={creatingColor}>
                  {creatingColor ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('colorsAdmin.create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Members tab ── */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Členové organizace
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await fetch(`${API_URL}/admin/roles/init-from-templates`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                      });
                      toast.success(t('initRolesSuccess'));
                      loadMembers();
                    } catch {
                      toast.error('Failed to initialize roles');
                    }
                  }}
                >
                  {t('initRoles')}
                </Button>
                <Button size="sm" onClick={() => setAddUserOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Přidat uživatele
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Žádní členové</p>
              ) : (
                <div className="divide-y divide-border">
                  {members.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                        {member.role_name && (
                          <Badge variant="secondary" className="text-xs mt-0.5">{member.role_name}</Badge>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setChangeRoleTarget(member);
                            setChangeRoleValue(member.role_id ?? '');
                          }}
                        >
                          Změnit roli
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSetPasswordTarget(member); setNewPassword(''); }}
                        >
                          <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                          Heslo
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Roles tab ── */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role a oprávnění
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RolesOverview />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add user dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Přidat uživatele</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Jméno *</Label>
              <Input
                value={addUserForm.name}
                onChange={e => setAddUserForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Jan Novák"
              />
            </div>
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={addUserForm.email}
                onChange={e => setAddUserForm(p => ({ ...p, email: e.target.value }))}
                placeholder="jan@priklad.cz"
              />
            </div>
            <div className="space-y-1">
              <Label>Heslo *</Label>
              <Input
                type="password"
                value={addUserForm.password}
                onChange={e => setAddUserForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Zadejte heslo"
              />
            </div>
            {orgRoles.length > 0 && (
              <div className="space-y-1">
                <Label>Role</Label>
                <Select
                  value={addUserForm.role_id}
                  onValueChange={v => setAddUserForm(p => ({ ...p, role_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Bez role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Bez role</SelectItem>
                    {orgRoles.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddUserOpen(false)} disabled={addingUser}>
                Zrušit
              </Button>
              <Button onClick={handleAddUser} disabled={addingUser}>
                {addingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vytvořit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set password dialog */}
      <Dialog open={!!setPasswordTarget} onOpenChange={(open) => !open && setSetPasswordTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Změnit heslo — {setPasswordTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Nové heslo *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Zadejte nové heslo"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setSetPasswordTarget(null)} disabled={settingPassword}>
                Zrušit
              </Button>
              <Button onClick={handleSetPassword} disabled={settingPassword || !newPassword}>
                {settingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Uložit heslo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change role dialog */}
      <Dialog open={!!changeRoleTarget} onOpenChange={(open) => !open && setChangeRoleTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Změnit roli — {changeRoleTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={changeRoleValue} onValueChange={v => setChangeRoleValue(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Bez role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Bez role</SelectItem>
                  {orgRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setChangeRoleTarget(null)} disabled={changingRole}>
                Zrušit
              </Button>
              <Button onClick={handleChangeRole} disabled={changingRole}>
                {changingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Uložit roli'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

// Helper to get readable permission name
function getPermissionLabel(key: string): string {
  const labels: Record<string, string> = {
    'org.manage': 'Správa organizace',
    'users.manage': 'Správa uživatelů',
    'animals.read': 'Čtení zvířat',
    'animals.write': 'Zápis zvířat',
    'intakes.write': 'Příjem zvířat',
    'outcomes.write': 'Výdej zvířat',
    'kennels.manage': 'Správa kotců',
    'medical.read': 'Čtení zdravotních záznamů',
    'medical.write': 'Zápis zdravotních záznamů',
    'inventory.read': 'Čtení skladu',
    'inventory.write': 'Zápis skladu',
    'people.read': 'Čtení kontaktů',
    'people.write': 'Zápis kontaktů',
    'forms.manage': 'Správa formulářů',
    'contracts.manage': 'Správa smluv',
    'reports.run': 'Spouštění reportů',
    'reports.schedule': 'Plánování reportů',
    'public.manage': 'Správa veřejného profilu',
    'ai.use': 'Použití AI',
    'payments.write': 'Zápis plateb',
    'audits.read': 'Čtení auditních logů',
    'tasks.read': 'Čtení úkolů',
    'tasks.write': 'Zápis úkolů',
    'feeding.read': 'Čtení krmení',
    'feeding.write': 'Zápis krmení',
    'chat.use': 'Použití chatu',
  };
  return labels[key] || key;
}

// Role overview component
function RolesOverview() {
  const [roles, setRoles] = useState<{id: string; name: string; description: string}[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, {key: string; allowed: boolean}[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      // Get all roles
      const rolesRes = await fetch(`${API_URL}/admin/roles`, { headers: getAuthHeaders() });
      const rolesData = await rolesRes.json();
      setRoles(rolesData);

      // Get permissions for each role
      const perms: Record<string, {key: string; allowed: boolean}[]> = {};
      for (const role of rolesData) {
        const permRes = await fetch(`${API_URL}/admin/roles/${role.id}/permissions`, { headers: getAuthHeaders() });
        perms[role.id] = await permRes.json();
      }
      setRolePermissions(perms);
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Žádné role v organizaci</p>
        <p className="text-sm">Klikněte na "Inicializovat standardní role" v záložce Členové</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {roles.map((role) => {
        const perms = rolePermissions[role.id] || [];
        const allowedPerms = perms.filter(p => p.allowed);
        const isExpanded = expandedRole === role.id;

        return (
          <div key={role.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedRole(isExpanded ? null : role.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">{role.name}</p>
                  {role.description && (
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {allowedPerms.length} oprávnění
                </Badge>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t bg-muted/20 p-4">
                {allowedPerms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Žádná oprávnění</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allowedPerms.map((perm) => (
                      <Badge key={perm.key} variant="outline" className="bg-background">
                        {getPermissionLabel(perm.key)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
