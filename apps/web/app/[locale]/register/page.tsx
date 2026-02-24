'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
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
  name: z.string().min(1, { message: 'login.nameRequired' }),
  email: z
    .string()
    .min(1, { message: 'login.emailRequired' })
    .email({ message: 'login.emailInvalid' }),
  phone: z.string().optional(),
  password: z.string().min(8, { message: 'login.passwordMinLength' }),
  confirmPassword: z.string(),
  organizationName: z.string().min(1, { message: 'register.orgNameRequired' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'register.passwordsNotMatch',
  path: ['confirmPassword'],
});

type FormValues = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const [isRegistering, setIsRegistering] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      organizationName: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsRegistering(true);
    try {
      await ApiClient.post('/auth/register', {
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
        organization_name: data.organizationName,
      });
      
      toast.success(t('register.success'), {
        description: t('register.successDesc'),
      });
      
      router.push(`/${locale}/login`);
    } catch (error: any) {
      setIsRegistering(false);
      
      let errorMessage = t('register.error');
      if (error.message?.includes('already registered')) {
        errorMessage = t('register.emailExists');
      }
      
      toast.error(errorMessage);
      form.setError('root', { message: errorMessage });
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      {/* Logo */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50">
        <Image
          src="/petslog.png"
          alt="Petslog"
          width={360}
          height={240}
          className="drop-shadow-md"
          priority
        />
      </div>

      {/* Registration Form */}
      <div className="w-full max-w-md mt-32">
        <Card className="border-slate-200 dark:border-slate-700 shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">
                {t('register.title')}
              </CardTitle>
              <LanguageSwitcher />
            </div>
            <CardDescription>{t('register.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.name')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder={t('register.namePlaceholder')}
                          autoComplete="name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.email')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder={t('register.emailPlaceholder')}
                          autoComplete="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.phone')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder={t('register.phonePlaceholder')}
                          autoComplete="tel"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.organizationName')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder={t('register.organizationNamePlaceholder')}
                          autoComplete="organization"
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
                      <FormLabel>{t('register.password')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder={t('register.passwordPlaceholder')}
                          autoComplete="new-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.confirmPassword')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder={t('register.confirmPasswordPlaceholder')}
                          autoComplete="new-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.formState.errors.root && (
                  <div className="text-sm text-red-500">
                    {form.formState.errors.root.message}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isRegistering}>
                  {isRegistering ? '...' : t('register.submit')}
                </Button>
              </form>
            </Form>
            
            <div className="mt-4 text-center text-sm">
              {t('register.hasAccount')}{' '}
              <Link href={`/${locale}/login`} className="text-primary hover:underline">
                {t('register.loginLink')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
