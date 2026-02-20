/**
 * Command registry for unified search
 *
 * Each command represents a navigational action or page in the app
 */

export type Command = {
  id: string
  title: string
  titleEn: string
  description?: string
  descriptionEn?: string
  href: string
  icon?: string          // Lucide icon name
  keywords: string[]     // Czech keywords (normalized)
  keywordsEn: string[]   // English keywords (normalized)
  tags: string[]         // Category tags
  permission?: string    // Required permission (optional)
}

/**
 * Command registry (MVP)
 *
 * All commands available in the app for search
 */
export const COMMANDS: Command[] = [
  // Dashboard
  {
    id: 'dashboard',
    title: 'Dashboard',
    titleEn: 'Dashboard',
    description: 'Přehled útulku',
    descriptionEn: 'Shelter overview',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    keywords: ['prehled', 'domů', 'uvod'],
    keywordsEn: ['overview', 'home', 'main'],
    tags: ['dashboard'],
  },

  // Animals
  {
    id: 'animals.list',
    title: 'Zvířata',
    titleEn: 'Animals',
    description: 'Seznam všech zvířat',
    descriptionEn: 'List of all animals',
    href: '/dashboard/animals',
    icon: 'Dog',
    keywords: ['zvirata', 'psi', 'kocky', 'seznam'],
    keywordsEn: ['animals', 'pets', 'dogs', 'cats', 'list'],
    tags: ['animals'],
    permission: 'animals.read',
  },
  {
    id: 'animals.new',
    title: 'Nové zvíře',
    titleEn: 'New Animal',
    description: 'Přidat nové zvíře',
    descriptionEn: 'Add new animal',
    href: '/dashboard/animals/new',
    icon: 'Plus',
    keywords: ['pridat', 'nove', 'zvire', 'vytvorit'],
    keywordsEn: ['add', 'new', 'animal', 'create'],
    tags: ['animals'],
    permission: 'animals.write',
  },
  {
    id: 'intake.new',
    title: 'Příjem zvířete',
    titleEn: 'Intake',
    description: 'Přijmout nové zvíře do útulku',
    descriptionEn: 'Intake new animal to shelter',
    href: '/dashboard/intake/new',
    icon: 'LogIn',
    keywords: ['prijem', 'intake', 'nove', 'pridat'],
    keywordsEn: ['intake', 'admission', 'new', 'add'],
    tags: ['animals', 'intake'],
    permission: 'animals.write',
  },

  // Medical
  {
    id: 'medical',
    title: 'Zdravotní péče',
    titleEn: 'Medical',
    description: 'Zdravotní záznamy a ošetření',
    descriptionEn: 'Medical records and treatments',
    href: '/dashboard/medical',
    icon: 'Stethoscope',
    keywords: ['zdravi', 'veterinar', 'osetreni', 'medicina'],
    keywordsEn: ['medical', 'health', 'vet', 'treatment'],
    tags: ['medical'],
    permission: 'medical.read',
  },
  {
    id: 'medical.vaccination',
    title: 'Očkování',
    titleEn: 'Vaccination',
    description: 'Záznamy o očkování',
    descriptionEn: 'Vaccination records',
    href: '/dashboard/medical',
    icon: 'Syringe',
    keywords: ['ockovani', 'vakciny', 'vakcinace', 'imunizace'],
    keywordsEn: ['vaccination', 'vaccine', 'immunization', 'shots'],
    tags: ['medical'],
    permission: 'medical.read',
  },

  // Inventory
  {
    id: 'inventory',
    title: 'Sklad',
    titleEn: 'Inventory',
    description: 'Inventář a zásoby',
    descriptionEn: 'Inventory and supplies',
    href: '/dashboard/inventory',
    icon: 'Package',
    keywords: ['sklad', 'inventar', 'zasoby', 'material'],
    keywordsEn: ['inventory', 'stock', 'supplies', 'warehouse'],
    tags: ['inventory'],
    permission: 'inventory.read',
  },
  {
    id: 'inventory.new',
    title: 'Nová položka skladu',
    titleEn: 'New Inventory Item',
    description: 'Přidat novou položku do skladu',
    descriptionEn: 'Add new inventory item',
    href: '/dashboard/inventory/items/new',
    icon: 'Plus',
    keywords: ['pridat', 'nova', 'polozka', 'sklad'],
    keywordsEn: ['add', 'new', 'item', 'inventory'],
    tags: ['inventory'],
    permission: 'inventory.write',
  },
  {
    id: 'inventory.purchases',
    title: 'Objednávky',
    titleEn: 'Purchase Orders',
    description: 'Nákupní objednávky',
    descriptionEn: 'Purchase orders',
    href: '/dashboard/inventory/purchases',
    icon: 'ShoppingCart',
    keywords: ['objednavky', 'nakupy', 'purchase', 'order'],
    keywordsEn: ['orders', 'purchases', 'po', 'procurement'],
    tags: ['inventory'],
    permission: 'inventory.read',
  },

  // Kennels
  {
    id: 'kennels',
    title: 'Kotce',
    titleEn: 'Kennels',
    description: 'Správa kotců a ubytování',
    descriptionEn: 'Kennel and housing management',
    href: '/dashboard/kennels',
    icon: 'Home',
    keywords: ['kotce', 'ubytovani', 'mapa', 'prostory'],
    keywordsEn: ['kennels', 'housing', 'map', 'facilities'],
    tags: ['kennels'],
    permission: 'kennels.read',
  },

  // Feeding
  {
    id: 'feeding',
    title: 'Krmení',
    titleEn: 'Feeding',
    description: 'Plány krmení a záznamy',
    descriptionEn: 'Feeding plans and logs',
    href: '/dashboard/feeding',
    icon: 'UtensilsCrossed',
    keywords: ['krmeni', 'jidlo', 'strava', 'krmivo'],
    keywordsEn: ['feeding', 'food', 'meals', 'diet'],
    tags: ['feeding'],
    permission: 'feeding.read',
  },
  {
    id: 'feeding.plans',
    title: 'Plány krmení',
    titleEn: 'Feeding Plans',
    description: 'Správa plánů krmení',
    descriptionEn: 'Manage feeding plans',
    href: '/dashboard/feeding/plans',
    icon: 'CalendarClock',
    keywords: ['plany', 'krmeni', 'rozvrh'],
    keywordsEn: ['plans', 'feeding', 'schedule'],
    tags: ['feeding'],
    permission: 'feeding.read',
  },

  // Tasks
  {
    id: 'tasks',
    title: 'Úkoly',
    titleEn: 'Tasks',
    description: 'Seznam úkolů',
    descriptionEn: 'Task list',
    href: '/dashboard/tasks',
    icon: 'CheckSquare',
    keywords: ['ukoly', 'todo', 'cinnosti'],
    keywordsEn: ['tasks', 'todo', 'activities'],
    tags: ['tasks'],
  },

  // People
  {
    id: 'people',
    title: 'Lidé',
    titleEn: 'People',
    description: 'Kontakty a CRM',
    descriptionEn: 'Contacts and CRM',
    href: '/dashboard/people',
    icon: 'Users',
    keywords: ['lide', 'kontakty', 'crm', 'adopce'],
    keywordsEn: ['people', 'contacts', 'crm', 'adopters'],
    tags: ['people'],
    permission: 'people.read',
  },

  // Reports
  {
    id: 'reports',
    title: 'Reporty',
    titleEn: 'Reports',
    description: 'Statistiky a reporty',
    descriptionEn: 'Statistics and reports',
    href: '/dashboard/reports',
    icon: 'BarChart3',
    keywords: ['reporty', 'statistiky', 'prehled', 'data'],
    keywordsEn: ['reports', 'statistics', 'analytics', 'data'],
    tags: ['reports'],
  },

  // Settings
  {
    id: 'settings',
    title: 'Nastavení',
    titleEn: 'Settings',
    description: 'Nastavení systému',
    descriptionEn: 'System settings',
    href: '/dashboard/settings',
    icon: 'Settings',
    keywords: ['nastaveni', 'konfigurace', 'admin'],
    keywordsEn: ['settings', 'configuration', 'admin'],
    tags: ['settings'],
  },
  {
    id: 'settings.organization',
    title: 'Nastavení organizace',
    titleEn: 'Organization Settings',
    description: 'Nastavení útulku',
    descriptionEn: 'Shelter settings',
    href: '/dashboard/settings/organization',
    icon: 'Building',
    keywords: ['organizace', 'utulek', 'nastaveni'],
    keywordsEn: ['organization', 'shelter', 'settings'],
    tags: ['settings'],
    permission: 'admin',
  },
]
