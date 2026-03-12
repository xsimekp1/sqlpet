'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Calendar, Check, Plus, Dog, Cat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { canViewSensitiveInfo, maskPhone } from '@/app/lib/permissions';
import { cn } from '@/lib/utils';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const org = typeof window !== 'undefined' ? localStorage.getItem('selectedOrg') : null;
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (org) {
    try {
      headers['x-organization-id'] = JSON.parse(org).id;
    } catch {}
  }
  return headers;
}

interface Kennel {
  id: string;
  name: string;
  code: string;
  zone_name: string;
  capacity: number;
  type: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface Animal {
  id: string;
  name: string;
  species: string;
  status: string;
  public_code: string;
}

interface Organization {
  id: string;
  name: string;
  hotel_price_per_day: number | null;
}

export default function NewHotelReservationPage() {
  const t = useTranslations('hotel');
  const router = useRouter();
  const { selectedOrg } = useAuth();
  const canViewSensitive = canViewSensitiveInfo(selectedOrg?.role);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [availableKennels, setAvailableKennels] = useState<Kennel[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);

  // Step 1: Quick check
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');

  // Step 2: Animal details
  const [animalMode, setAnimalMode] = useState<'new' | 'db'>('new');
  const [animalId, setAnimalId] = useState('');
  const [animalName, setAnimalName] = useState('');
  const [animalBreed, setAnimalBreed] = useState('');
  const [animalNotes, setAnimalNotes] = useState('');

  // Step 3: Kennel
  const [kennelId, setKennelId] = useState('');
  const [requiresSingleCage, setRequiresSingleCage] = useState(false);
  const [ownFood, setOwnFood] = useState(false);

  // Step 4: Contact
  const [contactId, setContactId] = useState('');

  // Step 5: Price
  const [pricePerDay, setPricePerDay] = useState('');
  const [notes, setNotes] = useState('');

  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    type: 'other',
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const [orgRes, contactsRes, animalsRes] = await Promise.all([
        fetch('/api/organization/current', { headers: getAuthHeaders() }),
        fetch('/api/contacts?page_size=100', { headers: getAuthHeaders() }),
        fetch('/api/animals?page_size=500', { headers: getAuthHeaders() }),
      ]);

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setOrganization(orgData);
        if (orgData.hotel_price_per_day) {
          setPricePerDay(String(orgData.hotel_price_per_day));
        }
      }

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(contactsData.items || []);
      }

      if (animalsRes.ok) {
        const animalsData = await animalsRes.json();
        setAnimals(animalsData.items || []);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Auto-check availability when date + species change
  const checkAvailability = useCallback(async () => {
    if (!dateFrom || !dateTo) return;

    setCheckingAvailability(true);
    setKennelId(''); // Reset kennel selection
    try {
      const res = await fetch('/api/kennels', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load kennels');
      const data = await res.json();
      const allKennels = Array.isArray(data) ? data : (data.items || []);

      const available: Kennel[] = [];
      for (const kennel of allKennels) {
        // Filter by species suitability
        if (species === 'cat' && kennel.type === 'standard') {
          continue; // Standard kennels are for dogs
        }

        const checkRes = await fetch(
          `/api/hotel/reservations/kennels/${kennel.id}/availability?from_date=${dateFrom}&to_date=${dateTo}`,
          { headers: getAuthHeaders() }
        );
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.is_available) {
            available.push(kennel);
          }
        }
      }

      setAvailableKennels(available);
    } catch (err) {
      console.error('Availability check failed:', err);
      toast.error('Nepodařilo se zkontrolovat dostupnost');
    } finally {
      setCheckingAvailability(false);
    }
  }, [dateFrom, dateTo, species]);

  // Trigger availability check when date or species changes
  useEffect(() => {
    if (dateFrom && dateTo) {
      const timeout = setTimeout(() => {
        checkAvailability();
      }, 300); // Debounce
      return () => clearTimeout(timeout);
    }
  }, [dateFrom, dateTo, species, checkAvailability]);

  const handleCreateContact = async () => {
    if (!newContact.name) {
      toast.error('Zadejte jméno kontaktu');
      return;
    }
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: newContact.name,
          phone: newContact.phone || null,
          email: newContact.email || null,
          type: newContact.type,
        }),
      });
      if (!res.ok) throw new Error('Failed to create contact');
      const created = await res.json();
      setContacts(prev => [...prev, created]);
      setContactId(created.id);
      setShowNewContact(false);
      setNewContact({ name: '', phone: '', email: '', type: 'other' });
      toast.success('Kontakt vytvořen');
    } catch {
      toast.error('Nepodařilo se vytvořit kontakt');
    }
  };

  const handleSubmit = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Vyplňte datum pobytu');
      return;
    }
    if (!kennelId) {
      toast.error('Vyberte kotec');
      return;
    }

    const finalAnimalName = animalMode === 'db' && animalId
      ? animals.find(a => a.id === animalId)?.name || ''
      : animalName;

    if (!finalAnimalName) {
      toast.error('Zadejte jméno zvířete');
      return;
    }

    setLoading(true);
    try {
      const animal = animalMode === 'db' && animalId
        ? animals.find(a => a.id === animalId)
        : null;

      const payload = {
        kennel_id: kennelId,
        contact_id: contactId || null,
        animal_name: finalAnimalName,
        animal_species: animal?.species || species,
        animal_breed: animalBreed || null,
        animal_notes: animalNotes || null,
        reserved_from: dateFrom,
        reserved_to: dateTo,
        price_per_day: pricePerDay ? parseFloat(pricePerDay) : null,
        requires_single_cage: requiresSingleCage,
        own_food: ownFood,
        notes: notes || null,
      };

      const res = await fetch('/api/hotel/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed' }));
        throw new Error(err.detail || 'Failed to create reservation');
      }

      toast.success('Rezervace vytvořena');
      router.push('/dashboard/hotel/reservations');
    } catch (error: any) {
      toast.error(error.message || 'Nepodařilo se vytvořit rezervaci');
    } finally {
      setLoading(false);
    }
  };

  const totalDays = dateFrom && dateTo
    ? Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0;
  const totalPrice = pricePerDay ? parseFloat(pricePerDay) * totalDays : null;

  // Filter animals by selected species
  const filteredAnimals = animals.filter(a => a.species === species);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hotel/reservations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nová rezervace</h1>
          <p className="text-muted-foreground">Hotelový pobyt pro zvíře</p>
        </div>
      </div>

      {/* Step 1: Quick availability check */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            1. Rychlá kontrola dostupnosti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Od *</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Do *</Label>
              <Input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Species selection - big buttons */}
          <div className="space-y-2">
            <Label>Druh zvířete *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSpecies('dog')}
                className={cn(
                  "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                  species === 'dog'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted hover:border-primary/50"
                )}
              >
                <Dog className="h-6 w-6" />
                <span className="font-medium">Pes</span>
              </button>
              <button
                type="button"
                onClick={() => setSpecies('cat')}
                className={cn(
                  "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                  species === 'cat'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted hover:border-primary/50"
                )}
              >
                <Cat className="h-6 w-6" />
                <span className="font-medium">Kočka</span>
              </button>
            </div>
          </div>

          {/* Availability result */}
          {dateFrom && dateTo && (
            <div className={cn(
              "p-4 rounded-lg border-2 transition-all",
              checkingAvailability ? "border-muted bg-muted/50" :
              availableKennels.length > 0 ? "border-green-500 bg-green-50" : "border-red-300 bg-red-50"
            )}>
              {checkingAvailability ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kontroluji dostupnost...
                </div>
              ) : availableKennels.length > 0 ? (
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">
                    {availableKennels.length} {availableKennels.length === 1 ? 'kotec volný' :
                      availableKennels.length < 5 ? 'kotce volné' : 'kotců volných'}
                  </span>
                </div>
              ) : (
                <div className="text-red-700">
                  Žádné volné kotce pro {species === 'dog' ? 'psa' : 'kočku'} v tomto termínu
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Animal details - only show if we have availability */}
      {availableKennels.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>2. Zvíře</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={animalMode === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setAnimalMode('new'); setAnimalId(''); }}
              >
                Nové zvíře
              </Button>
              <Button
                type="button"
                variant={animalMode === 'db' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setAnimalMode('db'); setAnimalName(''); }}
                disabled={filteredAnimals.length === 0}
              >
                Z databáze ({filteredAnimals.length})
              </Button>
            </div>

            {animalMode === 'db' ? (
              <div className="space-y-2">
                <Label>Vyberte zvíře *</Label>
                <Select value={animalId} onValueChange={setAnimalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte zvíře" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAnimals.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} (#{a.public_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jméno *</Label>
                  <Input
                    value={animalName}
                    onChange={(e) => setAnimalName(e.target.value)}
                    placeholder="např. Rex"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plemeno</Label>
                  <Input
                    value={animalBreed}
                    onChange={(e) => setAnimalBreed(e.target.value)}
                    placeholder="volitelné"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Poznámky ke zvířeti</Label>
              <Input
                value={animalNotes}
                onChange={(e) => setAnimalNotes(e.target.value)}
                placeholder="speciální strava, léky, chování..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Kennel selection */}
      {availableKennels.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>3. Kotec</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Vyberte kotec *</Label>
              <Select value={kennelId} onValueChange={setKennelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte kotec" />
                </SelectTrigger>
                <SelectContent>
                  {availableKennels.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.code || k.name} {k.zone_name ? `(${k.zone_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresSingleCage}
                  onChange={(e) => setRequiresSingleCage(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Požadavek na samostatný kotec</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ownFood}
                  onChange={(e) => setOwnFood(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Vlastní krmivo (majitel přiveze)</span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Contact - optional */}
      {kennelId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>4. Majitel (volitelné)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte kontakt" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${canViewSensitive ? c.phone : maskPhone(c.phone)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={showNewContact} onOpenChange={setShowNewContact}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nový kontakt</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Jméno *</Label>
                      <Input
                        value={newContact.name}
                        onChange={(e) => setNewContact(p => ({ ...p, name: e.target.value }))}
                        placeholder="Jméno kontaktu"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefon</Label>
                      <Input
                        value={newContact.phone}
                        onChange={(e) => setNewContact(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+420..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact(p => ({ ...p, email: e.target.value }))}
                        placeholder="email@..."
                      />
                    </div>
                    <Button onClick={handleCreateContact} className="w-full">
                      Vytvořit kontakt
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Price summary */}
      {kennelId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>5. Cena</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cena za den (Kč)</Label>
              <Input
                type="number"
                value={pricePerDay}
                onChange={(e) => setPricePerDay(e.target.value)}
                placeholder={organization?.hotel_price_per_day ? String(organization.hotel_price_per_day) : '300'}
              />
            </div>

            {totalPrice !== null && totalPrice > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>{pricePerDay} Kč × {totalDays} {totalDays === 1 ? 'den' : totalDays < 5 ? 'dny' : 'dní'}</span>
                  <span className="font-bold">{totalPrice} Kč</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Poznámky k rezervaci</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="volitelné"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-background border-t p-4 z-50">
        <div className="max-w-2xl mx-auto flex gap-4">
          <Button
            onClick={handleSubmit}
            disabled={loading || !kennelId || (!animalName && !animalId)}
            className="flex-1"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vytvořit rezervaci
          </Button>
          <Link href="/dashboard/hotel/reservations">
            <Button variant="outline">Zrušit</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
