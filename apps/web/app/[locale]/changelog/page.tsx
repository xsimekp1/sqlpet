'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function ChangelogPage() {
  return (
    <div 
      className="changelog-page"
      style={{ 
        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ background: 'transparent' }}>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-24 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 right-1/4 w-80 h-80 rounded-full bg-white/5" />
      </div>

      <div className="relative z-10" style={{ position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <header className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between">
            <Link href="/cs" className="flex items-center gap-2">
              <Image
                src="/petslog.png"
                alt="Petslog"
                width={140}
                height={93}
                className="drop-shadow-md"
                priority
              />
            </Link>
            <Link href="/cs">
              <Button variant="outline" className="border-white/60 text-white hover:bg-white/10 bg-transparent">
                Zpět na úvod
              </Button>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16" style={{ background: 'transparent' }}>
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              🐾 Petslog Changelog
            </h1>
            <p className="text-teal-100 text-lg">
              Co je nového v útulkovém systému
            </p>
          </div>

          {/* Week 14-20.2. */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 14. – 20. února 2026</span>
            </h2>
            <ul className="space-y-3">
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🎨 Nová landing page</span>
                <p className="text-teal-100 text-sm mt-1">
                  Krásná vstupní stránka s galerií našich zvířátek a přehledem funkcí
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">📄 Šablony dokumentů</span>
                <p className="text-teal-100 text-sm mt-1">
                  Vytvářejte dokumenty ze šablon – adopční smlouvy, protokoly
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🏷️ QR kódy</span>
                <p className="text-teal-100 text-sm mt-1">
                  Nově odkazují na veřejné profily zvířat – skvělé pro návštěvy
                </p>
              </li>
            </ul>
          </section>

          {/* Week 7-13.2. */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 7. – 13. února 2026</span>
            </h2>
            <ul className="space-y-3">
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🔍 Chytré vyhledávání</span>
                <p className="text-teal-100 text-sm mt-1">
                  Hledejte zvířata, lidi, úkoly i funkce – najde i synonyma jako „pes" nebo „pesák"
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🛒 Nákupní objednávky</span>
                <p className="text-teal-100 text-sm mt-1">
                  Kompletní systém objednávek a sledování dodávek do skladu
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🔒 GDPR</span>
                <p className="text-teal-100 text-sm mt-1">
                  Logy přihlášení, export dat, automatické generování DPA smlouvy
                </p>
              </li>
            </ul>
          </section>

          {/* Starší novinky */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 Starší novinky</span>
            </h2>
            <ul className="space-y-3">
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">💉 Očkovací průkazy</span>
                <p className="text-teal-100 text-sm mt-1">
                  Sledování vakcinací s upozorněním na končící platnost
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">⚖️ Legální lhůty</span>
                <p className="text-teal-100 text-sm mt-1">
                  Automatické výpočty lhůt pro nalezená zvířata (2 a 4 měsíce)
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🗺️ Mapa nálezů</span>
                <p className="text-teal-100 text-sm mt-1">
                  Interaktivní mapa nalezených zvířat s pokročilými filtry
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🏨 Hotel</span>
                <p className="text-teal-100 text-sm mt-1">
                  Rezervace a přehled psů v hotelovém pobytu
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">💬 Chat</span>
                <p className="text-teal-100 text-sm mt-1">
                  Interní messaging pro komunikaci v týmu útulku
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🎀 Barevné obojky</span>
                <p className="text-teal-100 text-sm mt-1">
                  Sledování barvy obojku – skvělé pro velké útulky
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🎨 Témata</span>
                <p className="text-teal-100 text-sm mt-1">
                  3 barevná schémata: Teal Shelter, Berry Rescue, Safari
                </p>
              </li>
              <li className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <span className="font-semibold text-white block">🥚 Easter Egg</span>
                <p className="text-teal-100 text-sm mt-1">
                  Překvapení pro ty, kteří objeví všechny funkce 😉🐕
                </p>
              </li>
            </ul>
          </section>

          {/* Footer note */}
          <div className="text-center pt-8 border-t border-white/10">
            <p className="text-teal-200 text-sm">
              Changelog vychází každý pátek večer 🚀
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
