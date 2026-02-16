'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Package, Stethoscope, Calendar, Loader2, Syringe, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ApiClient, { Animal } from '@/app/lib/api';
import { AnimalImage } from '@/app/components/animals';
import { toast } from 'sonner';
import Link from 'next/link';

// Inventory item interface (minimal for stock display)
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity_current: number;
  quantity_minimum: number;
  unit: string;
}

// Task interface (minimal for medical tasks)
interface Task {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  due_date: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
}

export default function MedicalPage() {
  const t = useTranslations();
  const [quarantineAnimals, setQuarantineAnimals] = useState<Animal[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [medicationStock, setMedicationStock] = useState<InventoryItem[]>([]);
  const [medicalTasks, setMedicalTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk vaccination state
  const [bulkVaccineOpen, setBulkVaccineOpen] = useState(false);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<Set<string>>(new Set());
  const [vaccineType, setVaccineType] = useState<string>('');
  const [vaccineDate, setVaccineDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [vaccineNotes, setVaccineNotes] = useState<string>('');

useEffect(() => {
    const fetchMedicalData = async () => {
      try {
        setLoading(true);

        // Fetch animals in quarantine
        const animalsData = await ApiClient.getAnimals({ status: 'quarantine' });
        setQuarantineAnimals(animalsData.items || []);

        // Fetch all animals for bulk vaccination
        const allAnimalsData = await ApiClient.getAnimals({ page_size: 500 });
        setAllAnimals(allAnimalsData.items || []);

        // Fetch medication/vaccine inventory
        // TODO: Add getInventoryItems method to ApiClient
        // For now, use empty array
        setMedicationStock([]);

        // Fetch medical tasks
        // TODO: Add getTasks method with type filter to ApiClient
        // For now, use empty array
        setMedicalTasks([]);
      } catch (error) {
        toast.error(t('medical.errors.fetchFailed'));
        console.error('Error fetching medical data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMedicalData();
  }, [t]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'quarantine':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleAnimalSelection = (animalId: string) => {
    setSelectedAnimalIds(prev => {
      const next = new Set(prev);
      if (next.has(animalId)) {
        next.delete(animalId);
      } else {
        next.add(animalId);
      }
      return next;
    });
  };

  const selectAllAnimals = () => {
    if (selectedAnimalIds.size === allAnimals.length) {
      setSelectedAnimalIds(new Set());
    } else {
      setSelectedAnimalIds(new Set(allAnimals.map(a => a.id)));
    }
  };

  const resetBulkVaccineDialog = () => {
    setSelectedAnimalIds(new Set());
    setVaccineType('');
    setVaccineDate(new Date().toISOString().split('T')[0]);
    setVaccineNotes('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('medical.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('medical.description')}</p>
      </div>

      {/* Section 1: Animals in Quarantine */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle>{t('medical.quarantine.title')}</CardTitle>
            </div>
            <Badge variant="outline">
              {t('medical.quarantine.count', { count: quarantineAnimals.length })}
            </Badge>
          </div>
          <CardDescription>{t('medical.quarantine.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {quarantineAnimals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('medical.quarantine.noAnimals')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {quarantineAnimals.map((animal) => (
                <Link key={animal.id} href={`/dashboard/animals/${animal.id}`}>
                  <div className="flex items-center gap-3 py-2.5 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
                    <AnimalImage animal={animal} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{animal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{animal.public_code}
                        {animal.current_kennel_code && <> · <span className="font-mono">{animal.current_kennel_code}</span></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Karanténa
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Medication Stock Levels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <CardTitle>{t('medical.stock.title')}</CardTitle>
            </div>
          </div>
          <CardDescription>{t('medical.stock.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('medical.stock.comingSoon')}</p>
            <p className="text-sm mt-2">{t('medical.stock.implementNote')}</p>
          </div>
        </CardContent>
      </Card>

{/* Section 3: Medical Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-green-600" />
              <CardTitle>{t('medical.tasks.title')}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {t('medical.tasks.count', { count: medicalTasks.length })}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setBulkVaccineOpen(true)}>
                <Syringe className="h-4 w-4 mr-1" />
                Hromadné očkování
              </Button>
            </div>
          </div>
          <CardDescription>{t('medical.tasks.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('medical.tasks.comingSoon')}</p>
            <p className="text-sm mt-2">{t('medical.tasks.implementNote')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Daily Medication Schedule (Future) */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <CardTitle>{t('medical.schedule.title')}</CardTitle>
          </div>
          <CardDescription>{t('medical.schedule.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('medical.schedule.comingSoon')}</p>
            <p className="text-sm mt-2">{t('medical.schedule.futureFeature')}</p>
          </div>
</CardContent>
      </Card>

      {/* Bulk Vaccination Dialog */}
      <Dialog open={bulkVaccineOpen} onOpenChange={(open) => {
        setBulkVaccineOpen(open);
        if (!open) resetBulkVaccineDialog();
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5" />
              Hromadné očkování
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Vaccine type and date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Typ očkování</Label>
                <Select value={vaccineType} onValueChange={setVaccineType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte typ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rabies">Vzteklina</SelectItem>
                    <SelectItem value="distemper">Psinka</SelectItem>
                    <SelectItem value="parvovirus">Parvoviróza</SelectItem>
                    <SelectItem value="hepatitis">Infekční hepatitida</SelectItem>
                    <SelectItem value="leptospirosis">Leptospiróza</SelectItem>
                    <SelectItem value="bordetella">Bordetella</SelectItem>
                    <SelectItem value="feline_vaccine">Kočičí očkování</SelectItem>
                    <SelectItem value="other">Jiné</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Datum aplikace</Label>
                <Input
                  type="date"
                  value={vaccineDate}
                  onChange={(e) => setVaccineDate(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Poznámky</Label>
              <Textarea
                value={vaccineNotes}
                onChange={(e) => setVaccineNotes(e.target.value)}
                placeholder="Volitelné poznámky..."
                rows={2}
              />
            </div>

            {/* Animal selection */}
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <Label>Vyberte zvířata ({selectedAnimalIds.size} vybráno)</Label>
                <Button variant="ghost" size="sm" onClick={selectAllAnimals}>
                  {selectedAnimalIds.size === allAnimals.length ? 'Odznačit vše' : 'Vybrat vše'}
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto flex-1 max-h-[300px]">
                <div className="grid grid-cols-2 gap-2 p-2">
                  {allAnimals.map(animal => (
                    <div
                      key={animal.id}
                      onClick={() => toggleAnimalSelection(animal.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedAnimalIds.has(animal.id)
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {selectedAnimalIds.has(animal.id) ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <div className="h-4 w-4 border rounded shrink-0" />
                      )}
                      <AnimalImage animal={animal} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{animal.name}</p>
                        <p className="text-xs text-muted-foreground truncate">#{animal.public_code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setBulkVaccineOpen(false)}>
              Zrušit
            </Button>
            <Button
              disabled={selectedAnimalIds.size === 0 || !vaccineType}
              onClick={() => {
                toast.success(`Vybráno ${selectedAnimalIds.size} zvířat pro očkování ${vaccineType}`);
                setBulkVaccineOpen(false);
                resetBulkVaccineDialog();
              }}
            >
              <Syringe className="h-4 w-4 mr-2" />
              Očkovat ({selectedAnimalIds.size})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
