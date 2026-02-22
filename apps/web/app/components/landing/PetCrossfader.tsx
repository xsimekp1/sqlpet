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

export function PetCrossfader() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-center w-[220px] h-[220px] mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute"
        >
          <Image
            src={images[currentIndex]}
            alt="Zvíře v útulku"
            width={200}
            height={200}
            priority={currentIndex === 0}
            style={{ objectFit: 'contain' }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
