'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

interface DefaultImage {
  id: string;
  species: string;
  image_url: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sqlpet-production.up.railway.app';

async function fetchRandomImages(): Promise<DefaultImage[]> {
  const res = await fetch(`${API_BASE_URL}/api/public/default-images/random?count=12`);
  if (!res.ok) throw new Error('Failed to fetch images');
  return res.json();
}

function StaggeredImage({ 
  changeInterval,
  images,
  offset,
}: { 
  changeInterval: number;
  images: DefaultImage[];
  offset: number;
}) {
  const [index, setIndex] = useState(offset % images.length);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initialDelay = setTimeout(() => setIsReady(true), offset);
    return () => clearTimeout(initialDelay);
  }, [offset]);

  useEffect(() => {
    if (!isReady || images.length === 0) return;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % images.length);
    }, changeInterval);
    return () => clearInterval(timer);
  }, [changeInterval, isReady, images.length]);

  if (images.length === 0) return null;

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
            src={images[index].image_url}
            alt={`${images[index].species} v útulku`}
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
  const { data: images = [], isLoading } = useQuery({
    queryKey: ['defaultImages'],
    queryFn: fetchRandomImages,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-4">
        <div className="hidden md:flex items-center justify-center gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 w-[220px] h-[220px] animate-pulse" />
          ))}
        </div>
        <div className="md:hidden">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 w-[220px] h-[220px] animate-pulse" />
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mobile: single image */}
      <div className="md:hidden">
        <StaggeredImage changeInterval={3000} images={images} offset={0} />
      </div>

      {/* Desktop: 3 images in a row, staggered changes */}
      <div className="hidden md:flex items-center justify-center gap-4">
        <StaggeredImage changeInterval={3000} images={images} offset={0} />
        <StaggeredImage changeInterval={3000} images={images} offset={1} />
        <StaggeredImage changeInterval={3000} images={images} offset={2} />
      </div>
    </div>
  );
}
