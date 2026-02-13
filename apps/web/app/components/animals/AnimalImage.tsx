import Image from 'next/image';
import { Animal } from '@/app/lib/api';
import { getAnimalImageUrl } from '@/app/lib/utils';

interface AnimalImageProps {
  animal: Animal;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { width: 64, height: 64, className: 'w-16 h-16' },
  md: { width: 96, height: 96, className: 'w-24 h-24' },
  lg: { width: 128, height: 128, className: 'w-32 h-32' }
};

const sexBorderColor: Record<string, string> = {
  male: 'ring-1 ring-blue-400',
  female: 'ring-1 ring-pink-400',
  unknown: '',
};

export function AnimalImage({ animal, size = 'md', className = '' }: AnimalImageProps) {
  const config = sizes[size];
  const imageUrl = getAnimalImageUrl(animal);
  const ringClass = sexBorderColor[animal.sex] ?? '';

  return (
    <div className={`relative ${config.className} ${className}`}>
      <Image
        src={imageUrl}
        alt={animal.name}
        width={config.width}
        height={config.height}
        className={`rounded-lg object-cover shadow-sm ${ringClass}`}
        onError={(e) => {
          e.currentTarget.src = '/placeholder-animal.svg';
        }}
      />
    </div>
  );
}