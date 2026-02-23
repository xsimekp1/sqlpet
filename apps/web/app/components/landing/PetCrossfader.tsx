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

function ImageFrame({ src, isActive }: { src: string; isActive: boolean }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-2xl flex items-center justify-center w-[220px] h-[220px]">
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.div
            key={src}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
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
        )}
      </AnimatePresence>
    </div>
  );
}

export function PetCrossfader() {
  const [indices, setIndices] = useState([0, 1, 2]);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndices(prev => [
        (prev[0] + 1) % images.length,
        (prev[1] + 1) % images.length,
        (prev[2] + 1) % images.length,
      ]);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mobile: single image */}
      <div className="md:hidden">
        <ImageFrame src={images[indices[0]]} isActive={true} />
      </div>

      {/* Desktop: 3 images in a row with same frame */}
      <div className="hidden md:flex items-center justify-center gap-4">
        <ImageFrame src={images[indices[0]]} isActive={true} />
        <ImageFrame src={images[indices[1]]} isActive={true} />
        <ImageFrame src={images[indices[2]]} isActive={true} />
      </div>
    </div>
  );
}
