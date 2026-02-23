import { Flag, Zap, Package, Wifi, BarChart3, Smartphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const reasons = [
  {
    icon: Flag,
    title: 'Česky a pro ČR',
    description:
      'Pokrývá českou evidenci nálezů, KVS hlášení a smlouvy. Navrženo přesně pro legislativní prostředí ČR.',
  },
  {
    icon: Zap,
    title: 'Rychlý provoz',
    description:
      'Denní přehled léků, krmení a úkolů na jednom místě — pro každého pracovníka, i na telefonu.',
  },
  {
    icon: Package,
    title: 'Sklad se šaržemi',
    description:
      'Šarže, expirace, nákupní seznam a low-stock upozornění. Nikdy více nevyprší léky bez varování.',
  },
  {
    icon: Wifi,
    title: 'Offline-first',
    description:
      'Walk mode funguje bez internetu. Data se synchronizují po připojení — ideální pro venkovní areály.',
  },
  {
    icon: BarChart3,
    title: 'Reporty a tisky',
    description:
      'Smlouvy, předávací protokoly, QR kódy pro kotce i zvířata. E-podpis adopčních smluv přímo v systému.',
  },
  {
    icon: Smartphone,
    title: 'Mobilní aplikace',
    description:
      'Android app s většinou funkcí online platformy. Práce v terénu ještě nikdy nebyla jednodušší.',
    soon: true,
  },
];

export function WhySection() {
  return (
    <section className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Proč Petslog?
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Systém navržený tak, aby fungoval v reálném provozu — ne jen na papíře.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {reasons.map((reason) => {
            const Icon = reason.icon;
            return (
              <Card key={reason.title} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                    <Icon className="size-5 text-teal-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{reason.title}</h3>
                  {reason.soon && (
                    <Badge variant="secondary" className="mb-2">Už brzy</Badge>
                  )}
                  <p className="text-sm text-gray-500 leading-relaxed">{reason.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
