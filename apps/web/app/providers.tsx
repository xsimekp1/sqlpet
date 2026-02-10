'use client';

import { AuthProvider } from './context/AuthContext';
import { NextIntlClientProvider } from 'next-intl';
import { Toaster } from 'sonner';

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
      <AuthProvider>
        {children}
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
