'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function BlogPage() {
  return (
    <div 
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
              🐾 Petslog Blog
            </h1>
            <p className="text-teal-100 text-lg">
              Novinky a příběhy z vývoje útulkového systému
            </p>
          </div>

          {/* Blog post */}
          <article className="mb-12 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-teal-200 uppercase tracking-wide">Blog</span>
              <span className="text-xs text-teal-200/60">•</span>
              <span className="text-xs text-teal-200/60">25. února 2026</span>
            </div>
            <h2 className="text-white font-semibold text-xl mb-4">
              Dneska máme takový malý milník: přihlásili jsme náš projekt do výběru Sary Polak –{" "}
              <a 
                href="https://www.instagram.com/_sara_polak/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-teal-300 hover:text-teal-200 underline"
              >
                15 Founders. One New Renaissance.
              </a>
            </h2>
            <div className="text-teal-100 text-sm leading-relaxed space-y-3">
              <p>
                Je to iniciativa, která v březnu a dubnu vezme patnáctku lidí, co staví věci mimo vyjeté koleje — a pomůže jim to dotáhnout do veřejného launche a postavit kolem toho komunitu. Ne jako další akcelerátor, spíš jako "atelier": méně šablon, víc rukou na díle.
              </p>
              <p>
                A teď je to jednoduché: uvidíme, jestli se dostaneme mezi 15 postupujících. Držte palce. 🙂
              </p>
              <p>
                Jestli to klapne, budeme to celé stavět víc veřejně než doteď — jakmile budu moct, nasdílím víc detailů.
              </p>
            </div>
          </article>

          {/* Footer note */}
          <div className="text-center pt-8 border-t border-white/10">
            <p className="text-teal-200 text-sm">
              Sledujte nás pro další novinky 🚀
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
