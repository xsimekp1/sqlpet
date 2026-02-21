'use client';

import { useTranslations } from 'next-intl';
import { Baby } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  COLLAR_COLORS,
  COLLAR_COLOR_CONFIG,
  CollarColor,
} from '@/app/lib/collarColors';

interface OffspringCollarPreviewProps {
  count: number;
  motherName: string;
  colors: (CollarColor | null)[];
  onColorsChange: (colors: (CollarColor | null)[]) => void;
}

export function OffspringCollarPreview({
  count,
  motherName,
  colors,
  onColorsChange,
}: OffspringCollarPreviewProps) {
  const t = useTranslations('birth');

  const handleColorChange = (index: number, newColor: CollarColor | null) => {
    const updated = [...colors];
    updated[index] = newColor;
    onColorsChange(updated);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{t('offspringPreview')}</h4>
      <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2 border rounded-lg bg-white">
            <div className="flex items-center gap-2 flex-1">
              <Baby className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {motherName} – mládě {i + 1}
              </span>
            </div>

            <Select
              value={colors[i] || 'none'}
              onValueChange={(val) =>
                handleColorChange(i, val === 'none' ? null : val as CollarColor)
              }
            >
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t('noCollar')}
                </SelectItem>
                {COLLAR_COLORS.map(color => (
                  <SelectItem key={color} value={color}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${COLLAR_COLOR_CONFIG[color].bg}`} />
                      {t(`colors.${color}`)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {colors[i] && (
              <div
                className={`w-8 h-8 rounded ${COLLAR_COLOR_CONFIG[colors[i]!].bg}`}
                title={t(`colors.${colors[i]}`)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
