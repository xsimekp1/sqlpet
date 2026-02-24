import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { I18nProvider, detectLocale } from '../i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function RootLayoutContent() {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, []);

  useEffect(() => {
    if (mounted && !isLoading) {
      if (isAuthenticated) {
        router.replace('/(app)/home');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [mounted, isLoading, isAuthenticated]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [locale, setLocale] = useState(detectLocale());

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider initialLocale={locale}>
          <RootLayoutContent />
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
