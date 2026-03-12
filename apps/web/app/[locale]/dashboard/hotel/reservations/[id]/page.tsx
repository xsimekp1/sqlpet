'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Calendar, Check, Dog, Cat, Save, Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { canViewSensitiveInfo, maskPhone } from '@/app/lib/permissions';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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

interface HotelReservation {
  id: string;
  kennel_id: string;
  kennel_name: string | null;
  contact_id: string | null;
  animal_name: string;
  animal_species: string;
  animal_breed: string | null;
  animal_notes: string | null;
  reserved_from: string;
  reserved_to: string;
  price_per_day: number | null;
  total_price: number | null;
  is_paid: boolean;
  requires_single_cage: boolean;
  own_food: boolean;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Čeká na potvrzení',
  confirmed: 'Potvrzeno',
  checked_in: 'Nastoupil/a',
  checked_out: 'Odjel/a',
  cancelled: 'Zrušeno',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  checked_in: 'bg-green-100 text-green-800 border-green-200',
  checked_out: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export default function HotelReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { selectedOrg } = useAuth();
  const canViewSensitive = canViewSensitiveInfo(selectedOrg?.role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reservation, setReservation] = useState<HotelReservation | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [kennels, setKennels] = useState<Kennel[]>([]);

  // Editable fields
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [kennelId, setKennelId] = useState('');
  const [contactId, setContactId] = useState('');
  const [animalName, setAnimalName] = useState('');
  const [animalBreed, setAnimalBreed] = useState('');
  const [animalNotes, setAnimalNotes] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [requiresSingleCage, setRequiresSingleCage] = useState(false);
  const [ownFood, setOwnFood] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resRes, contactsRes, kennelsRes] = await Promise.all([
        fetch(`/api/hotel/reservations/${id}`, { headers: getAuthHeaders() }),
        fetch('/api/contacts?page_size=100', { headers: getAuthHeaders() }),
        fetch('/api/kennels', { headers: getAuthHeaders() }),
      ]);

      if (!resRes.ok) {
        toast.error('Rezervace nenalezena');
        router.push('/dashboard/hotel/reservations');
        return;
      }

      const data: HotelReservation = await resRes.json();
      setReservation(data);

      // Populate form fields
      setDateFrom(data.reserved_from);
      setDateTo(data.reserved_to);
      setKennelId(data.kennel_id);
      setContactId(data.contact_id || '');
      setAnimalName(data.animal_name);
      setAnimalBreed(data.animal_breed || '');
      setAnimalNotes(data.animal_notes || '');
      setPricePerDay(data.price_per_day ? String(data.price_per_day) : '');
      setRequiresSingleCage(data.requires_single_cage);
      setOwnFood(data.own_food);
      setIsPaid(data.is_paid);
      setNotes(data.notes || '');
      setStatus(data.status);

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(contactsData.items || []);
      }

      if (kennelsRes.ok) {
        const kennelsData = await kennelsRes.json();
        setKennels(Array.isArray(kennelsData) ? kennelsData : (kennelsData.items || []));
      }
    } catch (err) {
      console.error('Failed to load reservation:', err);
      toast.error('Nepodařilo se načíst rezervaci');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Vyplňte datum pobytu');
      return;
    }
    if (!kennelId) {
      toast.error('Vyberte kotec');
      return;
    }
    if (!animalName) {
      toast.error('Zadejte jméno zvířete');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        kennel_id: kennelId,
        contact_id: contactId || null,
        animal_name: animalName,
        animal_breed: animalBreed || null,
        animal_notes: animalNotes || null,
        reserved_from: dateFrom,
        reserved_to: dateTo,
        price_per_day: pricePerDay ? parseFloat(pricePerDay) : null,
        requires_single_cage: requiresSingleCage,
        own_food: ownFood,
        is_paid: isPaid,
        notes: notes || null,
        status: status,
      };

      const res = await fetch(`/api/hotel/reservations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed' }));
        throw new Error(err.detail || 'Failed to update reservation');
      }

      toast.success('Rezervace aktualizována');
      router.push('/dashboard/hotel/reservations');
    } catch (error: any) {
      toast.error(error.message || 'Nepodařilo se aktualizovat rezervaci');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Opravdu chcete zrušit tuto rezervaci?')) return;

    try {
      const res = await fetch(`/api/hotel/reservations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Rezervace zrušena');
      router.push('/dashboard/hotel/reservations');
    } catch {
      toast.error('Nepodařilo se zrušit rezervaci');
    }
  };

  const handleCheckin = async () => {
    try {
      const res = await fetch(`/api/hotel/reservations/${id}/checkin`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Check-in proveden');
      loadData();
    } catch {
      toast.error('Nepodařilo se provést check-in');
    }
  };

  const handleCheckout = async () => {
    try {
      const res = await fetch(`/api/hotel/reservations/${id}/checkout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Check-out proveden');
      loadData();
    } catch {
      toast.error('Nepodařilo se provést check-out');
    }
  };

  const totalDays = dateFrom && dateTo
    ? Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0;
  const totalPrice = pricePerDay ? parseFloat(pricePerDay) * totalDays : null;

  const isEditable = reservation?.status !== 'checked_out' && reservation?.status !== 'cancelled';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!reservation) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-2xl pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hotel/reservations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{reservation.animal_name}</h1>
              <Badge className={STATUS_COLORS[reservation.status]}>
                {STATUS_LABELS[reservation.status] || reservation.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {format(new Date(reservation.reserved_from), 'd.M.yyyy')} – {format(new Date(reservation.reserved_to), 'd.M.yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reservation.animal_species === 'dog' ? (
            <Dog className="h-8 w-8 text-blue-500" />
          ) : (
            <Cat className="h-8 w-8 text-orange-500" />
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {isEditable && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rychlé akce</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                <>
                  <Button onClick={handleCheckin} variant="default">
                    <Check className="h-4 w-4 mr-2" />
                    Check-in
                  </Button>
                  <Button onClick={handleCancel} variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Zrušit rezervaci
                  </Button>
                </>
              )}
              {reservation.status === 'checked_in' && (
                <Button onClick={handleCheckout} variant="default">
                  Check-out
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Termín pobytu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Od *</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-2">
              <Label>Do *</Label>
              <Input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={!isEditable}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Animal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Zvíře</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jméno *</Label>
              <Input
                value={animalName}
                onChange={(e) => setAnimalName(e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-2">
              <Label>Plemeno</Label>
              <Input
                value={animalBreed}
                onChange={(e) => setAnimalBreed(e.target.value)}
                disabled={!isEditable}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Poznámky ke zvířeti</Label>
            <Input
              value={animalNotes}
              onChange={(e) => setAnimalNotes(e.target.value)}
              placeholder="speciální strava, léky, chování..."
              disabled={!isEditable}
            />
          </div>
        </CardContent>
      </Card>

      {/* Kennel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Kotec</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kotec *</Label>
            <Select value={kennelId} onValueChange={setKennelId} disabled={!isEditable}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte kotec" />
              </SelectTrigger>
              <SelectContent>
                {kennels.map((k) => (
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
                disabled={!isEditable}
              />
              <span className="text-sm">Požadavek na samostatný kotec</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ownFood}
                onChange={(e) => setOwnFood(e.target.checked)}
                className="rounded"
                disabled={!isEditable}
              />
              <span className="text-sm">Vlastní krmivo (majitel přiveze)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Majitel</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={contactId} onValueChange={setContactId} disabled={!isEditable}>
            <SelectTrigger>
              <SelectValue placeholder="Vyberte kontakt" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Bez kontaktu</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${canViewSensitive ? c.phone : maskPhone(c.phone)})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Price */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Cena</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cena za den (Kč)</Label>
            <Input
              type="number"
              value={pricePerDay}
              onChange={(e) => setPricePerDay(e.target.value)}
              disabled={!isEditable}
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

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="rounded"
              disabled={!isEditable}
            />
            <span className="text-sm font-medium">Zaplaceno</span>
          </label>

          <div className="space-y-2">
            <Label>Poznámky k rezervaci</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="volitelné"
              disabled={!isEditable}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      {isEditable && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Čeká na potvrzení</SelectItem>
                <SelectItem value="confirmed">Potvrzeno</SelectItem>
                <SelectItem value="checked_in">Nastoupil/a</SelectItem>
                <SelectItem value="checked_out">Odjel/a</SelectItem>
                <SelectItem value="cancelled">Zrušeno</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Sticky footer */}
      {isEditable && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-background border-t p-4 z-50">
          <div className="max-w-2xl mx-auto flex gap-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Uložit změny
            </Button>
            <Link href="/dashboard/hotel/reservations">
              <Button variant="outline">Zrušit</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
