'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('language');

  const switchLocale = () => {
    const newLocale = locale === 'cs' ? 'en' : 'cs';

    // Replace the locale in the pathname
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLocale}
      className="gap-2"
      title={locale === 'cs' ? t('en') : t('cs')}
    >
      <Globe className="h-4 w-4" />
      <span className="text-sm font-medium">
        {locale === 'cs' ? 'EN' : 'CS'}
      </span>
    </Button>
  );
}
