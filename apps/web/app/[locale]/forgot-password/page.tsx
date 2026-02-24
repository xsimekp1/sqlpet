'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

const requestSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'login.emailRequired' })
    .email({ message: 'login.emailInvalid' }),
});

const resetSchema = z.object({
  newPassword: z.string().min(8, { message: 'login.passwordMinLength' }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'register.passwordsNotMatch',
  path: ['confirmPassword'],
});

type RequestFormValues = z.infer<typeof requestSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const requestForm = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onRequestSubmit = async (data: RequestFormValues) => {
    setIsSubmitting(true);
    try {
      await ApiClient.post('/auth/forgot-password', { email: data.email });
      setEmailSent(true);
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetSubmit = async (data: ResetFormValues) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await ApiClient.post('/auth/reset-password', {
        token,
        new_password: data.newPassword,
      });
      toast.success(t('forgotPassword.resetSuccess'));
      router.push(`/${router.locale}/login`);
    } catch (error) {
      toast.error(t('forgotPassword.resetError'));
    } finally {
      setIsSubmitting(false);
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

      {/* Form */}
      <div className="w-full max-w-md mt-32">
        <Card className="border-slate-200 dark:border-slate-700 shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">
                {token ? t('forgotPassword.resetTitle') : t('forgotPassword.title')}
              </CardTitle>
              <LanguageSwitcher />
            </div>
            <CardDescription>
              {token ? t('forgotPassword.resetSubtitle') : t('forgotPassword.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent && !token ? (
              <div className="text-center space-y-4">
                <div className="text-green-600 text-lg">✓</div>
                <p>{t('forgotPassword.emailSent')}</p>
                <Link href={`/${router.locale}/login`}>
                  <Button variant="outline" className="w-full">
                    {t('register.loginLink')}
                  </Button>
                </Link>
              </div>
            ) : token ? (
              <Form {...resetForm}>
                <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                  <FormField
                    control={resetForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register.password')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="••••••••" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={resetForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register.confirmPassword')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="••••••••" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? '...' : t('forgotPassword.resetButton')}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-4">
                  <FormField
                    control={requestForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('login.email')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="jan@utulek.cz" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? '...' : t('forgotPassword.submitButton')}
                  </Button>
                </form>
              </Form>
            )}
            
            <div className="mt-4 text-center text-sm">
              <Link href={`/${router.locale}/login`} className="text-primary hover:underline">
                {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
