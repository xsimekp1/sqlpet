'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Building2, Users, Calendar, Globe, Trash2, 
  Search, Loader2, AlertTriangle, ChevronRight, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ApiClient from '@/app/lib/api';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
  phone: string | null;
  admin_note: string | null;
  member_count: number;
  created_at: string | null;
  admins: { id: string; name: string; email: string }[];
}

const COUNTRY_LABELS: Record<string, string> = {
  CZ: 'Česko',
  SK: 'Slovensko',
  PL: 'Polsko',
  DE: 'Německo',
  AT: 'Rakousko',
  HU: 'Maďarsko',
  UK: 'Velká Británie',
};

export default function SuperadminOrganizationsPage() {
  const t = useTranslations('superadmin');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [organizationToDelete, setOrganizationToDelete] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [organizationToEdit, setOrganizationToEdit] = useState<Organization | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const data = await ApiClient.getAdminOrganizations();
      setOrganizations(data);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      toast.error(t('errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!organizationToDelete) return;
    
    setDeleting(true);
    try {
      await ApiClient.deleteOrganization(organizationToDelete.id);
      toast.success(t('deleteSuccess'));
      setOrganizations(prev => prev.filter(o => o.id !== organizationToDelete.id));
      setDeleteDialogOpen(false);
      setOrganizationToDelete(null);
    } catch (error) {
      console.error('Failed to delete organization:', error);
      toast.error(t('deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (org: Organization) => {
    setOrganizationToDelete(org);
    setDeleteDialogOpen(true);
  };

  const openEditDialog = (org: Organization) => {
    setOrganizationToEdit(org);
    setEditPhone(org.phone || '');
    setEditNote(org.admin_note || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!organizationToEdit) return;
    setSaving(true);
    try {
      await ApiClient.updateOrganization(organizationToEdit.id, {
        phone: editPhone || undefined,
        admin_note: editNote || undefined,
      });
      setOrganizations(prev => prev.map(o => 
        o.id === organizationToEdit.id 
          ? { ...o, phone: editPhone || null, admin_note: editNote || null }
          : o
      ));
      setEditDialogOpen(false);
      toast.success(t('saveSuccess') || 'Uloženo');
    } catch (error) {
      console.error('Failed to update organization:', error);
      toast.error(t('saveError') || 'Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.admins.some(a => a.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCountry = countryFilter === 'all' || org.country === countryFilter;
    return matchesSearch && matchesCountry;
  });

  const stats = {
    total: organizations.length,
    thisMonth: organizations.filter(o => {
      if (!o.created_at) return false;
      const created = new Date(o.created_at);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length,
    countries: [...new Set(organizations.map(o => o.country).filter(Boolean))],
  };

  const countryCounts = organizations.reduce((acc, org) => {
    if (org.country) {
      acc[org.country] = (acc[org.country] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalOrganizations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('newThisMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.thisMonth}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('byCountry')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(countryCounts).map(([country, count]) => (
                <Badge key={country} variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {COUNTRY_LABELS[country] || country}: {count}
                </Badge>
              ))}
              {Object.keys(countryCounts).length === 0 && (
                <span className="text-muted-foreground text-sm">{t('noData')}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="flex h-10 w-full sm:w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        >
          <option value="all">{t('allCountries')}</option>
          {Object.entries(COUNTRY_LABELS).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('organization')}</TableHead>
              <TableHead>{t('country')}</TableHead>
              <TableHead>{t('phone')}</TableHead>
              <TableHead>{t('note')}</TableHead>
              <TableHead>{t('admins')}</TableHead>
              <TableHead>{t('members')}</TableHead>
              <TableHead>{t('created')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrgs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('noOrganizations')}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {org.name}
                    </div>
                    {org.region && (
                      <span className="text-xs text-muted-foreground ml-6">
                        {org.region}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {org.country ? (
                      <Badge variant="outline">
                        {COUNTRY_LABELS[org.country] || org.country}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {org.phone ? (
                      <span className="text-sm">{org.phone}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {org.admin_note ? (
                      <span className="text-sm max-w-[150px] truncate block" title={org.admin_note}>
                        {org.admin_note}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {org.admins.map((admin) => (
                        <div key={admin.id} className="text-sm">
                          {admin.name || admin.email}
                          <span className="text-muted-foreground text-xs ml-1">
                            ({admin.email})
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {org.member_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    {org.created_at ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(org.created_at).toLocaleDateString('cs-CZ')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/superadmin/organizations/${org.id}`}>
                        <Button variant="ghost" size="sm">
                          {t('viewMembers')}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(org)}
                        title={t('edit') || 'Upravit'}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(org)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('deleteConfirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('deleteConfirmDescription', { name: organizationToDelete?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editOrganization') || 'Upravit organizaci'}</DialogTitle>
            <DialogDescription>
              {organizationToEdit?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone') || 'Telefon'}</Label>
              <Input
                id="phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+420 123 456 789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">{t('note') || 'Poznámka'}</Label>
              <Textarea
                id="note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder={t('notePlaceholder') || 'Interní poznámka...'}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
