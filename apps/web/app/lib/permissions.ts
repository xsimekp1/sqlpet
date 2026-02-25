import { User } from './api'

export const RESTRICTED_ROLES = ['readonly', 'volunteer', 'foster'];

export function canViewSensitiveInfo(role?: string): boolean {
  if (!role) return false;
  if (RESTRICTED_ROLES.includes(role.toLowerCase())) {
    return false;
  }
  return true;
}

export function formatSensitiveValue(value: string | null | undefined): string {
  if (!value) return '—';
  return '••••••••';
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return '••••••••';
  const maskedLocal = local.length > 2 ? local[0] + '•••' + local.slice(-1) : '••••';
  return `${maskedLocal}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••••••';
  return '••• ••• ••••';
}

/**
 * Check if user has a specific permission
 * Superadmins have all permissions
 */
export function userHasPermission(
  user: User | null, 
  permission: string | null, 
  permissions: string[] = []
): boolean {
  if (!user) return false
  if (user.is_superadmin) return true
  if (!permission) return true // No permission required

  // Check if user has the permission in their permissions array
  const perms = permissions.length > 0 ? permissions : (user.permissions || [])
  if (perms.length > 0) {
    return perms.includes(permission)
  }

  // Fallback: allow all if no permissions array (for backward compatibility)
  return true
}

/**
 * Filter navigation items based on user permissions
 */
export function filterNavByPermissions<T extends { permission?: string | null }>(
  navItems: T[],
  user: User | null,
  permissions: string[] = []
): T[] {
  return navItems.filter(item => userHasPermission(user, item.permission ?? null, permissions))
}
