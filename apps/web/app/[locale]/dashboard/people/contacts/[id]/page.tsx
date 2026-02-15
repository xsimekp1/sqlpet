'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Mail, Phone, MapPin, User, Tag, FileText, Camera } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ApiClient } from '@/app/lib/api';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TYPE_COLORS: Record<string, string> = {
  donor: 'bg-green-100 text-green-800',
  veterinarian: 'bg-blue-100 text-blue-800',
  volunteer: 'bg-purple-100 text-purple-800',
  foster: 'bg-pink-100 text-pink-800',
  supplier: 'bg-orange-100 text-orange-800',
  partner: 'bg-cyan-100 text-cyan-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.id as string;
  const t = useTranslations('people');

  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ApiClient.get(`/contacts/${contactId}`)
      .then(setContact)
      .catch(() => toast.error('Failed to load contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
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
        <div>
          <h1 className="text-2xl font-bold">{contact.name}</h1>
          <Badge className={`mt-1 ${TYPE_COLORS[contact.type] ?? TYPE_COLORS.other}`} variant="outline">
            <Tag className="h-3 w-3 mr-1" />
            {contact.type}
          </Badge>
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
          {!contact.email && !contact.phone && !contact.address && (
            <p className="text-sm text-muted-foreground">{t('noContactInfo')}</p>
          )}
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

      {/* TODO: M5+ - Edit button */}
    </div>
  );
}
