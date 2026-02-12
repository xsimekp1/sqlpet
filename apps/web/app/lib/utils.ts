import { Animal } from './api';

export function getAnimalImageUrl(animal: Animal): string {
  if (animal.primary_photo_url) {
    return animal.primary_photo_url;
  }
  
  // Default obrázky podle druhu
  switch (animal.species) {
    case 'dog':
      return '/dog-default.png';
    case 'cat':
      // TODO: Přidat cat-default.png v budoucnu
      return '/placeholder-animal.svg';
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