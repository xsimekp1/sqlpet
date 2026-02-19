'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Calendar, DollarSign, User, Home, AlertCircle, Plus } from 'lucide-react';
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
  zone: string;
  capacity: number;
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
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [kennels, setKennels] = useState<Kennel[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [availableKennels, setAvailableKennels] = useState<Kennel[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);

  const [formData, setFormData] = useState({
    reserved_from: '',
    reserved_to: '',
    kennel_id: '',
    animal_mode: 'manual' as 'db' | 'manual',
    animal_id: '',
    animal_name: '',
    animal_species: 'dog',
    animal_breed: '',
    animal_notes: '',
    contact_id: '',
    price_per_day: '',
    requires_single_cage: false,
    own_food: false,
    notes: '',
    checkin_time: '14:00',
    checkout_time: '10:00',
  });

  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    type: 'other',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const [orgRes, contactsRes, animalsRes] = await Promise.all([
        fetch('/api/organization/current', { headers: getAuthHeaders() }),
        fetch('/api/contacts?page_size=100', { headers: getAuthHeaders() }),
        fetch('/api/animals?status=with_owner&status=adopted&status=hotel&page_size=200', { headers: getAuthHeaders() }),
      ]);

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setOrganization(orgData);
        if (orgData.hotel_price_per_day) {
          setFormData(prev => ({ ...prev, price_per_day: String(orgData.hotel_price_per_day) }));
        }
      }

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(contactsData.items || []);
      }

      if (animalsRes.ok) {
        const animalsData = await animalsRes.json();
        const fetchedAnimals = animalsData.items || [];
        setAnimals(fetchedAnimals);
        if (fetchedAnimals.length === 0) {
          toast.info('Žádná zvířata v databázi - můžete zadat nové');
        }
      } else {
        toast.error('Nepodařilo se načíst zvířata z databáze');
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const checkAvailability = async () => {
    // Nejprve musíme vybrat zvíře/druh - pes/kočka
    const animalSpecies = formData.animal_mode === 'db' 
      ? animals.find(a => a.id === formData.animal_id)?.species 
      : formData.animal_species;
    
    if (!animalSpecies) {
      toast.error('Nejprve vyberte nebo zadejte druh zvířete (pes/kočka)');
      return;
    }

    if (!formData.reserved_from || !formData.reserved_to) {
      toast.error('Nejprve vyberte datum');
      return;
    }

    setCheckingAvailability(true);
    try {
      const res = await fetch('/api/kennels', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      const allKennels = Array.isArray(data) ? data : (data.items || []);

      const available = [];
      for (const kennel of allKennels) {
        // Kočky potřebují single cage - přeskočíme pokud kennel nepodporuje
        if (animalSpecies === 'cat' && kennel.type === 'standard') {
          continue; // standard kotce jsou pro psy, kočky potřebují single
        }
        
        const checkRes = await fetch(
          `/api/hotel/reservations/kennels/${kennel.id}/availability?from_date=${formData.reserved_from}&to_date=${formData.reserved_to}`,
          { headers: getAuthHeaders() }
        );
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.is_available) {
            available.push(kennel);
          }
        }
      }
      
      if (available.length === 0) {
        toast.info('Žádné dostupné kotce pro zvolené datum a druh zvířete');
      }
      setAvailableKennels(available);
    } catch (err) {
      console.error('Availability check failed:', err);
      toast.error('Nepodařilo se zkontrolovat dostupnost');
    } finally {
      setCheckingAvailability(false);
    }
  };

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
      setFormData(prev => ({ ...prev, contact_id: created.id }));
      setShowNewContact(false);
      setNewContact({ name: '', phone: '', email: '', type: 'other' });
      toast.success('Kontakt vytvořen');
    } catch {
      toast.error('Nepodařilo se vytvořit kontakt');
    }
  };

  const handleSubmit = async () => {
    if (!formData.reserved_from || !formData.reserved_to || !formData.kennel_id) {
      toast.error('Vyplňte prosím datum a vyberte kotec');
      return;
    }

    const animalName = formData.animal_mode === 'db' && formData.animal_id
      ? animals.find(a => a.id === formData.animal_id)?.name || ''
      : formData.animal_name;

    if (!animalName) {
      toast.error('Vyberte zvíře nebo zadejte jméno');
      return;
    }

    setLoading(true);
    try {
      const animal = formData.animal_mode === 'db' && formData.animal_id
        ? animals.find(a => a.id === formData.animal_id)
        : null;

      const payload = {
        kennel_id: formData.kennel_id,
        contact_id: formData.contact_id || null,
        animal_name: animalName,
        animal_species: animal?.species || formData.animal_species,
        animal_breed: formData.animal_breed || null,
        animal_notes: formData.animal_notes || null,
        reserved_from: formData.reserved_from,
        reserved_to: formData.reserved_to,
        price_per_day: formData.price_per_day ? parseFloat(formData.price_per_day) : null,
        requires_single_cage: formData.requires_single_cage,
        own_food: formData.own_food,
        notes: formData.notes || null,
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

  const totalDays = formData.reserved_from && formData.reserved_to
    ? (new Date(formData.reserved_to).getTime() - new Date(formData.reserved_from).getTime()) / (1000 * 60 * 60 * 24) + 1
    : 0;
  const totalPrice = formData.price_per_day ? parseFloat(formData.price_per_day) * totalDays : null;

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hotel/reservations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nová hotelová rezervace</h1>
          <p className="text-muted-foreground">Vytvoření rezervace hotelového pobytu</p>
        </div>
      </div>

      {/* Step 1: Date */}
      <Card>
        <CardHeader>
          <CardTitle>1. Termín pobytu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum od *</Label>
              <Input
                type="date"
                value={formData.reserved_from}
                onChange={(e) => { 
                  setFormData(p => ({ ...p, reserved_from: e.target.value, kennel_id: '' })); 
                  setAvailableKennels([]);
                }}
              />
              <p className="text-xs text-muted-foreground">Check-in: {formData.checkin_time}</p>
            </div>
            <div className="space-y-2">
              <Label>Datum do *</Label>
              <Input
                type="date"
                value={formData.reserved_to}
                onChange={(e) => { 
                  setFormData(p => ({ ...p, reserved_to: e.target.value, kennel_id: '' })); 
                  setAvailableKennels([]);
                }}
              />
              <p className="text-xs text-muted-foreground">Check-out: {formData.checkout_time}</p>
            </div>
          </div>

          {formData.reserved_from && formData.reserved_to && (
            <Button
              type="button"
              variant="outline"
              onClick={checkAvailability}
              disabled={checkingAvailability}
              className="w-full"
            >
              {checkingAvailability ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
              Zkontrolovat dostupné kotce
            </Button>
          )}

          {availableKennels.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                Nalezeno {availableKennels.length} dostupných kotců
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Animal - MUST be selected BEFORE checking availability */}
      {formData.reserved_from && formData.reserved_to && (
        <Card>
          <CardHeader>
            <CardTitle>2. Zvíře</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="animal_mode"
                  checked={formData.animal_mode === 'manual'}
                  onChange={() => setFormData(p => ({ ...p, animal_mode: 'manual', animal_id: '' }))}
                />
                <span className="text-sm">Nové zvíře (zatím jen jméno)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="animal_mode"
                  checked={formData.animal_mode === 'db'}
                  onChange={() => setFormData(p => ({ ...p, animal_mode: 'db', animal_name: '' }))}
                />
                <span className="text-sm">Vybrat z databáze</span>
              </label>
            </div>

            {formData.animal_mode === 'db' ? (
              <div className="space-y-2">
                <Label>Zvíře z databáze *</Label>
                <Select
                  value={formData.animal_id || undefined}
                  onValueChange={(v) => {
                    setFormData(p => ({ ...p, animal_id: v, kennel_id: '' }));
                    setAvailableKennels([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte zvíře" />
                  </SelectTrigger>
                  <SelectContent>
                    {animals.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Žádná zvířata nenalezena
                      </div>
                    ) : (
                      animals.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.public_code}) - {a.species}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Jméno zvířete *</Label>
                  <Input
                    value={formData.animal_name}
                    onChange={(e) => {
                      setFormData(p => ({ ...p, animal_name: e.target.value, kennel_id: '' }));
                      setAvailableKennels([]);
                    }}
                    placeholder="např. Rex, Micka"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Druh *</Label>
                    <Select
                      value={formData.animal_species || undefined}
                      onValueChange={(v) => {
                        setFormData(p => ({ ...p, animal_species: v, kennel_id: '' }));
                        setAvailableKennels([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dog">Pes</SelectItem>
                        <SelectItem value="cat">Kočka</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Plemeno</Label>
                    <Input
                      value={formData.animal_breed}
                      onChange={(e) => setFormData(p => ({ ...p, animal_breed: e.target.value }))}
                      placeholder="Volitelné"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Poznámky k zvířeti</Label>
              <Input
                value={formData.animal_notes}
                onChange={(e) => setFormData(p => ({ ...p, animal_notes: e.target.value }))}
                placeholder="např. Potřebuje speciální stravu, léky"
              />
            </div>

            {/* Availability check button - appears after animal is selected */}
            {((formData.animal_mode === 'db' && formData.animal_id) || 
              (formData.animal_mode === 'manual' && formData.animal_name && formData.animal_species)) && (
              <Button
                type="button"
                variant="default"
                onClick={checkAvailability}
                disabled={checkingAvailability}
                className="w-full"
              >
                {checkingAvailability ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
                Zkontrolovat dostupnost pro {formData.animal_species === 'cat' ? 'kočku' : 'psa'}
              </Button>
            )}

            {availableKennels.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  ✓ Nalezeno {availableKennels.length} dostupných kotců pro {formData.animal_species === 'cat' ? 'kočku' : 'psa'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Kennel - ONLY after animal is selected and availability checked */}
      {availableKennels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Výběr kotce</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Kotec *</Label>
              <Select
                value={formData.kennel_id || undefined}
                onValueChange={(v) => setFormData(p => ({ ...p, kennel_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte kotec" />
                </SelectTrigger>
                <SelectContent>
                  {availableKennels.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name} ({k.zone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="single_cage"
                checked={formData.requires_single_cage}
                onChange={(e) => setFormData(p => ({ ...p, requires_single_cage: e.target.checked }))}
              />
              <Label htmlFor="single_cage" className="text-sm font-normal">
                Požadavek na samostatný kotec (kočky)
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="own_food"
                checked={formData.own_food}
                onChange={(e) => setFormData(p => ({ ...p, own_food: e.target.checked }))}
              />
              <Label htmlFor="own_food" className="text-sm font-normal">
                Vlastní krmivo (majitel přiveze)
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Contact */}
      {(formData.kennel_id || ((formData.animal_mode === 'db' && formData.animal_id) || 
              (formData.animal_mode === 'manual' && formData.animal_name))) && (
        <Card>
          <CardHeader>
            <CardTitle>4. Majitel / Kontakt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Kontakt (volitelné)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={formData.contact_id || undefined}
                    onValueChange={(v) => setFormData(p => ({ ...p, contact_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte kontakt" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
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
                      <div className="space-y-2">
                        <Label>Typ</Label>
                        <Select
                          value={newContact.type}
                          onValueChange={(v) => setNewContact(p => ({ ...p, type: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="other">Ostatní</SelectItem>
                            <SelectItem value="owner">Majitel</SelectItem>
                            <SelectItem value="foster">Pěstoun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateContact} className="w-full">
                        Vytvořit kontakt
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Price and Notes */}
      {formData.contact_id && (
        <Card>
          <CardHeader>
            <CardTitle>5. Cena a poznámky</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cena za den (Kč)</Label>
              <Input
                type="number"
                value={formData.price_per_day}
                onChange={(e) => setFormData(p => ({ ...p, price_per_day: e.target.value }))}
                placeholder={organization?.hotel_price_per_day ? String(organization.hotel_price_per_day) : 'např. 300'}
              />
              {organization?.hotel_price_per_day && (
                <p className="text-xs text-muted-foreground">
                  Výchozí cena z nastavení organizace: {organization.hotel_price_per_day} Kč
                </p>
              )}
            </div>

            {totalPrice && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Cena za den:</span>
                  <span>{formData.price_per_day} Kč</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Počet dní:</span>
                  <span>{totalDays}</span>
                </div>
                <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                  <span>Celkem:</span>
                  <span>{totalPrice} Kč</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Poznámky</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Volitelné poznámky k rezervaci"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      {formData.contact_id && (
        <div className="flex gap-4">
          <Button
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Vytvořit rezervaci
          </Button>
          <Link href="/dashboard/hotel/reservations">
            <Button variant="outline">Zrušit</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
