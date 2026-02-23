# Petslog Mobile

Native iOS mobile app for SQLPet / ÚtulekOS animal shelter management system.

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Xcode (for iOS builds)
- Expo CLI

## Installation

```bash
# Install pnpm if not available
npm install -g pnpm

# Install dependencies
cd apps/mobile
pnpm install
```

## Environment Setup

Create `.env` file in `apps/mobile/`:

```bash
# Development (connects to local API)
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_ENV=development

# Staging
EXPO_PUBLIC_API_BASE_URL=https://sqlpet-staging.up.railway.app
EXPO_PUBLIC_ENV=staging

# Production
EXPO_PUBLIC_API_BASE_URL=https://sqlpet-production.up.railway.app
EXPO_PUBLIC_ENV=production
```

Note: Use `10.0.2.2` for Android emulator to access localhost, or your machine's IP for iOS simulator.

## Running the App

### Development with Expo Go

```bash
cd apps/mobile
pnpm dev
```

This starts the Metro bundler. Scan the QR code with:
- **iOS**: Camera app → Expo Go
- **Android**: Expo Go app → Scan QR

### iOS Simulator

```bash
cd apps/mobile
pnpm ios
```

### Android Emulator

```bash
cd apps/mobile
pnpm android
```

## Building for iOS (Outside App Store)

### Step 1: Configure EAS

1. Create an Expo account: https://expo.dev/signup
2. Run `eas login` to authenticate
3. Run `eas project:init` to create an Expo project

### Step 2: Configure iOS App

1. Open Apple Developer Portal
2. Create an App ID (Bundle Identifier)
3. Create an Ad Hoc provisioning profile (for testing on specific devices)
4. Or create an Enterprise certificate (for unlimited internal distribution)

### Step 3: Build

```bash
# Development build (for testing)
eas build -p ios --profile development

# Internal distribution (Ad Hoc)
eas build -p ios --profile preview

# Production
eas build -p ios --profile production
```

### Step 4: Install the Build

After build completes:

1. Download the `.ipa` file from Expo dashboard
2. For Ad Hoc: Install via Xcode → Window → Devices and Simulators → Drag IPA
3. For Enterprise/TestFlight: Install via provided link

## Project Structure

```
apps/mobile/
├── src/
│   ├── app/               # expo-router screens
│   │   ├── (auth)/        # Auth screens (login)
│   │   ├── (app)/         # Protected screens (home)
│   │   └── _layout.tsx    # Root layout with routing
│   ├── lib/
│   │   └── api.ts         # Axios client with interceptors
│   ├── stores/
│   │   └── authStore.ts   # Zustand auth state
│   ├── types/
│   │   └── auth.ts        # TypeScript types
│   ├── constants/
│   │   └── config.ts      # App configuration
│   └── styles/
│       └── globals.css    # NativeWind styles
├── app.json               # Expo configuration
├── eas.json               # EAS Build configuration
├── tailwind.config.js     # Tailwind configuration
└── package.json
```

## Architecture

- **Navigation**: expo-router (file-based routing)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **HTTP Client**: Axios with interceptors
- **Secure Storage**: expo-secure-store (Keychain on iOS)
- **Styling**: NativeWind (Tailwind CSS for RN)

## Authentication Flow

1. User enters email + password
2. App calls `/auth/login` endpoint
3. On success: stores access + refresh tokens in Keychain
4. App fetches user profile from `/auth/me`
5. Token refresh handled automatically by axios interceptors
6. On logout: clears tokens from Keychain

## API Endpoints Used

- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user profile
- `GET /health` - Health check

## Troubleshooting

### Build fails with "No credentials"
Run `eas credentials` to configure your iOS credentials.

### App crashes on startup
Check that `EXPO_PUBLIC_API_BASE_URL` is set correctly and the API is accessible.

### Login fails with CORS
The backend needs to allow requests from the mobile app origin. Add the origin to CORS settings in the backend.

## License

MIT
