import { User } from './api'

/**
 * Check if user has a specific permission
 * Superadmins have all permissions
 */
export function userHasPermission(user: User | null, permission: string | null): boolean {
  if (!user) return false
  if (user.is_superadmin) return true
  if (!permission) return true // No permission required

  // TODO: Backend needs to return user.permissions array
  // For now, allow all for MVP demo
  return true
}

/**
 * Filter navigation items based on user permissions
 */
export function filterNavByPermissions<T extends { permission?: string | null }>(
  navItems: T[],
  user: User | null
): T[] {
  return navItems.filter(item => userHasPermission(user, item.permission ?? null))
}
