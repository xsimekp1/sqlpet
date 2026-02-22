'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    q: 'Je Petslog česky?',
    a: 'Ano, 100% česky. UI, dokumentace i podpora jsou plně v češtině. Systém lze přepnout i do angličtiny pro mezinárodní organizace.',
  },
  {
    q: 'Pokrývá Petslog českou legislativu?',
    a: 'Ano. Evidence nálezů, KVS hlášení, zákonné lhůty (deadliny 2 a 4 měsíce), smlouvy — vše navrženo dle platné české legislativy pro útulky.',
  },
  {
    q: 'Je Petslog vhodný pro malé útulky?',
    a: 'Ano. Free tier zvládne útulky do 10 aktivních svěřenců — vhodné i pro obec s menším záchytným místem nebo stájí. PRO plán neomezuje počet zvířat.',
  },
  {
    q: 'Jak funguje limit "do 10 svěřenců" ve FREE plánu?',
    a: 'Počítají se aktivní svěřenci, tedy zvířata aktuálně v evidenci útulku. Archivovaná zvířata (propuštěná, adoptovaná) se do limitu nezapočítávají.',
  },
  {
    q: 'Kde jsou data uložena?',
    a: 'Na bezpečném cloudu (PostgreSQL na Railway.app). Data jsou vaše — kdykoliv je exportujete. Neprodáváme je třetím stranám.',
  },
  {
    q: 'Lze data exportovat?',
    a: 'Ano, CSV a PDF export jsou součástí systému. Nesnažíme se vás uzamknout. Pokud se rozhodnete odejít, data dostanete.',
  },
  {
    q: 'Jak začít?',
    a: 'Klikněte na "Vyzkoušet zdarma", vyplňte email a profil útulku. Do 24 hodin vás zkontaktujeme a nastavíme přístup.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(i: number) {
    setOpenIndex((prev) => (prev === i ? null : i));
  }

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Časté dotazy
          </h2>
          <p className="text-lg text-gray-500">
            Máte otázku, která tu není? Napište nám na{' '}
            <a
              href="mailto:info@petslog.cz"
              className="text-teal-600 hover:underline"
            >
              info@petslog.cz
            </a>
          </p>
        </div>

        <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="bg-white">
                <button
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-gray-900">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      'size-4 text-gray-400 flex-shrink-0 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5">
                    <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
