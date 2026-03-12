'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ApiClient from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Utensils, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ConsumptionHistoryProps {
  animalId: string;
  animalName?: string;
}

interface ConsumptionData {
  animal_id: string;
  days: number;
  total_grams: number;
  total_feedings: number;
  by_food: Array<{
    inventory_item_id: string;
    total_grams: number;
    feeding_count: number;
    food_name: string | null;
  }>;
}

export function ConsumptionHistory({ animalId, animalName }: ConsumptionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery<ConsumptionData>({
    queryKey: ['feeding-consumption', animalId, days],
    queryFn: () => ApiClient.get(`/feeding/consumption/history/${animalId}`, { days }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Utensils className="h-4 w-4" />
          Historie spotřeby
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Historie spotřeby {animalName && `- ${animalName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Období:</span>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dní</SelectItem>
                <SelectItem value="30">30 dní</SelectItem>
                <SelectItem value="90">90 dní</SelectItem>
                <SelectItem value="365">1 rok</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              Chyba při načítání dat
            </div>
          )}

          {data && (
            <>
              {/* Summary */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Celkem snědeno</p>
                      <p className="text-2xl font-bold">
                        {data.total_grams >= 1000
                          ? `${(data.total_grams / 1000).toFixed(1)} kg`
                          : `${Math.round(data.total_grams)} g`}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Počet krmení</p>
                      <p className="text-2xl font-bold">{data.total_feedings}×</p>
                    </div>
                  </div>
                  {data.total_feedings > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Průměr: {Math.round(data.total_grams / data.total_feedings)} g/krmení
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* By food breakdown */}
              {data.by_food.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Podle krmiva</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.by_food.map((item) => (
                      <div
                        key={item.inventory_item_id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium">
                            {item.food_name || 'Neznámé krmivo'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.feeding_count}× nakrmeno
                          </p>
                        </div>
                        <p className="font-semibold">
                          {item.total_grams >= 1000
                            ? `${(item.total_grams / 1000).toFixed(1)} kg`
                            : `${Math.round(item.total_grams)} g`}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : data.total_feedings === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Žádná data o krmení za zvolené období</p>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Krmení nemá přiřazené krmivo
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
