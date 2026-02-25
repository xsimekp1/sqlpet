'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LeadModal } from './LeadModal';

interface MarketingNavProps {
  locale: string;
}

export function MarketingNav({ locale }: MarketingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href={`/${locale}`} className="flex items-center gap-2">
              <Image
                src="/petslog.png"
                alt="Petslog"
                width={140}
                height={93}
                className="h-10 w-auto"
                priority
              />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2">
              <Link href={`/${locale}/login`}>
                <Button
                  variant="ghost"
                  className={
                    scrolled
                      ? 'text-gray-700 hover:text-teal-700'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                  }
                >
                  Přihlásit se
                </Button>
              </Link>
              <Button
                onClick={() => setModalOpen(true)}
                className={
                  scrolled
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'bg-white text-teal-700 hover:bg-teal-50'
                }
              >
                Domluvit ukázku
              </Button>
            </div>

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`md:hidden ${
                    scrolled
                      ? 'text-gray-700'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-3 mt-8">
                  <Image
                    src="/petslog.png"
                    alt="Petslog"
                    width={140}
                    height={93}
                    className="h-10 w-auto"
                  />
                  <Link href={`/${locale}/login`} onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      Přihlásit se
                    </Button>
                  </Link>
                  <Button
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => {
                      setMobileOpen(false);
                      setModalOpen(true);
                    }}
                  >
                    Domluvit ukázku
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      <LeadModal open={modalOpen} onClose={() => setModalOpen(false)} defaultInterest="free" />
    </>
  );
}
