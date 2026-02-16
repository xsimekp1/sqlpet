'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Mail, Phone, MapPin, User, Tag, FileText, Camera, PawPrint, Edit, Heart, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ApiClient } from '@/app/lib/api';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const CONTACT_TYPES = ['donor', 'veterinarian', 'volunteer', 'foster', 'supplier', 'partner', 'other'] as const;

const TYPE_COLORS: Record<string, string> = {
  donor: 'bg-green-100 text-green-800',
  veterinarian: 'bg-blue-100 text-blue-800',
  volunteer: 'bg-purple-100 text-purple-800',
  foster: 'bg-pink-100 text-pink-800',
  supplier: 'bg-orange-100 text-orange-800',
  partner: 'bg-cyan-100 text-cyan-800',
  other: 'bg-gray-100 text-gray-800',
};

interface Finding {
  id: string;
  animal_id: string | null;
  animal_name: string | null;
  animal_public_code: string | null;
  when_found: string;
  notes: string | null;
  where_lat: number | null;
  where_lng: number | null;
}

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.id as string;
  const t = useTranslations('people');

  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'other',
    email: '',
    phone: '',
    address: '',
    notes: '',
    profession: '',
    organization_name: '',
    bank_account: '',
    tax_id: '',
  });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ApiClient.get(`/contacts/${contactId}`)
      .then(setContact)
      .catch(() => toast.error('Failed to load contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  const openEditDialog = () => {
    if (contact) {
      setEditForm({
        name: contact.name || '',
        type: contact.type || 'other',
        email: contact.email || '',
        phone: contact.phone || '',
        address: contact.address || '',
        notes: contact.notes || '',
        profession: contact.profession || '',
        organization_name: contact.organization_name || '',
        bank_account: contact.bank_account || '',
        tax_id: contact.tax_id || '',
      });
      setEditDialogOpen(true);
    }
  };

  const handleSaveContact = async () => {
    if (!editForm.name.trim()) {
      toast.error('Jméno je povinné');
      return;
    }
    setSavingContact(true);
    try {
      const updated = await ApiClient.patch(`/contacts/${contactId}`, {
        name: editForm.name,
        type: editForm.type,
        email: editForm.email || null,
        phone: editForm.phone || null,
        address: editForm.address || null,
        notes: editForm.notes || null,
        profession: editForm.profession || null,
        organization_name: editForm.organization_name || null,
        bank_account: editForm.bank_account || null,
        tax_id: editForm.tax_id || null,
      });
      setContact(updated);
      setEditDialogOpen(false);
      toast.success('Kontakt byl aktualizován');
    } catch (error) {
      toast.error('Nepodařilo se uložit kontakt');
    } finally {
      setSavingContact(false);
    }
  };

  useEffect(() => {
    setLoadingFindings(true);
    ApiClient.get(`/findings/contact/${contactId}/findings`)
      .then((data: any) => {
        setFindings(data.items || []);
      })
      .catch(() => {
        setFindings([]);
      })
      .finally(() => setLoadingFindings(false));
  }, [contactId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const resp = await axios.post(
        `${API_URL}/files/contact/${contactId}/upload-avatar`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      setContact((prev: any) => ({ ...prev, avatar_url: resp.data.file_url }));
      toast.success(t('avatarUploaded'));
    } catch {
      toast.error(t('avatarUploadError'));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/people">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToPeople')}
          </Button>
        </Link>
        <p className="text-muted-foreground">Contact not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back */}
      <Link href="/dashboard/people">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToPeople')}
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Avatar with upload */}
        <div className="relative group shrink-0">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {contact.avatar_url ? (
              <img src={contact.avatar_url} alt={contact.name} className="h-16 w-16 object-cover rounded-full" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          {/* Upload overlay */}
          <button
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            title={t('uploadAvatar')}
          >
            {uploadingAvatar ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
</div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            <Badge className={TYPE_COLORS[contact.type] ?? TYPE_COLORS.other} variant="outline">
              <Tag className="h-3 w-3 mr-1" />
              {contact.type}
            </Badge>
          </div>
          <Button variant="outline" size="sm" className="mt-2" onClick={openEditDialog}>
            <Edit className="h-4 w-4 mr-1" />
            Upravit
          </Button>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('contactDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contact.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                {contact.email}
              </a>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`tel:${contact.phone}`} className="hover:underline">
                {contact.phone}
              </a>
            </div>
          )}
{contact.address && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{contact.address}</span>
            </div>
          )}
          {(contact.profession || contact.organization_name) && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                {contact.profession}
                {contact.profession && contact.organization_name && ' – '}
                {contact.organization_name}
              </span>
            </div>
          )}
          {!contact.email && !contact.phone && !contact.address && !contact.profession && !contact.organization_name && (
            <p className="text-sm text-muted-foreground">{t('noContactInfo')}</p>
          )}
</CardContent>
      </Card>

      {/* Donations placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            Dary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">0 Kč</p>
              <p className="text-xs text-muted-foreground">celkem darováno</p>
            </div>
            <Button variant="outline" size="sm" disabled title="Funkce dárcovství bude dostupná v budoucnu">
              <Plus className="h-4 w-4 mr-1" />
              Přidat dar
            </Button>
          </div>
        </CardContent>
      </Card>

{/* Notes */}
      {contact.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('notes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{contact.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Found Animals (Findings) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PawPrint className="h-4 w-4" />
            Nalezená zvířata
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFindings ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Načítám...</span>
            </div>
          ) : findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tato osoba zatím nenašla žádná zvířata.</p>
          ) : (
            <div className="space-y-3">
              {findings.map(finding => (
                <div key={finding.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <PawPrint className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      {finding.animal_id ? (
                        <Link 
                          href={`/dashboard/animals/${finding.animal_id}`}
                          className="font-medium hover:underline"
                        >
                          {finding.animal_name || 'Neznámé jméno'} 
                          {finding.animal_public_code && <span className="text-muted-foreground"> (#{finding.animal_public_code})</span>}
                        </Link>
                      ) : (
                        <span className="font-medium text-muted-foreground">Zvíře již neexistuje</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Nalezeno: {new Date(finding.when_found).toLocaleDateString('cs-CZ')}
                      </p>
                    </div>
                  </div>
                  {finding.notes && (
                    <p className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {finding.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
</CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upravit kontakt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Jméno *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Jméno a příjmení"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Typ</Label>
              <Select
                value={editForm.type}
                onValueChange={v => setEditForm(p => ({ ...p, type: v }))}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {type === 'donor' && 'Dárce'}
                      {type === 'veterinarian' && 'Veterinář'}
                      {type === 'volunteer' && 'Dobrovolník'}
                      {type === 'foster' && 'Pěstoun'}
                      {type === 'supplier' && 'Dodavatel'}
                      {type === 'partner' && 'Partner'}
                      {type === 'other' && 'Jiné'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@priklad.cz"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefon</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+420 123 456 789"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Adresa</Label>
              <Textarea
                id="edit-address"
                value={editForm.address}
                onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Ulice, Město, PSČ"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-profession">Profese</Label>
                <Input
                  id="edit-profession"
                  value={editForm.profession}
                  onChange={e => setEditForm(p => ({ ...p, profession: e.target.value }))}
                  placeholder="např. Veterinář"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-org">Název organizace</Label>
                <Input
                  id="edit-org"
                  value={editForm.organization_name}
                  onChange={e => setEditForm(p => ({ ...p, organization_name: e.target.value }))}
                  placeholder="Název firmy"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bank">Bankovní účet</Label>
                <Input
                  id="edit-bank"
                  value={editForm.bank_account}
                  onChange={e => setEditForm(p => ({ ...p, bank_account: e.target.value }))}
                  placeholder="123456789/0100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ico">IČO</Label>
                <Input
                  id="edit-ico"
                  value={editForm.tax_id}
                  onChange={e => setEditForm(p => ({ ...p, tax_id: e.target.value }))}
                  placeholder="12345678"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Poznámky</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Volitelné poznámky..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={savingContact}>
              Zrušit
            </Button>
            <Button onClick={handleSaveContact} disabled={savingContact}>
              {savingContact ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Uložit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
