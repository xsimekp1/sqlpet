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

function ImageFrame({ 
  src, 
  delay 
}: { 
  src: string; 
  delay: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!isVisible) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-2xl flex items-center justify-center w-[220px] h-[220px]" />
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-2xl flex items-center justify-center w-[220px] h-[220px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={src}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Image
            src={src}
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
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mobile: single image */}
      <div className="md:hidden">
        <ImageFrame src={images[index]} delay={0} />
      </div>

      {/* Desktop: 3 images in a row, staggered changes */}
      <div className="hidden md:flex items-center justify-center gap-4">
        <ImageFrame src={images[index]} delay={0} />
        <ImageFrame src={images[(index + 1) % images.length]} delay={800} />
        <ImageFrame src={images[(index + 2) % images.length]} delay={1600} />
      </div>
    </div>
  );
}
