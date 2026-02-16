'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ApiClient from '@/app/lib/api';

export function AnimalsPrefetcher() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.prefetchQuery({
      queryKey: ['animals'],
      queryFn: () => ApiClient.getAnimals({ page_size: 200 }),
      staleTime: 10 * 60 * 1000,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
