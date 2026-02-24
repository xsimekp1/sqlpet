'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LeadModal } from './LeadModal';
import { PetCrossfader } from './PetCrossfader';

export function HeroSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultInterest, setDefaultInterest] = useState<'free' | 'demo' | 'beta'>('free');

  function openModal(interest: 'free' | 'demo' | 'beta') {
    setDefaultInterest(interest);
    setModalOpen(true);
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-800 via-teal-600 to-teal-500 overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-24 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 right-1/4 w-80 h-80 rounded-full bg-white/5" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-teal-100 text-sm mb-8">
            🇨🇿 Navrženo pro útulky v České republice
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Správa útulku<br />bez chaosu.
          </h1>

          <p className="text-lg sm:text-xl text-teal-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Petslog pokrývá českou legislativu a dává vám vše v jednom —
            zvířata, kotce, krmení, zdravotní péči, sklad i adopce.
            Od papírování k modernímu útulku.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <Button
              size="lg"
              className="bg-white text-teal-700 hover:bg-teal-50 font-semibold px-8 shadow-lg"
              onClick={() => openModal('demo')}
            >
              Domluvit ukázku
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/60 text-white hover:bg-white/10 font-semibold px-8"
              onClick={() => openModal('free')}
            >
              Začít zdarma
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-6 text-teal-100 text-sm">
            <span className="flex items-center gap-1.5">🇨🇿 Česká legislativa</span>
            <span className="hidden sm:block text-teal-400">·</span>
            <span className="flex items-center gap-1.5">☁️ Bezpečný cloud</span>
            <span className="hidden sm:block text-teal-400">·</span>
            <span className="flex items-center gap-1.5">📱 Android app v přípravě</span>
          </div>
        </motion.div>

        {/* Pet crossfader */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: 'easeOut' }}
          className="mt-16 mx-auto max-w-2xl"
        >
          <PetCrossfader />
        </motion.div>
      </div>

      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultInterest={defaultInterest}
      />
    </section>
  );
}
