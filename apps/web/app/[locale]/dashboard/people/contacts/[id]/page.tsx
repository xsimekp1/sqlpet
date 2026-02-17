'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Mail, Phone, MapPin, User, Tag, FileText, Camera, PawPrint, Edit, Heart, Plus, Check, X, Building } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ApiClient } from '@/app/lib/api';
import { toast } from 'sonner';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ApiClient.get(`/contacts/${contactId}`)
      .then(setContact)
      .catch(() => toast.error('Failed to load contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  const startEdit = (field: string, currentValue: string | null) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveField = async (field: string) => {
    setSavingField(field);
    try {
      const updateData: Record<string, any> = {};
      updateData[field] = editValue || null;
      
      const updated = await ApiClient.patch(`/contacts/${contactId}`, updateData);
      setContact(updated);
      setEditingField(null);
      setEditValue('');
      toast.success('Uloženo');
    } catch (error) {
      toast.error('Nepodařilo se uložit');
    } finally {
      setSavingField(null);
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
            {editingField === 'name' ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="h-8 max-w-[200px]"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveField('name')} disabled={savingField === 'name'}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <h1 
                  className="text-2xl font-bold cursor-pointer hover:text-primary"
                  onClick={() => startEdit('name', contact.name)}
                >
                  {contact.name}
                </h1>
                <Button size="sm" variant="ghost" onClick={() => startEdit('name', contact.name)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          {/* Type - inline edit */}
          <div className="flex items-center gap-3 mt-2">
            {editingField === 'type' ? (
              <div className="flex items-center gap-2">
                <Select value={editValue} onValueChange={setEditValue}>
                  <SelectTrigger className="w-[140px] h-8">
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
                <Button size="sm" variant="ghost" onClick={() => saveField('type')} disabled={savingField === 'type'}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Badge className={TYPE_COLORS[contact.type] ?? TYPE_COLORS.other} variant="outline">
                  <Tag className="h-3 w-3 mr-1" />
                  {contact.type}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => startEdit('type', contact.type)}>
                  <Edit className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('contactDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email */}
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="w-16 text-sm text-muted-foreground">E-mail:</span>
            {editingField === 'email' ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="email@priklad.cz"
                  className="h-8 max-w-[250px]"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveField('email')} disabled={savingField === 'email'}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground text-sm italic">prázdné</span>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit('email', contact.email)}>
                  <Edit className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

          {/* Phone */}
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="w-16 text-sm text-muted-foreground">Telefon:</span>
            {editingField === 'phone' ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="+420 123 456 789"
                  className="h-8 max-w-[180px]"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveField('phone')} disabled={savingField === 'phone'}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="hover:underline">
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground text-sm italic">prázdné</span>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit('phone', contact.phone)}>
                  <Edit className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

          {/* Address */}
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="w-16 text-sm text-muted-foreground shrink-0 pt-1">Adresa:</span>
            {editingField === 'address' ? (
              <div className="flex items-center gap-2 flex-1">
                <Textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="Ulice, Město, PSČ"
                  className="h-16 max-w-[300px]"
                  autoFocus
                />
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="ghost" onClick={() => saveField('address')} disabled={savingField === 'address'}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {contact.address ? (
                  <span className="whitespace-pre-line">{contact.address}</span>
                ) : (
                  <span className="text-muted-foreground text-sm italic">prázdné</span>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit('address', contact.address)}>
                  <Edit className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

          {/* Profession */}
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="w-16 text-sm text-muted-foreground shrink-0 pt-1">Profese:</span>
            {editingField === 'profession' ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="Profese"
                  className="h-8 max-w-[160px]"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveField('profession')} disabled={savingField === 'profession'}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span>
                  {contact.profession || <span className="text-muted-foreground text-sm italic">prázdné</span>}
                </span>
                <Button size="sm" variant="ghost" onClick={() => startEdit('profession', contact.profession)}>
                  <Edit className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

          {/* Organization */}
          <div className="flex items-start gap-3">
            <Building className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="w-16 text-sm text-muted-foreground shrink-0 pt-1">Organizace:</span>
            {editingField === 'organization_name' ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="Organizace"
                  className="h-8 max-w-[200px]"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveField('organization_name')} disabled={savingField === 'organization_name'}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span>
                  {contact.organization_name || <span className="text-muted-foreground text-sm italic">prázdné</span>}
                </span>
                <Button size="sm" variant="ghost" onClick={() => startEdit('organization_name', contact.organization_name)}>
                  <Edit className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

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
    </div>
  );
}
