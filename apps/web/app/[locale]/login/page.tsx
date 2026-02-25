'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher';
import ApiClient from '@/app/lib/api';

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'login.emailRequired' })
    .email({ message: 'login.emailInvalid' }),
  password: z.string().min(1, { message: 'login.passwordRequired' }),
  totpCode: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      totpCode: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoggingIn(true);
    try {
      if (requires2FA) {
        await login(data.email, data.password, data.totpCode);
      } else {
        try {
          await login(data.email, data.password);
        } catch (error: any) {
          if (error.message === '2FA_REQUIRED') {
            setRequires2FA(true);
            setIsLoggingIn(false);
            return;
          }
          throw error;
        }
      }
    } catch (error) {
      setIsLoggingIn(false);
      let errorMessage: string;
      if (error instanceof Error) {
        if (error.message.toLowerCase().includes('password')) {
          errorMessage = t('login.wrongPassword');
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = t('login.error');
      }
      toast.error(errorMessage);
      form.setError('root', {
        message: errorMessage,
      });
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      {/* Logo - above form, fixed position from top */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-50 ${
          isLoggingIn
            ? 'top-1/2 -translate-y-1/2 scale-125 transition-all duration-[1200ms] ease-in-out'
            : 'top-8 transition-all duration-[1200ms] ease-in-out'
        }`}
      >
        <Image
          src="/petslog.png"
          alt="Petslog"
          width={360}
          height={240}
          className="drop-shadow-md"
          priority
        />
      </div>

      {/* Login Form - below logo */}
      <div
        className={`w-full max-w-md transition-all duration-[600ms] ease-out mt-48 ${
          isLoggingIn
            ? 'opacity-0 translate-y-4'
            : 'translate-y-0 opacity-100'
        }`}
      >
        <Card className="border-slate-200 dark:border-slate-700 shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">
                {t('login.title')}
              </CardTitle>
              <LanguageSwitcher />
            </div>
            <CardDescription>{t('login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('login.email')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="admin@example.com"
                          autoComplete="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('login.password')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Link href={`/${locale}/forgot-password`} className="text-sm text-primary hover:underline">
                    {t('login.forgotPassword')}
                  </Link>
                </div>
                {requires2FA && (
                  <FormField
                    control={form.control}
                    name="totpCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>2FA kód</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            placeholder="000000"
                            autoComplete="one-time-code"
                            maxLength={6}
                            className="font-mono text-center tracking-widest"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {form.formState.errors.root && (
                  <div className="text-sm text-red-500">
                    {form.formState.errors.root.message}
                  </div>
                )}
                <Button type="submit" className="w-full">
                  {requires2FA ? 'Přihlásit se' : t('login.submit')}
                </Button>
                {requires2FA && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setRequires2FA(false);
                      form.setValue('totpCode', '');
                    }}
                  >
                    Zpět k heslu
                  </Button>
                )}
                <div className="text-center text-sm">
                  {t('login.noAccount')}{' '}
                  <Link href={`/${locale}/register`} className="text-primary hover:underline">
                    {t('login.registerLink')}
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Logo video - below login form, extending off-screen */}
      </div>
      <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[120%] max-w-lg -z-10">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-32 w-auto mx-auto"
        >
          <source src="/vidu-video-3172321556102224.webm" type="video/webm" />
        </video>
      </div>
    </div>
  );
}
