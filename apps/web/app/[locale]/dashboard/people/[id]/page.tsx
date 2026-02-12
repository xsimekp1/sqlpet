'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/app/lib/api';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, Phone, Shield, Calendar, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useOrganizationStore } from '@/app/store/organizationStore';

export default function PersonDetailPage() {
  const t = useTranslations('people');
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const queryClient = useQueryClient();
  const { selectedOrg } = useOrganizationStore();

  const [selectedRole, setSelectedRole] = useState<string>('');

  // Fetch user details
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => ApiClient.get(`/users/${userId}`),
  });

  // Fetch user's membership in current org
  const { data: membership, isLoading: membershipLoading } = useQuery({
    queryKey: ['user-membership', userId, selectedOrg?.id],
    queryFn: () =>
      ApiClient.get(`/organizations/${selectedOrg?.id}/members`, {
        user_id: userId,
      }).then((res) => res.items?.[0]),
    enabled: !!selectedOrg?.id && !!userId,
  });

  // Fetch available roles
  const { data: rolesData } = useQuery({
    queryKey: ['organization-roles', selectedOrg?.id],
    queryFn: () => ApiClient.get(`/organizations/${selectedOrg?.id}/roles`),
    enabled: !!selectedOrg?.id,
  });

  const roles = rolesData?.items || [];

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (newRoleId: string) => {
      return await ApiClient.put(
        `/organizations/${selectedOrg?.id}/members/${membership.id}`,
        {
          role_id: newRoleId,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-membership', userId] });
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast({
        title: 'Role updated',
        description: 'User role has been updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleUpdateRole = () => {
    if (selectedRole && selectedRole !== membership?.role?.id) {
      updateRoleMutation.mutate(selectedRole);
    }
  };

  if (userLoading || membershipLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading user...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">User not found</div>
      </div>
    );
  }

  const getRoleBadge = (roleName: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      manager: 'bg-blue-100 text-blue-800',
      vet_staff: 'bg-green-100 text-green-800',
      caretaker: 'bg-orange-100 text-orange-800',
      volunteer: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={colors[roleName] || colors.volunteer} variant="outline">
        {roleName}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/people">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
            {user.is_superadmin && (
              <Badge className="bg-purple-600">
                <Shield className="h-3 w-3 mr-1" />
                Superadmin
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">User profile and permissions</p>
        </div>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>User contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="font-medium">{user.email}</div>
            </div>
          </div>
          {user.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Phone</div>
                <div className="font-medium">{user.phone}</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Joined</div>
              <div className="font-medium">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Management Card */}
      {membership && (
        <Card>
          <CardHeader>
            <CardTitle>Role & Permissions</CardTitle>
            <CardDescription>
              Manage user role in {selectedOrg?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Role */}
            <div>
              <div className="text-sm font-medium mb-2">Current Role</div>
              <div className="flex items-center gap-2">
                {getRoleBadge(membership.role?.name || 'unknown')}
                <span className="text-sm text-muted-foreground">
                  {membership.role?.description}
                </span>
              </div>
            </div>

            {/* Status */}
            <div>
              <div className="text-sm font-medium mb-2">Membership Status</div>
              <Badge
                variant={
                  membership.status === 'ACTIVE' ? 'default' : 'secondary'
                }
              >
                {membership.status === 'ACTIVE' && (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                )}
                {membership.status}
              </Badge>
            </div>

            {/* Change Role */}
            <div className="space-y-4 pt-4 border-t">
              <div className="text-sm font-medium">Change Role</div>
              <div className="flex gap-4">
                <Select
                  value={selectedRole || membership.role?.id}
                  onValueChange={setSelectedRole}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select new role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role: any) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name} - {role.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleUpdateRole}
                  disabled={
                    !selectedRole ||
                    selectedRole === membership.role?.id ||
                    updateRoleMutation.isPending
                  }
                >
                  {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Changing the role will update the user's permissions immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions Card */}
      {membership?.role && (
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              Permissions granted by the {membership.role.name} role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {membership.role.permissions?.map((permission: any) => (
                <div
                  key={permission.id}
                  className="flex items-center gap-2 text-sm p-2 rounded-md bg-secondary"
                >
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>{permission.key}</span>
                </div>
              )) || (
                <div className="text-sm text-muted-foreground col-span-full">
                  No permissions information available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
