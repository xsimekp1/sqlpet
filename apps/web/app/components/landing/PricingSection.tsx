'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LeadModal } from './LeadModal';

const freePlan = {
  name: 'FREE',
  price: '0 Kč',
  period: 'měsíc',
  tagline: 'Do 10 aktivních svěřenců',
  included: [
    'Evidence zvířat a lidí',
    'Kotce / umístění',
    'Základní úkoly',
    'Základní inventář (položky + stav)',
  ],
  excluded: [
    'Tiskové šablony',
    'QR kódy',
    'Pokročilé reporty',
    'Mapové nalezence',
    'Pokročilý sklad (loty, expirace)',
  ],
  cta: 'Začít zdarma',
  ctaInterest: 'free' as const,
  highlight: false,
};

const proPlan = {
  name: 'PRO',
  price: 'Spojte se',
  period: '',
  tagline: 'Pro útulky 10+ svěřenců',
  included: [
    'Vše z plánu FREE',
    'Tiskové šablony (PDF/print)',
    'QR kódy (zvíře + kotec + batch sheet)',
    'Reporty (výkon, provoz, sklad)',
    'Mapové nalezence',
    'Pokročilý sklad (loty, expirace, transakce)',
    'Pokročilé role & oprávnění',
  ],
  excluded: [] as string[],
  cta: 'Domluvit ukázku',
  ctaInterest: 'demo' as const,
  highlight: true,
};

export function PricingSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultInterest, setDefaultInterest] = useState<'free' | 'demo' | 'beta'>('free');

  function openModal(interest: 'free' | 'demo' | 'beta') {
    setDefaultInterest(interest);
    setModalOpen(true);
  }

  const plans = [freePlan, proPlan];

  return (
    <section className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Ceník</h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Začněte zdarma, přejděte na PRO až budete potřebovat více.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative overflow-hidden ${
                plan.highlight
                  ? 'border-2 border-teal-500 shadow-lg shadow-teal-100'
                  : 'border-gray-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-teal-400" />
              )}
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                        {plan.name}
                      </span>
                      {plan.highlight && (
                        <span className="text-xs bg-teal-100 text-teal-700 rounded-full px-2 py-0.5 font-medium">
                          Doporučeno
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-400 text-sm">/ {plan.period}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{plan.tagline}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <ul className="space-y-3 mb-6">
                  {plan.included.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="size-4 text-teal-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                  {plan.excluded.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <X className="size-4 text-gray-300 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-400">{item}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.highlight
                      ? 'bg-teal-600 hover:bg-teal-700 text-white'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }`}
                  onClick={() => openModal(plan.ctaInterest)}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8 max-w-lg mx-auto">
          Hledáme útulky, které nám pomohou systém otestovat v reálném provozu.
          Zavolejte nebo napište, domluvíme se.
        </p>
      </div>

      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultInterest={defaultInterest}
      />
    </section>
  );
}
