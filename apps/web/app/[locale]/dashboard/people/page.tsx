'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/app/lib/api';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { canViewSensitiveInfo, maskEmail, maskPhone } from '@/app/lib/permissions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, UserPlus, Mail, Phone, Shield, AlertCircle, Heart, Stethoscope, HandHeart, Home, Building } from 'lucide-react';
import Link from 'next/link';
import { useOrganizationStore } from '@/app/stores/organizationStore';

type RoleFilter = 'all' | 'admin' | 'manager' | 'vet_staff' | 'caretaker' | 'volunteer';
type ContactTypeFilter = 'all' | 'donor' | 'veterinarian' | 'volunteer' | 'foster' | 'supplier' | 'partner' | 'other';

export default function PeoplePage() {
  const t = useTranslations('people');
  const { selectedOrg: _selectedOrg } = useOrganizationStore();
  const { selectedOrg } = useAuth();
  const canViewSensitive = canViewSensitiveInfo(selectedOrg?.role);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [contactTypeFilter, setContactTypeFilter] = useState<ContactTypeFilter>('all');

  // Fetch organization members (users with accounts)
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['organization-members', selectedOrg?.id, roleFilter],
    queryFn: () =>
      ApiClient.get(`/organizations/${selectedOrg?.id}/members`, {
        role: roleFilter !== 'all' ? roleFilter : undefined,
      }),
    enabled: !!selectedOrg?.id,
  });

  // Fetch contacts (external people without accounts) — no selectedOrg guard, org comes from auth token
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts', contactTypeFilter],
    queryFn: () =>
      ApiClient.get('/contacts', {
        type: contactTypeFilter !== 'all' ? contactTypeFilter : undefined,
      }),
  });

  const members = membersData?.items || [];
  const contacts = contactsData?.items || [];

  const getRoleBadge = (roleName: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      vet_staff: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      caretaker: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      volunteer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      foster: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      readonly: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
    };

    return (
      <Badge className={colors[roleName] || colors.readonly} variant="outline">
        {roleName}
      </Badge>
    );
  };

  const getContactTypeIcon = (type: string) => {
    switch (type) {
      case 'donor':
        return <Heart className="h-4 w-4" />;
      case 'veterinarian':
        return <Stethoscope className="h-4 w-4" />;
      case 'volunteer':
        return <HandHeart className="h-4 w-4" />;
      case 'foster':
        return <Home className="h-4 w-4" />;
      case 'supplier':
      case 'partner':
        return <Building className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getContactTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      donor: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      veterinarian: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      volunteer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      foster: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      supplier: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      partner: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    };

    return (
      <Badge className={colors[type] || colors.other} variant="outline">
        <span className="mr-1">{getContactTypeIcon(type)}</span>
        {t(`types.${type}`)}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      ACTIVE: { variant: 'default', className: 'bg-green-600' },
      PENDING: { variant: 'secondary', className: '' },
      SUSPENDED: { variant: 'destructive', className: '' },
    };
    const config = variants[status] || variants.PENDING;
    return <Badge {...config}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            {t('members')}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Heart className="h-4 w-4 mr-2" />
            {t('contacts')}
          </TabsTrigger>
        </TabsList>

        {/* Team Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
              <SelectTrigger className="w-36 md:w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="vet_staff">Vet Staff</SelectItem>
                <SelectItem value="caretaker">Caretaker</SelectItem>
                <SelectItem value="volunteer">Volunteer</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" className="md:w-auto md:px-4">
              <UserPlus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{t('addMember')}</span>
            </Button>
          </div>

          {/* Mobile cards */}
          {membersLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No members found. Invite users to get started.</p>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="md:hidden space-y-2">
                {members.map((member: any) => (
                  <div key={member.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{member.user?.name || 'Unknown'}</div>
                        {member.user?.is_superadmin && (
                          <div className="flex items-center gap-1 text-xs text-purple-600">
                            <Shield className="h-3 w-3" />Superadmin
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {getRoleBadge(member.role?.name || 'unknown')}
                        {getStatusBadge(member.status)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {member.user?.email && (
                        <a href={`mailto:${member.user.email}`} className="flex items-center gap-1 hover:text-foreground">
                          <Mail className="h-3 w-3" />{member.user.email}
                        </a>
                      )}
                      {member.user?.phone && (
                        <a href={`tel:${member.user.phone}`} className="flex items-center gap-1 hover:text-foreground text-blue-600">
                          <Phone className="h-3 w-3" />{member.user.phone}
                        </a>
                      )}
                    </div>
                    <Link href={`/dashboard/people/${member.user?.id}`}>
                      <Button size="sm" variant="outline" className="w-full">Manage</Button>
                    </Link>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell><Users className="h-4 w-4 text-muted-foreground" /></TableCell>
                        <TableCell>
                          <div className="font-medium">{member.user?.name || 'Unknown'}</div>
                          {member.user?.is_superadmin && (
                            <div className="flex items-center gap-1 text-xs text-purple-600">
                              <Shield className="h-3 w-3" />Superadmin
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{member.user?.email || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.user?.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{member.user.phone}</span>
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>{getRoleBadge(member.role?.name || 'unknown')}</TableCell>
                        <TableCell>{getStatusBadge(member.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.created_at ? new Date(member.created_at).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/people/${member.user?.id}`}>
                            <Button size="sm" variant="outline">Manage</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {members.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>{members.length} member{members.length !== 1 ? 's' : ''}</div>
              <div className="flex gap-4">
                <span>Active: {members.filter((m: any) => m.status === 'ACTIVE').length}</span>
                <span>Pending: {members.filter((m: any) => m.status === 'PENDING').length}</span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Select value={contactTypeFilter} onValueChange={(value) => setContactTypeFilter(value as ContactTypeFilter)}>
              <SelectTrigger className="w-36 md:w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="donor">{t('donors')}</SelectItem>
                <SelectItem value="veterinarian">{t('veterinarians')}</SelectItem>
                <SelectItem value="volunteer">{t('volunteers')}</SelectItem>
                <SelectItem value="foster">{t('fosters')}</SelectItem>
                <SelectItem value="supplier">Suppliers</SelectItem>
                <SelectItem value="partner">Partners</SelectItem>
                <SelectItem value="other">{t('others')}</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/dashboard/people/contacts/new">
              <Button size="icon" className="md:w-auto md:px-4">
                <UserPlus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">{t('addPerson')}</span>
              </Button>
            </Link>
          </div>

          {contactsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">{t('noPeople')}</p>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="md:hidden space-y-2">
                {contacts.map((contact: any) => (
                  <div key={contact.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{contact.name}</div>
                      {getContactTypeBadge(contact.type)}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {contact.email && (
                        <a href={`mailto:${canViewSensitive ? contact.email : maskEmail(contact.email)}`} className="flex items-center gap-1 hover:text-foreground truncate max-w-full">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{canViewSensitive ? contact.email : maskEmail(contact.email)}</span>
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                          <Phone className="h-3 w-3 shrink-0" />
                          {canViewSensitive ? contact.phone : maskPhone(contact.phone)}
                        </a>
                      )}
                      {contact.organization_name && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3 shrink-0" />{contact.organization_name}
                        </span>
                      )}
                    </div>
                    <Link href={`/dashboard/people/contacts/${contact.id}`}>
                      <Button size="sm" variant="outline" className="w-full">{t('actions.viewDetails')}</Button>
                    </Link>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact: any) => (
                      <TableRow key={contact.id}>
                        <TableCell>{getContactTypeIcon(contact.type)}</TableCell>
                        <TableCell><div className="font-medium">{contact.name}</div></TableCell>
                        <TableCell>{getContactTypeBadge(contact.type)}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{canViewSensitive ? contact.email : maskEmail(contact.email)}</span>
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{canViewSensitive ? contact.phone : maskPhone(contact.phone)}</span>
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{contact.organization_name || '-'}</span></TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/people/contacts/${contact.id}`}>
                            <Button size="sm" variant="outline">{t('actions.viewDetails')}</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {contacts.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
