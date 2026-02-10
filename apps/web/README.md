# PawShelter Web Frontend

Next.js 14+ frontend for the PawShelter animal shelter management system.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui (Radix UI)
- **Internationalization**: next-intl (cs/en)
- **Forms**: React Hook Form + Zod
- **State Management**: Zustand (planned for M2+)
- **API Client**: Axios with JWT auth
- **Toast Notifications**: sonner

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Backend API running (see `apps/api/README.md`)

### Installation

```bash
cd apps/web
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The app will redirect to `/cs/login` by default (Czech locale).

### Build

```bash
npm run build
```

### Production

```bash
npm run build
npm start
```

## Project Structure

```
apps/web/
├── app/
│   ├── [locale]/           # Localized routes
│   │   ├── login/          # Login page
│   │   ├── select-org/     # Organization selection
│   │   ├── dashboard/      # Protected dashboard
│   │   ├── layout.tsx      # Locale layout with providers
│   │   └── page.tsx        # Root redirect
│   ├── components/         # Shared components
│   │   └── LanguageSwitcher.tsx
│   ├── context/            # React contexts
│   │   └── AuthContext.tsx # Authentication state
│   ├── lib/                # Utilities
│   │   └── api.ts          # API client
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Global styles
│   └── providers.tsx       # Provider stack
├── components/             # shadcn/ui components
│   └── ui/
├── messages/               # i18n translations
│   ├── cs.json            # Czech
│   └── en.json            # English
├── public/                 # Static files
├── i18n.ts                # next-intl config
├── middleware.ts          # Locale middleware
├── next.config.ts         # Next.js config
└── tailwind.config.ts     # Tailwind config
```

## Features (Milestone 1)

### ✅ Implemented

- [x] Next.js 14 App Router with TypeScript
- [x] TailwindCSS + shadcn/ui components
- [x] Internationalization (cs/en) with next-intl
- [x] API client with JWT authentication
- [x] Login page with form validation
- [x] Organization selection
- [x] Protected routes (dashboard)
- [x] Language switcher
- [x] Vercel deployment ready

### 📋 Planned (Milestone 2+)

- [ ] App shell layout (sidebar, topbar, bottom nav)
- [ ] RBAC-aware navigation
- [ ] Dashboard with widgets
- [ ] Global search (cmd+k)
- [ ] Animals module
- [ ] Intake wizard
- [ ] Kennels map
- [ ] Medical/feeding daily operations
- [ ] PWA + offline support
- [ ] Volunteer microapp
- [ ] Public listing

## Authentication Flow

1. User visits the app → redirects to `/cs/login` (or `/en/login`)
2. User enters email and password
3. API client sends credentials to backend `/auth/login`
4. Backend returns JWT access token and refresh token
5. Tokens are stored in localStorage
6. API client fetches user profile `/auth/me`
7. If user has multiple memberships → `/select-org`
8. If user has one membership → auto-select → `/dashboard`
9. User selects organization → `/dashboard`
10. Protected routes check authentication and selected org

## API Endpoints Used

- `POST /auth/login` - Login with email/password (OAuth2 form)
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user profile + memberships
- `POST /auth/logout` - Logout (revoke token)

## Localization

The app supports Czech (cs) and English (en) languages. All UI text is translated through next-intl.

To add or modify translations, edit:
- `messages/cs.json` (Czech)
- `messages/en.json` (English)

Translation keys follow the pattern:
```
{section}.{key}
```

Example:
```typescript
const t = useTranslations('login');
t('title'); // "Přihlášení" (cs) or "Login" (en)
```

## Deployment

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed Vercel deployment instructions.

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

1. Connect GitHub repository
2. Set root directory to `apps/web`
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://joyful-elegance.up.railway.app`
4. Deploy!

## Testing

Test credentials (from backend seed data):
- Email: `admin@example.com`
- Password: (check `apps/api/src/app/db/seed_data.py`)

## Troubleshooting

### "Failed to fetch" on login
- Ensure backend is running on the configured `NEXT_PUBLIC_API_URL`
- Check CORS configuration in backend allows requests from frontend

### Token expired
- Tokens expire after 15 minutes by default
- Refresh token logic will be implemented in Milestone 2

### Language not switching
- Clear browser cache
- Check that locale is in the URL (`/cs/...` or `/en/...`)

## Contributing

Follow the project conventions:
- All code and variable names in English
- UI text through i18n (cs/en)
- Use shadcn/ui components for consistency
- Follow the file naming conventions (kebab-case for files, PascalCase for components)

## License

Private project - all rights reserved.
