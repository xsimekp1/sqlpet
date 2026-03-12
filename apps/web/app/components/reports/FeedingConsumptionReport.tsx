'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ApiClient from '@/app/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Utensils, Loader2, ChevronDown, ChevronRight, Dog, Cat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FoodConsumption {
  food_id: string;
  food_name: string | null;
  total_grams: number;
  feeding_count: number;
}

interface AnimalConsumption {
  animal_id: string;
  animal_name: string | null;
  animal_public_code: string | null;
  species: string | null;
  total_grams: number;
  total_feedings: number;
  by_food: FoodConsumption[];
}

interface ConsumptionReport {
  days: number;
  period_start: string;
  period_end: string;
  items: AnimalConsumption[];
  summary: {
    total_animals: number;
    total_grams: number;
    total_feedings: number;
  };
}

function formatGrams(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`;
  }
  return `${Math.round(grams)} g`;
}

function SpeciesIcon({ species }: { species: string | null }) {
  if (species === 'dog') return <Dog className="h-4 w-4 text-amber-600" />;
  if (species === 'cat') return <Cat className="h-4 w-4 text-purple-600" />;
  return null;
}

export function FeedingConsumptionReport() {
  const [days, setDays] = useState(30);
  const [expandedAnimals, setExpandedAnimals] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<ConsumptionReport>({
    queryKey: ['feeding-consumption-report', days],
    queryFn: () => ApiClient.get('/feeding/consumption/report', { days }),
    staleTime: 5 * 60 * 1000,
  });

  const toggleExpand = (animalId: string) => {
    const newExpanded = new Set(expandedAnimals);
    if (newExpanded.has(animalId)) {
      newExpanded.delete(animalId);
    } else {
      newExpanded.add(animalId);
    }
    setExpandedAnimals(newExpanded);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Spotřeba krmiva
            </CardTitle>
            <CardDescription>
              Kolik kterého krmiva zvířata snědla za zvolené období
            </CardDescription>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32 bg-white">
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
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive">
            Chyba při načítání dat
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold">{data.summary.total_animals}</p>
                <p className="text-sm text-muted-foreground">zvířat</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{formatGrams(data.summary.total_grams)}</p>
                <p className="text-sm text-muted-foreground">celkem</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data.summary.total_feedings}×</p>
                <p className="text-sm text-muted-foreground">krmení</p>
              </div>
            </div>

            {/* Table */}
            {data.items.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Zvíře</TableHead>
                      <TableHead>Druh</TableHead>
                      <TableHead className="text-right">Spotřeba</TableHead>
                      <TableHead className="text-right">Krmení</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((animal) => (
                      <>
                        <TableRow
                          key={animal.animal_id}
                          className={cn(
                            'cursor-pointer hover:bg-muted/50',
                            animal.by_food.length > 0 && 'cursor-pointer'
                          )}
                          onClick={() => animal.by_food.length > 0 && toggleExpand(animal.animal_id)}
                        >
                          <TableCell className="w-8">
                            {animal.by_food.length > 0 && (
                              expandedAnimals.has(animal.animal_id)
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <SpeciesIcon species={animal.species} />
                              <div>
                                <p className="font-medium">{animal.animal_name || 'Neznámé'}</p>
                                {animal.animal_public_code && (
                                  <p className="text-xs text-muted-foreground">{animal.animal_public_code}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {animal.species === 'dog' ? 'Pes' : animal.species === 'cat' ? 'Kočka' : animal.species || '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatGrams(animal.total_grams)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {animal.total_feedings}×
                          </TableCell>
                        </TableRow>

                        {/* Expanded food breakdown */}
                        {expandedAnimals.has(animal.animal_id) && animal.by_food.map((food) => (
                          <TableRow key={`${animal.animal_id}-${food.food_id}`} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell colSpan={2} className="pl-10 text-sm text-muted-foreground">
                              {food.food_name || 'Neznámé krmivo'}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatGrams(food.total_grams)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {food.feeding_count}×
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Žádná data o krmení za zvolené období</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
