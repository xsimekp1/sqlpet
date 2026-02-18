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
    highLabel: 'social_reactive',
    lowIcon: '/personality/dog_social_friendly_noglow.png',
    highIcon: '/personality/dog_social_reactive_noglow.png',
  },
  {
    key: 'activity',
    lowLabel: 'activity_calm',
    highLabel: 'activity_hyper',
    lowIcon: '/personality/dog_activity_calm_noglow.png',
    highIcon: '/personality/dog_activity_hyper_noglow.png',
  },
  {
    key: 'kids',
    lowLabel: 'kids_gentle',
    highLabel: 'kids_risk',
    lowIcon: '/personality/dog_kids_gentle_noglow.png',
    highIcon: '/personality/dog_kids_risk_noglow.png',
  },
] as const;

const CAT_AXES = [
  {
    key: 'social',
    lowLabel: 'social_solo',
    highLabel: 'social_friendly',
    lowIcon: '/personality/cat_social_solo_noglow.png',
    highIcon: '/personality/cat_social_friendly_noglow.png',
  },
  {
    key: 'activity',
    lowLabel: 'activity_calm',
    highLabel: 'activity_hyper',
    lowIcon: '/personality/cat_activity_calm_noglow.png',
    highIcon: '/personality/cat_activity_hyper_noglow.png',
  },
  {
    key: 'cudliness',
    lowLabel: 'cudliness_not',
    highLabel: 'cudliness_cuddly',
    lowIcon: '/personality/cat_cudliness_not_cuddly_noglow.png',
    highIcon: '/personality/cat_cudliness_cuddly_noglow.png',
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
  const t = useTranslations('personality');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src={lowIcon}
            alt={t(lowLabel)}
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
          <span className="text-sm font-medium">{t(lowLabel)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t(highLabel)}</span>
          <Image
            src={highIcon}
            alt={t(highLabel)}
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[0, 1, 2, 3, 4].map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onChange(step)}
            className={cn(
              'flex-1 h-10 rounded-lg border-2 transition-all',
              value === step
                ? 'border-primary bg-primary/10'
                : 'border-muted hover:border-muted-foreground'
            )}
          >
            <span className="text-lg font-bold">{step + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PersonalityTab({ species }: PersonalityTabProps) {
  const [values, setValues] = useState({
    social: 2,
    activity: 2,
    kids: 2,
  });

  const axes = species === 'dog' ? DOG_AXES : CAT_AXES;

  const handleChange = (key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{species === 'dog' ? '🐕' : '🐱'} Personality</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
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
