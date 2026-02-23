import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../src/stores/authStore';
import { I18nProvider, detectLocale } from '../src/i18n';

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

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, []);

  if (!mounted || isLoading) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="(auth)/login" />
        ) : (
          <Stack.Screen name="(app)/home" />
        )}
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [locale, setLocale] = useState(detectLocale());

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale={locale}>
        <RootLayoutContent />
      </I18nProvider>
    </QueryClientProvider>
  );
}
