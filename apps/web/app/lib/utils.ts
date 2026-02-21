import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Animal } from './api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined, currency: 'CZK' | 'EUR'): string {
  if (value == null) return '—';
  const symbol = currency === 'EUR' ? '€' : 'Kč';
  const formatted = Number(value).toFixed(2).replace(/\.00$/, '');
  return currency === 'EUR' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

export function getAnimalImageUrl(animal: Animal): string {
  if (animal.thumbnail_url) {
    return animal.thumbnail_url;
  }
  if (animal.primary_photo_url) {
    return animal.primary_photo_url;
  }
  if (animal.default_image_url) {
    return animal.default_image_url;
  }

  // Default obrázky podle druhu
  switch (animal.species) {
    case 'dog':
      return '/dog-default.png';
    case 'cat':
      return '/cat_default.png';
    case 'rabbit':
      return '/placeholder-animal.svg';
    case 'bird':
      return '/placeholder-animal.svg';
    case 'other':
      return '/placeholder-animal.svg';
    default:
      return '/placeholder-animal.svg';
  }
}