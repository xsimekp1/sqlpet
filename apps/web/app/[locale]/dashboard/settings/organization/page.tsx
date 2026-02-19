'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Save, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ApiClient from '@/app/lib/api';

interface OrganizationSettings {
  name: string;
  registration_number: string;
  address: string;
  lat: string;
  lng: string;
  capacity_dogs: string;
  capacity_cats: string;
  capacity_rabbits: string;
  capacity_small: string;
  capacity_birds: string;
}

export default function OrganizationSettingsPage() {
  const t = useTranslations('settings.organization');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OrganizationSettings>({
    name: '',
    registration_number: '',
    address: '',
    lat: '',
    lng: '',
    capacity_dogs: '',
    capacity_cats: '',
    capacity_rabbits: '',
    capacity_small: '',
    capacity_birds: '',
  });

  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      const org = await ApiClient.getCurrentOrganization();
      setForm({
        name: org.name || '',
        registration_number: org.registration_number || '',
        address: org.address || '',
        lat: org.lat?.toString() || '',
        lng: org.lng?.toString() || '',
        capacity_dogs: org.capacity_dogs?.toString() || '',
        capacity_cats: org.capacity_cats?.toString() || '',
        capacity_rabbits: org.capacity_rabbits?.toString() || '',
        capacity_small: org.capacity_small?.toString() || '',
        capacity_birds: org.capacity_birds?.toString() || '',
      });
    } catch (err) {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await ApiClient.updateOrganization({
        name: form.name,
        registration_number: form.registration_number || undefined,
        address: form.address || undefined,
        lat: form.lat ? parseFloat(form.lat) : undefined,
        lng: form.lng ? parseFloat(form.lng) : undefined,
        capacity_dogs: form.capacity_dogs ? parseInt(form.capacity_dogs) : undefined,
        capacity_cats: form.capacity_cats ? parseInt(form.capacity_cats) : undefined,
        capacity_rabbits: form.capacity_rabbits ? parseInt(form.capacity_rabbits) : undefined,
        capacity_small: form.capacity_small ? parseInt(form.capacity_small) : undefined,
        capacity_birds: form.capacity_birds ? parseInt(form.capacity_birds) : undefined,
      });
      toast.success(t('saved'));
    } catch (err) {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof OrganizationSettings, value: string) => {
    setForm(p => ({ ...p, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('basicInfo')}</CardTitle>
          <CardDescription>{t('basicInfoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('orgName')}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="registration_number">{t('registrationNumber')}</Label>
            <Input
              id="registration_number"
              placeholder="CZ 51C00155"
              value={form.registration_number}
              onChange={(e) => set('registration_number', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('registrationNumberHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('location')}</CardTitle>
          <CardDescription>{t('locationDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="address">{t('address')}</Label>
            <Input
              id="address"
              placeholder={t('addressPlaceholder')}
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="lat">{t('latitude')}</Label>
              <Input
                id="lat"
                type="number"
                step="0.000001"
                placeholder="50.0755"
                value={form.lat}
                onChange={(e) => set('lat', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lng">{t('longitude')}</Label>
              <Input
                id="lng"
                type="number"
                step="0.000001"
                placeholder="14.4378"
                value={form.lng}
                onChange={(e) => set('lng', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('capacities')}</CardTitle>
          <CardDescription>{t('capacitiesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="capacity_dogs">{t('dogs')}</Label>
              <Input
                id="capacity_dogs"
                type="number"
                min="0"
                placeholder="0"
                value={form.capacity_dogs}
                onChange={(e) => set('capacity_dogs', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity_cats">{t('cats')}</Label>
              <Input
                id="capacity_cats"
                type="number"
                min="0"
                placeholder="0"
                value={form.capacity_cats}
                onChange={(e) => set('capacity_cats', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity_rabbits">{t('rabbits')}</Label>
              <Input
                id="capacity_rabbits"
                type="number"
                min="0"
                placeholder="0"
                value={form.capacity_rabbits}
                onChange={(e) => set('capacity_rabbits', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity_small">{t('small')}</Label>
              <Input
                id="capacity_small"
                type="number"
                min="0"
                placeholder="0"
                value={form.capacity_small}
                onChange={(e) => set('capacity_small', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity_birds">{t('birds')}</Label>
              <Input
                id="capacity_birds"
                type="number"
                min="0"
                placeholder="0"
                value={form.capacity_birds}
                onChange={(e) => set('capacity_birds', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
