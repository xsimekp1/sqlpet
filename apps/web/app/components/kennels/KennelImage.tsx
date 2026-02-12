import Image from 'next/image';
import { Kennel } from '@/app/lib/api';

export function getKennelImageUrl(kennel: Kennel): string {
  if (kennel.primary_photo_path) {
    return kennel.primary_photo_path;
  }
  
  // Default placeholders podle typu kotce
  switch (kennel.type) {
    case 'indoor':
      return '/kennel-indoor-default.png';
    case 'outdoor':
      return '/kennel-outdoor-default.png';
    case 'isolation':
      return '/kennel-isolation-default.png';
    case 'quarantine':
      return '/kennel-quarantine-default.png';
    default:
      return '/kennel-default.png';
  }
}

interface KennelImageProps {
  kennel: Kennel;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { width: 128, height: 96, className: 'w-32 h-24' },
  md: { width: 256, height: 192, className: 'w-64 h-48' }, 
  lg: { width: 512, height: 384, className: 'w-128 h-96' }
};

export function KennelImage({ kennel, size = 'md', className = '' }: KennelImageProps) {
  const config = sizes[size];
  const imageUrl = getKennelImageUrl(kennel);
  
  return (
    <div className={`relative ${config.className} ${className}`}>
      <Image
        src={imageUrl}
        alt={kennel.name}
        width={config.width}
        height={config.height}
        className="rounded-lg object-cover shadow-sm"
        onError={(e) => {
          // Fallback to generic kennel placeholder if specific type fails
          (e.currentTarget as HTMLImageElement).src = '/kennel-default.png';
        }}
        priority={size === 'lg'}
      />
    </div>
  );
}