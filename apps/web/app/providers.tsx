'use client';

import { AuthProvider } from './context/AuthContext';
import { NextIntlClientProvider } from 'next-intl';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ThemeInitializer } from './components/ThemeInitializer';

export function Providers({
  children,
  messages,
  locale,
}: {
  children: React.ReactNode;
  messages: any;
  locale: string;
}) {
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeInitializer />
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
