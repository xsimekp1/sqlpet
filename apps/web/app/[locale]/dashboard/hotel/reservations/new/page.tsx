'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Calendar, DollarSign, User, Home, AlertCircle } from 'lucide-react';
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
import { toast } from 'sonner';
import Link from 'next/link';

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

export default function NewHotelReservationPage() {
  const t = useTranslations('hotel');
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [kennels, setKennels] = useState<Kennel[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    kennel_id: '',
    contact_id: '',
    animal_name: '',
    animal_species: 'dog',
    animal_breed: '',
    animal_notes: '',
    reserved_from: '',
    reserved_to: '',
    price_per_day: '',
    requires_single_cage: false,
    notes: '',
  });

  useEffect(() => {
    loadKennels();
    loadContacts();
  }, []);

  const loadKennels = async () => {
    try {
      const data = await fetch('/api/kennels').then(r => r.json());
      setKennels(data);
    } catch {
      toast.error('Nepodařilo se načíst kotce');
    }
  };

  const loadContacts = async () => {
    try {
      const data = await fetch('/api/contacts').then(r => r.json());
      setContacts(data.items || []);
    } catch {
      toast.error('Nepodařilo se načíst kontakty');
    }
  };

  const checkAvailability = async () => {
    if (!formData.kennel_id || !formData.reserved_from || !formData.reserved_to) {
      return;
    }
    setCheckingAvailability(true);
    try {
      const url = `/api/hotel/reservations/kennels/${formData.kennel_id}/availability?from_date=${formData.reserved_from}&to_date=${formData.reserved_to}`;
      const data = await fetch(url).then(r => r.json());
      setIsAvailable(data.is_available);
    } catch {
      setIsAvailable(false);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.kennel_id || !formData.animal_name || !formData.reserved_from || !formData.reserved_to) {
      toast.error('Vyplňte prosím všechny povinné pole');
      return;
    }

    if (isAvailable === false) {
      toast.error('Kotec není dostupný ve vybraném období');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        kennel_id: formData.kennel_id,
        contact_id: formData.contact_id || null,
        animal_name: formData.animal_name,
        animal_species: formData.animal_species,
        animal_breed: formData.animal_breed || null,
        animal_notes: formData.animal_notes || null,
        reserved_from: formData.reserved_from,
        reserved_to: formData.reserved_to,
        price_per_day: formData.price_per_day ? parseFloat(formData.price_per_day) : null,
        requires_single_cage: formData.requires_single_cage,
        notes: formData.notes || null,
      };

      await fetch('/api/hotel/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

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

      <Card>
        <CardHeader>
          <CardTitle>1. Vyberte kotec a termín</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kotec *</Label>
            <Select
              value={formData.kennel_id || undefined}
              onValueChange={(v) => { setFormData(p => ({ ...p, kennel_id: v })); setIsAvailable(null); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte kotec" />
              </SelectTrigger>
              <SelectContent>
                {kennels.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name} ({k.zone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum od *</Label>
              <Input
                type="date"
                value={formData.reserved_from}
                onChange={(e) => { setFormData(p => ({ ...p, reserved_from: e.target.value })); setIsAvailable(null); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Datum do *</Label>
              <Input
                type="date"
                value={formData.reserved_to}
                onChange={(e) => { setFormData(p => ({ ...p, reserved_to: e.target.value })); setIsAvailable(null); }}
              />
            </div>
          </div>

          {formData.kennel_id && formData.reserved_from && formData.reserved_to && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={checkAvailability}
                disabled={checkingAvailability}
              >
                {checkingAvailability ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Zkontrolovat dostupnost
              </Button>
              {isAvailable === true && (
                <span className="text-green-600 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Kotec je dostupný
                </span>
              )}
              {isAvailable === false && (
                <span className="text-red-600 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Kotec není dostupný
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requires_single_cage}
                onChange={(e) => setFormData(p => ({ ...p, requires_single_cage: e.target.checked }))}
              />
              Požadavek na samostatný kotec (kočky)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Informace o zvířeti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Jméno zvířete *</Label>
            <Input
              value={formData.animal_name}
              onChange={(e) => setFormData(p => ({ ...p, animal_name: e.target.value }))}
              placeholder="např. Rex, Micka"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Druh *</Label>
              <Select
                value={formData.animal_species || undefined}
                onValueChange={(v) => setFormData(p => ({ ...p, animal_species: v }))}
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
                placeholder="např. Labradorský retrívr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Poznámky k zvířeti</Label>
            <Input
              value={formData.animal_notes}
              onChange={(e) => setFormData(p => ({ ...p, animal_notes: e.target.value }))}
              placeholder="např. Potřebuje speciální stravu, léky"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Majitel / Kontakt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Majitel (volitelné)</Label>
            <Select
              value={formData.contact_id || undefined}
              onValueChange={(v) => setFormData(p => ({ ...p, contact_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte kontakt nebo zadejte nový" />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Cena a poznámky</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cena za den (Kč)</Label>
            <Input
              type="number"
              value={formData.price_per_day}
              onChange={(e) => setFormData(p => ({ ...p, price_per_day: e.target.value }))}
              placeholder="např. 300"
            />
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

      <div className="flex gap-4">
        <Button
          onClick={handleSubmit}
          disabled={loading || isAvailable === false}
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Vytvořit rezervaci
        </Button>
        <Link href="/dashboard/hotel/reservations">
          <Button variant="outline">Zrušit</Button>
        </Link>
      </div>
    </div>
  );
}
