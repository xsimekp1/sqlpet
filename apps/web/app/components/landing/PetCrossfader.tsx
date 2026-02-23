'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

const images = [
  '/animals/dog_labrador_golden.png',
  '/animals/cat_domestic_tabby.png',
  '/animals/dog_husky_black&white.png',
  '/animals/cat_british_blue.png',
  '/animals/dog_german-shepherd_brown.png',
  '/animals/cat_domestic_white.png',
  '/animals/dog_beagle_black-tan-white.png',
  '/animals/dog_poodle_white.png',
];

function StaggeredImage({ 
  changeInterval,
  offset,
}: { 
  changeInterval: number;
  offset: number;
}) {
  const [index, setIndex] = useState(offset % images.length);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initialDelay = setTimeout(() => setIsReady(true), offset);
    return () => clearTimeout(initialDelay);
  }, [offset]);

  useEffect(() => {
    if (!isReady) return;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % images.length);
    }, changeInterval);
    return () => clearInterval(timer);
  }, [changeInterval, isReady]);

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-2xl flex items-center justify-center w-[220px] h-[220px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Image
            src={images[index]}
            alt="Zvíře v útulku"
            width={200}
            height={200}
            priority
            style={{ objectFit: 'contain' }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function PetCrossfader() {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mobile: single image */}
      <div className="md:hidden">
        <StaggeredImage changeInterval={3000} offset={0} />
      </div>

      {/* Desktop: 3 images in a row, staggered changes */}
      <div className="hidden md:flex items-center justify-center gap-4">
        <StaggeredImage changeInterval={3000} offset={0} />
        <StaggeredImage changeInterval={3000} offset={1} />
        <StaggeredImage changeInterval={3000} offset={2} />
      </div>
    </div>
  );
}
