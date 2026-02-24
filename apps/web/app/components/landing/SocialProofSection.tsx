'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeadModal } from './LeadModal';

const testimonials = [
  {
    avatar: '👤',
    name: 'Reference přidáme brzy',
    text: 'Testujeme s prvními útulky. Vaše zpětná vazba nám pomáhá budovat lepší systém.',
  },
  {
    avatar: '👤',
    name: 'Reference přidáme brzy',
    text: 'Zapojte se do beta programu a jako první získejte přístup ke všem funkcím.',
  },
  {
    avatar: '👤',
    name: 'Reference přidáme brzy',
    text: 'Beta uživatelé pomáhají formovat produkt a získají zvýhodněné podmínky.',
  },
];

export function SocialProofSection() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="py-20 sm:py-28 bg-teal-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Navrženo pro reálný provoz. V ČR, pro ČR.
          </h2>
          <p className="text-lg text-teal-200 max-w-2xl mx-auto">
            Pracujeme s prvními útulky na testování. Připojte se i vy.
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {testimonials.map((t, i) => (
            <Card key={i} className="bg-white/10 border-white/10 text-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                    {t.avatar}
                  </div>
                  <div className="font-medium text-sm text-white/90">{t.name}</div>
                </div>
                <p className="text-sm text-teal-100 leading-relaxed italic">
                  &ldquo;{t.text}&rdquo;
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Beta CTA */}
        <div className="text-center">
          <p className="text-teal-200 mb-4">
            Jste útulek? Zapojte se do beta programu a pomáhejte nám budovat lepší systém.
          </p>
          <Button
            size="lg"
            className="bg-white text-teal-700 hover:bg-teal-50 font-semibold px-8"
            onClick={() => setModalOpen(true)}
          >
            Zapojit se do beta programu →
          </Button>
        </div>
      </div>

      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultInterest="beta"
      />
    </section>
  );
}
