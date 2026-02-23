'use client';

import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

interface FeatureItem {
  text: string;
  soon?: boolean;
}

interface FeatureCategory {
  title: string;
  emoji: string;
  items: FeatureItem[];
  screenshot?: string;
}

const categories: FeatureCategory[] = [
  {
    title: 'Profily zvířat',
    emoji: '🐾',
    items: [
      { text: 'Detailní karta zvířete s celou jeho historií' },
      { text: 'Osobnostní profil: povaha, chování, speciální potřeby' },
      { text: 'Timeline všech událostí – od přijetí po adopci' },
      { text: 'Fotogalerie a dokumenty' },
      { text: 'Identifikátory: čip, tetování, passport' },
    ],
    screenshot: '/images/features/profily-zvirat.png',
  },
  {
    title: 'Sklad / inventář',
    emoji: '📦',
    items: [
      { text: 'Položky s kategorií, jednotkou, minimálním stavem' },
      { text: 'Šarže: číslo, expirace, náklady' },
      { text: 'Transakce: příjem / výdej / úprava' },
      { text: 'Low-stock upozornění, nákupní seznam' },
      { text: 'Nákupní workflow: objednávka → naskladnění', soon: true },
    ],
    screenshot: '/images/features/sklad.png',
  },
  {
    title: 'Léky a zdravotní péče',
    emoji: '💊',
    items: [
      { text: 'Automatické plánování dávek' },
      { text: 'Denní přehled – co je potřeba podat' },
      { text: 'Očkovací průkazy s upozorněním na končící platnost' },
      { text: 'Očkování, procedury, controlled substance' },
      { text: 'Veterinární návštěvy a diagnózy' },
    ],
    screenshot: '/images/features/leky.png',
  },
  {
    title: 'Reporty a dokumenty',
    emoji: '📄',
    items: [
      { text: 'Tiskové šablony: smlouvy, předávací protokoly' },
      { text: 'E-podpis adopčních smluv' },
      { text: 'Export dat: CSV / PDF' },
      { text: 'Audit log – kdo co změnil a kdy' },
    ],
    screenshot: '/images/features/dokumenty.png',
  },
  {
    title: 'Krmení',
    emoji: '🍖',
    items: [
      { text: 'Krmné plány per zvíře' },
      { text: 'Denní přehled – co a kdy krmit' },
      { text: 'Logy – co bylo skutečně podáno' },
    ],
    screenshot: '/images/features/krmeni.png',
  },
  {
    title: 'Kotce a umístění',
    emoji: '🏠',
    items: [
      { text: 'Přehled všech kotců a jejich obsazenosti' },
      { text: 'Timeline pohybů zvířat' },
      { text: 'Typy: vnitřní, venkovní, izolace, karanténa' },
      { text: 'Kapacita a volná místa' },
    ],
    screenshot: '/images/features/kotce.png',
  },
  {
    title: 'Veřejné profily & QR kódy',
    emoji: '🌐',
    items: [
      { text: 'Veřejný výpis adoptabilních zvířat' },
      { text: 'QR kódy na kotcích – návštěvníci načtou mobilem a hned vidí info' },
      { text: 'Embed widget pro web útulku' },
      { text: 'Sdíletelné profily zvířat' },
    ],
    screenshot: '/images/features/verejne-profily.png',
  },
  {
    title: 'Foster péče',
    emoji: '🤝',
    items: [
      { text: 'Správa foster rodin' },
      { text: 'Rezervace a timeline obsazenosti' },
      { text: 'Převod foster → adopce' },
    ],
    screenshot: '/images/features/foster.png',
  },
  {
    title: 'Nálezy a mapy',
    emoji: '🗺️',
    items: [
      { text: 'Evidence nálezů s GPS lokací na mapě' },
      { text: 'Propojení nálezu na zvíře / incident' },
      { text: 'Automatické deadliny (2/4 měsíce)', soon: true },
    ],
    screenshot: '/images/features/nalezy.png',
  },
  {
    title: 'Rychlé akce',
    emoji: '⚡',
    items: [
      { text: 'Mobilní režim "Procházka po útulku" – rychlé akce u kotce' },
      { text: 'Barevné obojky pro mláďata – 8 barev pro identifikaci ve vrhu' },
      { text: 'Keyword engine → okamžitý alert při kritické události' },
    ],
    screenshot: '/images/features/rychle-akce.png',
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 sm:py-28 bg-teal-900 bg-gradient-to-br from-teal-800 via-teal-600 to-teal-500">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Vše, co útulek potřebuje
          </h2>
          <p className="text-lg text-teal-100 max-w-2xl mx-auto">
            Komplexní nástroj od evidence zvířat přes sklad až po e-podpis smluv.
          </p>
        </div>

        <div className="space-y-6">
          {categories.map((cat, idx) => (
            <div
              key={cat.title}
              className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl">{cat.emoji}</span>
                  <h3 className="font-semibold text-white text-xl">{cat.title}</h3>
                  <span className="text-teal-300 text-sm ml-auto">
                    {idx + 1} / {categories.length}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <ul className="space-y-2.5">
                    {cat.items.map((item) => (
                      <li key={item.text} className="flex items-start gap-2">
                        <span className="text-teal-300 mt-0.5 flex-shrink-0 text-sm">✓</span>
                        <span className="text-sm text-teal-50 leading-snug">
                          {item.text}
                          {item.soon && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs py-0 px-1.5 border-amber-300 text-amber-200 bg-amber-900/20"
                            >
                              Brzy
                            </Badge>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="relative aspect-video lg:aspect-square bg-white/5 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center">
                    {cat.screenshot ? (
                      <Image
                        src={cat.screenshot}
                        alt={cat.title}
                        fill
                        className="object-cover rounded-xl"
                      />
                    ) : (
                      <span className="text-teal-300/50 text-sm">
                        Screenshot – {cat.title}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
