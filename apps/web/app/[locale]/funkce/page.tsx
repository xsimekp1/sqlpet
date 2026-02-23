'use client';

import { FeaturesSection } from '@/app/components/landing/FeaturesSection';
import { SecuritySection } from '@/app/components/landing/SecuritySection';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default async function FeaturesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-teal-900 bg-gradient-to-br from-teal-800 via-teal-600 to-teal-500">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-24 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 right-1/4 w-80 h-80 rounded-full bg-white/5" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between">
            <Link href={`/${locale}`} className="flex items-center gap-2">
              <Image
                src="/petslog.png"
                alt="Petslog"
                width={140}
                height={93}
                className="drop-shadow-md"
                priority
              />
            </Link>
            <Link href={`/${locale}`}>
              <Button variant="outline" className="border-white/60 text-white hover:bg-white/10 bg-transparent">
                Zpět na úvod
              </Button>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              🛠️ Funkce
            </h1>
            <p className="text-teal-100 text-lg">
              Kompletní přehled všech funkcí systému
            </p>
          </div>

          <FeaturesSection />
          <SecuritySection />
        </main>
      </div>
    </div>
  );
}
