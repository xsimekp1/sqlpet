'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PersonalityTabProps {
  species: 'dog' | 'cat';
}

const DOG_AXES = [
  {
    key: 'social',
    lowLabel: 'social_friendly',
    highLabel: 'social_risk',
    lowIcon: '/personality/dog_symbols_social_friendly_alpha01.png',
    highIcon: '/personality/dog_symbols_social_risk_alpha01.png',
  },
  {
    key: 'activity',
    lowLabel: 'activity_calm',
    highLabel: 'activity_hyper',
    lowIcon: '/personality/dog_symbols_activity_calm_alpha01.png',
    highIcon: '/personality/dog_symbols_activity_hyper_alpha01.png',
  },
  {
    key: 'kids',
    lowLabel: 'kids_gentle',
    highLabel: 'kids_risk',
    lowIcon: '/personality/dog_symbols_kids_gentle_alpha01.png',
    highIcon: '/personality/dog_symbols_kids_risk_alpha01.png',
  },
] as const;

const CAT_AXES = [
  {
    key: 'social',
    lowLabel: 'social_friendly',
    highLabel: 'social_risk',
    lowIcon: '/personality/cat_symbols_social_friendly_alpha01.png',
    highIcon: '/personality/cat_symbols_social_risk_alpha01.png',
  },
  {
    key: 'activity',
    lowLabel: 'activity_calm',
    highLabel: 'activity_hyper',
    lowIcon: '/personality/cat_symbols_activity_calm_alpha01.png',
    highIcon: '/personality/cat_symbols_activity_hyper_alpha01.png',
  },
  {
    key: 'cudliness',
    lowLabel: 'cudliness_not',
    highLabel: 'cudliness_cuddly',
    lowIcon: '/personality/cat_symbols_cudliness_not_cuddly_alpha01.png',
    highIcon: '/personality/cat_symbols_cudliness_cuddly_alpha01.png',
  },
] as const;

function StepSlider({
  value,
  onChange,
  lowIcon,
  highIcon,
  lowLabel,
  highLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  lowIcon: string;
  highIcon: string;
  lowLabel: string;
  highLabel: string;
}) {
  const t = useTranslations('animals');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src={lowIcon}
            alt={t(`personality.${lowLabel}`)}
            width={48}
            height={48}
            className="w-12 h-12 object-contain"
          />
          <span className="text-sm font-medium">{t(`personality.${lowLabel}`)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t(`personality.${highLabel}`)}</span>
          <Image
            src={highIcon}
            alt={t(`personality.${highLabel}`)}
            width={48}
            height={48}
            className="w-12 h-12 object-contain"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onChange(step)}
            className={cn(
              'flex-1 h-6 rounded border-2 transition-all text-xs font-semibold',
              value === step
                ? 'border-primary bg-primary/10'
                : 'border-muted hover:border-muted-foreground'
            )}
          >
            {step + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PersonalityTab({ species }: PersonalityTabProps) {
  const [values, setValues] = useState(() => {
    const defaults = { social: 2, activity: 2 };
    if (species === 'dog') {
      return { ...defaults, kids: 2 };
    }
    return { ...defaults, cudliness: 2 };
  });

  const axes = species === 'dog' ? DOG_AXES : CAT_AXES;

  const handleChange = (key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{species === 'dog' ? '🐕' : '🐱'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {axes.map((axis) => (
          <StepSlider
            key={axis.key}
            value={values[axis.key as keyof typeof values]}
            onChange={(v) => handleChange(axis.key, v)}
            lowIcon={axis.lowIcon}
            highIcon={axis.highIcon}
            lowLabel={axis.lowLabel}
            highLabel={axis.highLabel}
          />
        ))}
      </CardContent>
    </Card>
  );
}
