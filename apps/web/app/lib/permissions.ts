import { User } from './api'

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
