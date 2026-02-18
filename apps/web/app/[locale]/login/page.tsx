'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
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

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'login.emailRequired' })
    .email({ message: 'login.emailInvalid' }),
  password: z.string().min(1, { message: 'login.passwordRequired' }),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const t = useTranslations();
  const { login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoggingIn(true);
    try {
      sessionStorage.setItem('logoAnimated', 'true');
      await login(data.email, data.password);
    } catch (error) {
      setIsLoggingIn(false);
      const errorMessage = error instanceof Error ? error.message : t('login.error');
      toast.error(errorMessage);
      form.setError('root', {
        message: errorMessage,
      });
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      {/* Logo - always visible, stays on top */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 transition-all duration-[1200ms] ease-in-out z-50 ${
          isLoggingIn
            ? 'top-1/2 -translate-y-1/2 scale-125'
            : 'top-[45%]'
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

      {/* Login Form - fades out on submit */}
      <div
        className={`w-full max-w-md transition-all duration-[600ms] ease-out ${
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
                {form.formState.errors.root && (
                  <div className="text-sm text-red-500">
                    {form.formState.errors.root.message}
                  </div>
                )}
                <Button type="submit" className="w-full">
                  {t('login.submit')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
