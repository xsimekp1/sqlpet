import type { ElementType } from 'react';
import { PawPrint, Heart, Package, MapPin, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FeatureItem {
  text: string;
  soon?: boolean;
}

interface FeatureCategory {
  icon: ElementType;
  title: string;
  items: FeatureItem[];
}

const categories: FeatureCategory[] = [
  {
    icon: PawPrint,
    title: 'Provoz útulku',
    items: [
      { text: 'Zvířata: grid/tabulka, fotky, detail, celá historie' },
      { text: 'Identifikátory: čip, tetování, obojek/tag' },
      { text: 'Kotce, umístění, timeline pohybů' },
      { text: 'Hotel & foster: rezervace, timeline obsazenosti' },
      { text: 'Konverze foster → adopce' },
      { text: 'Veřejný výpis adoptabilních zvířat + embed widget' },
    ],
  },
  {
    icon: Heart,
    title: 'Péče',
    items: [
      { text: 'Krmení: plány per zvíře, denní přehled, logy' },
      { text: 'Léky: automatické plánování další dávky' },
      { text: 'Očkování, procedury, controlled substance' },
      { text: 'Venčení, behavior profil, bite history' },
      { text: 'Keyword engine → okamžitý alert při kritické události' },
    ],
  },
  {
    icon: Package,
    title: 'Sklad / inventář',
    items: [
      { text: 'Položky s kategorií, jednotkou, reorder threshold' },
      { text: 'Šarže: číslo, expirace, náklady' },
      { text: 'Transakce: příjem / výdej / úprava' },
      { text: 'Low-stock upozornění, nákupní seznam' },
      { text: 'Nákupní workflow: objednávka → naskladnění', soon: true },
    ],
  },
  {
    icon: MapPin,
    title: 'Nálezy a mapy',
    items: [
      { text: 'Evidence nálezů s GPS lokací na mapě (Leaflet)' },
      { text: 'Propojení nálezu na zvíře / incident' },
      { text: 'Automatické deadliny (2/4 měsíce)', soon: true },
    ],
  },
  {
    icon: FileText,
    title: 'Reporty & dokumenty',
    items: [
      { text: 'Tiskové šablony: smlouvy, předávací protokoly' },
      { text: 'QR kódy pro kotce i zvířata (batch sheet)' },
      { text: 'E-podpis adopčních smluv' },
      { text: 'Export dat: CSV / PDF' },
    ],
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Vše, co útulek potřebuje
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Komplexní nástroj od evidence zvířat přes sklad až po e-podpis smluv.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.title}
                className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
                    <Icon className="size-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg">{cat.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {cat.items.map((item) => (
                    <li key={item.text} className="flex items-start gap-2">
                      <span className="text-teal-500 mt-0.5 flex-shrink-0 text-sm">✓</span>
                      <span className="text-sm text-gray-600 leading-snug">
                        {item.text}
                        {item.soon && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 text-xs py-0 px-1.5 border-amber-300 text-amber-600"
                          >
                            Brzy
                          </Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
