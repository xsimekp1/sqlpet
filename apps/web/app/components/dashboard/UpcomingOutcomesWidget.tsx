'use client';

import { useEffect, useState } from 'react';
import { Calendar, ArrowRight, Loader2, User, Dog, Cat, Rabbit, Bird } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import ApiClient, { UpcomingOutcome } from '@/app/lib/api';

interface UpcomingOutcomesWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

const speciesIcons: Record<string, React.ElementType> = {
  dog: Dog,
  cat: Cat,
  rabbit: Rabbit,
  bird: Bird,
  other: Rabbit,
};

export function UpcomingOutcomesWidget({ editMode, onRemove, dragHandleProps }: UpcomingOutcomesWidgetProps) {
  const t = useTranslations('dashboard')
  const [outcomes, setOutcomes] = useState<UpcomingOutcome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOutcomes = async () => {
      try {
        setLoading(true);
        const data = await ApiClient.getUpcomingOutcomes(30);
        setOutcomes(data);
      } catch {
        setOutcomes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOutcomes();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)} dní zpožděno`, overdue: true };
    if (diffDays === 0) return { text: 'Dnes', overdue: false, urgent: true };
    if (diffDays === 1) return { text: 'Zítra', overdue: false, urgent: true };
    if (diffDays <= 7) return { text: `${diffDays} dní`, overdue: false };
    return { text: date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }), overdue: false };
  };

  const getAnimalPhoto = (outcome: UpcomingOutcome) => {
    if (outcome.animal_photo_url) return outcome.animal_photo_url;
    return null;
  };

  const getReasonLabel = (reason: string | null | undefined) => {
    switch (reason) {
      case 'surrender': return 'Odevzdání';
      case 'found': return 'Nalez';
      case 'return': return 'Návrat';
      case 'transfer': return 'Převoz';
      case 'hotel': return 'Hotel';
      case 'birth': return 'Narozeny';
      default: return reason || 'Jiné';
    }
  };

  return (
    <WidgetCard
      id="upcoming-outcomes"
      title={t('upcomingOutcomes')}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="h-full"
    >
      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : outcomes.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('noUpcomingOutcomes')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {outcomes.slice(0, 5).map((outcome) => {
            const dateInfo = formatDate(outcome.planned_outcome_date);
            const AnimalIcon = speciesIcons[outcome.animal_species] || Rabbit;
            const photo = getAnimalPhoto(outcome);
            
            return (
              <Link
                key={outcome.id}
                href={`/dashboard/animals/${outcome.animal_id}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group transition-colors"
              >
                {/* Animal photo or icon */}
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={outcome.animal_name}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <AnimalIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm truncate group-hover:text-primary">
                      {outcome.animal_name}
                    </span>
                    {outcome.animal_public_code && (
                      <span className="text-xs text-muted-foreground">
                        ({outcome.animal_public_code})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{getReasonLabel(outcome.reason)}</span>
                    {outcome.planned_person_name && (
                      <>
                        <span>→</span>
                        <span className="flex items-center gap-0.5">
                          <User className="h-3 w-3" />
                          {outcome.planned_person_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Date */}
                {dateInfo && (
                  <span className={`text-xs shrink-0 ${
                    dateInfo.overdue ? 'text-red-500 font-medium' : 
                    dateInfo.urgent ? 'text-orange-500 font-medium' : 
                    'text-muted-foreground'
                  }`}>
                    {dateInfo.text}
                  </span>
                )}
              </Link>
            );
          })}
          
          {outcomes.length > 5 && (
            <Link
              href="/dashboard/animals"
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary pt-2"
            >
              <span>+{outcomes.length - 5} dalších</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
