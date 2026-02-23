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

function PetImage({ 
  src, 
  delay, 
  className = '' 
}: { 
  src: string; 
  delay: number; 
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <Image
        src={src}
        alt="Zvíře v útulku"
        width={200}
        height={200}
        style={{ objectFit: 'contain' }}
      />
    </motion.div>
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
    <div className="flex items-center justify-center gap-2 md:gap-4 w-full max-w-2xl mx-auto">
      {/* Mobile: single image */}
      <div className="md:hidden w-[180px] h-[180px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={indices[0]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full flex items-center justify-center"
          >
            <Image
              src={images[indices[0]]}
              alt="Zvíře v útulku"
              width={160}
              height={160}
              priority
              style={{ objectFit: 'contain' }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Desktop: 3 images with staggered animations */}
      <div className="hidden md:flex items-center justify-center gap-2 w-full max-w-2xl">
        <div className="w-[180px] h-[180px] flex items-center justify-center">
          <PetImage src={images[indices[0]]} delay={0} />
        </div>
        <div className="w-[180px] h-[180px] flex items-center justify-center -mt-8">
          <PetImage src={images[indices[1]]} delay={200} />
        </div>
        <div className="w-[180px] h-[180px] flex items-center justify-center -mt-16">
          <PetImage src={images[indices[2]]} delay={400} />
        </div>
      </div>
    </div>
  );
}
