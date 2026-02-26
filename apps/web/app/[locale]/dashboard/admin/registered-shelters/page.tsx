'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { MapPin, Building2, Search, Filter, Loader2, Upload, Plus, Map, List, Phone, Globe, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ApiClient from '@/app/lib/api';

// Dynamic import for map to avoid SSR issues
const SheltersMap = dynamic(() => import('./SheltersMap'), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-muted animate-pulse rounded-lg" />
});

interface RegisteredShelter {
  id: string;
  registration_number: string;
  name: string;
  address: string;
  region: string;
  activity_type: string | null;
  capacity: string | null;
  lat: number | null;
  lng: number | null;
  registration_date: string | null;
  notes?: string | null;
  phone?: string | null;
  website?: string | null;
}

export default function RegisteredSheltersPage() {
  const t = useTranslations('admin');
  const [shelters, setShelters] = useState<RegisteredShelter[]>([]);
  const [regions, setRegions] = useState<{ region: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newShelter, setNewShelter] = useState({
    registration_number: '',
    name: '',
    address: '',
    region: '',
    activity_type: '',
    capacity: '',
    lat: '',
    lng: '',
    phone: '',
    website: '',
    notes: '',
  });

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShelterId, setEditingShelterId] = useState<string | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [editForm, setEditForm] = useState({ notes: '', phone: '', website: '' });

  useEffect(() => {
    loadRegions();
  }, []);

  useEffect(() => {
    if (selectedRegion && selectedRegion !== 'all') {
      loadShelters(selectedRegion);
    } else {
      loadShelters();
    }
  }, [selectedRegion]);

  const loadRegions = async () => {
    try {
      const data = await ApiClient.getShelterRegions();
      setRegions(data);
    } catch (error) {
      console.error('Failed to load regions:', error);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Pouze CSV soubory jsou povoleny');
      return;
    }

    setImporting(true);
    try {
      const result = await ApiClient.importRegisteredShelters(file);

      let message = `Importováno ${result.imported} záznamů`;
      if (result.skipped && result.skipped > 0) {
        message += `, přeskočeno ${result.skipped}`;
      }
      if (result.total_errors && result.total_errors > 0) {
        message += `, chyb ${result.total_errors}`;
        toast.warning(message);
        console.error('Import errors:', result.errors);
      } else {
        toast.success(message);
      }

      loadShelters();
      loadRegions();
    } catch (error: any) {
      console.error('Failed to import:', error);

      const errorDetail = error.response?.data?.detail;
      if (errorDetail && typeof errorDetail === 'object') {
        toast.error(`Import selhal: ${errorDetail.error || 'Neznámá chyba'}`, {
          description: errorDetail.message || errorDetail.help
        });
      } else {
        toast.error('Nepodařilo se importovat data');
      }
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!newShelter.registration_number || !newShelter.name || !newShelter.address || !newShelter.region) {
      toast.error('Vyplňte povinné údaje');
      return;
    }
    setSaving(true);
    try {
      await ApiClient.createRegisteredShelter({
        ...newShelter,
        lat: newShelter.lat ? parseFloat(newShelter.lat) : null,
        lng: newShelter.lng ? parseFloat(newShelter.lng) : null,
      });
      toast.success('Útulek přidán');
      setDialogOpen(false);
      setNewShelter({ registration_number: '', name: '', address: '', region: '', activity_type: '', capacity: '', lat: '', lng: '', phone: '', website: '', notes: '' });
      loadShelters();
      loadRegions();
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Nepodařilo se uložit');
    } finally {
      setSaving(false);
    }
  };

  const handleEditOpen = (shelter: RegisteredShelter) => {
    setEditingShelterId(shelter.id);
    setEditForm({
      notes: shelter.notes ?? '',
      phone: shelter.phone ?? '',
      website: shelter.website ?? '',
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingShelterId) return;
    setEditingSaving(true);
    try {
      await ApiClient.updateRegisteredShelter(editingShelterId, {
        notes: editForm.notes || null,
        phone: editForm.phone || null,
        website: editForm.website || null,
      });
      setShelters((prev) =>
        prev.map((s) =>
          s.id === editingShelterId
            ? { ...s, notes: editForm.notes || null, phone: editForm.phone || null, website: editForm.website || null }
            : s
        )
      );
      toast.success('Uloženo');
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Failed to update shelter:', error);
      toast.error('Nepodařilo se uložit');
    } finally {
      setEditingSaving(false);
    }
  };

  const loadShelters = async (region?: string) => {
    setLoading(true);
    try {
      const data = await ApiClient.getRegisteredShelters(region && region !== 'all' ? region : undefined);
      setShelters(data);
    } catch (error) {
      console.error('Failed to load shelters:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShelters = shelters.filter((shelter) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      shelter.name.toLowerCase().includes(query) ||
      shelter.registration_number.toLowerCase().includes(query) ||
      shelter.address.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registr útulků</h1>
          <p className="text-muted-foreground">
            Veterinární registrace útulků pro zvířata ({shelters.length} záznamů)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelected}
          className="hidden"
        />
        <Button onClick={handleImportClick} disabled={importing} className="gap-2">
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Importovat z CSV
        </Button>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Přidat útulek
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hledat podle názvu, čísla, adresy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Všechny kraje" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny kraje</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r.region} value={r.region}>
                {r.region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{shelters.length}</div>
            <p className="text-sm text-muted-foreground">Celkem útulků</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{regions.length}</div>
            <p className="text-sm text-muted-foreground">Krajů</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {shelters.filter((s) => s.lat && s.lng).length}
            </div>
            <p className="text-sm text-muted-foreground">S GPS souřadnicemi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {shelters.filter((s) => s.capacity?.includes('pes')).length}
            </div>
            <p className="text-sm text-muted-foreground">Pro psy</p>
          </CardContent>
        </Card>
      </div>

      {/* List / Map Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Seznam
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <Map className="h-4 w-4" />
            Mapa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredShelters.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Žádné útulky nenalezeny</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredShelters.map((shelter) => (
                <Card key={shelter.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{shelter.name}</h3>
                          <Badge variant="outline" className="font-mono text-xs">
                            {shelter.registration_number}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {shelter.address}
                        </div>
                        {(shelter.phone || shelter.website) && (
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {shelter.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {shelter.phone}
                              </span>
                            )}
                            {shelter.website && (
                              <a
                                href={shelter.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-foreground hover:underline"
                              >
                                <Globe className="h-3 w-3" />
                                {shelter.website.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <Badge variant="secondary">{shelter.region}</Badge>
                          {shelter.activity_type && (
                            <span className="text-muted-foreground">{shelter.activity_type}</span>
                          )}
                          {shelter.registration_date && (
                            <span className="text-muted-foreground">
                              Registrován: {new Date(shelter.registration_date).toLocaleDateString('cs-CZ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEditOpen(shelter)}
                          title="Upravit kontakt & poznámky"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {shelter.capacity && (
                          <p className="text-sm font-medium">{shelter.capacity}</p>
                        )}
                        {shelter.lat && shelter.lng ? (
                          <Badge className="bg-green-500">GPS ✓</Badge>
                        ) : (
                          <Badge variant="outline">Bez GPS</Badge>
                        )}
                      </div>
                    </div>
                    {shelter.notes && (
                      <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                        <span className="font-medium">Poznámky:</span> {shelter.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          {loading ? (
            <div className="h-[500px] bg-muted animate-pulse rounded-lg" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Mapa registrovaných útulků
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SheltersMap
                  shelters={filteredShelters.filter((s): s is RegisteredShelter & { lat: number; lng: number } =>
                    s.lat !== null && s.lng !== null
                  )}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Shelter Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Přidat nový útulek</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="regNumber">Registrační číslo *</Label>
              <Input
                id="regNumber"
                value={newShelter.registration_number}
                onChange={(e) => setNewShelter({ ...newShelter, registration_number: e.target.value })}
                placeholder="CZ 31C03695"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Název *</Label>
              <Input
                id="name"
                value={newShelter.name}
                onChange={(e) => setNewShelter({ ...newShelter, name: e.target.value })}
                placeholder="Název útulku"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Adresa *</Label>
              <Input
                id="address"
                value={newShelter.address}
                onChange={(e) => setNewShelter({ ...newShelter, address: e.target.value })}
                placeholder="Ulice 123, Město"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="region">Kraj *</Label>
              <Input
                id="region"
                value={newShelter.region}
                onChange={(e) => setNewShelter({ ...newShelter, region: e.target.value })}
                placeholder="Jihočeský kraj"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="activity">Druh činnosti</Label>
              <Input
                id="activity"
                value={newShelter.activity_type}
                onChange={(e) => setNewShelter({ ...newShelter, activity_type: e.target.value })}
                placeholder="útulek pro zájmová zvířata"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity">Kapacita</Label>
              <Input
                id="capacity"
                value={newShelter.capacity}
                onChange={(e) => setNewShelter({ ...newShelter, capacity: e.target.value })}
                placeholder="pes 10, kočka 50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lat">Zem. šířka</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.0001"
                  value={newShelter.lat}
                  onChange={(e) => setNewShelter({ ...newShelter, lat: e.target.value })}
                  placeholder="50.0755"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lng">Zem. délka</Label>
                <Input
                  id="lng"
                  type="number"
                  step="0.0001"
                  value={newShelter.lng}
                  onChange={(e) => setNewShelter({ ...newShelter, lng: e.target.value })}
                  placeholder="14.4378"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPhone">Telefon</Label>
              <Input
                id="newPhone"
                value={newShelter.phone}
                onChange={(e) => setNewShelter({ ...newShelter, phone: e.target.value })}
                placeholder="+420 123 456 789"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newWebsite">Web</Label>
              <Input
                id="newWebsite"
                value={newShelter.website}
                onChange={(e) => setNewShelter({ ...newShelter, website: e.target.value })}
                placeholder="https://www.utulek.cz"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Poznámky</Label>
              <Textarea
                id="notes"
                value={newShelter.notes}
                onChange={(e) => setNewShelter({ ...newShelter, notes: e.target.value })}
                placeholder="Vaše poznámky k tomuto útulku..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Uložit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact & Notes Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kontakt &amp; poznámky</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editPhone">Telefon</Label>
              <Input
                id="editPhone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+420 123 456 789"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editWebsite">Web</Label>
              <Input
                id="editWebsite"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                placeholder="https://www.utulek.cz"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editNotes">Poznámky</Label>
              <Textarea
                id="editNotes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Vaše poznámky k tomuto útulku..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Zrušit</Button>
            <Button onClick={handleEditSave} disabled={editingSaving}>
              {editingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Uložit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
