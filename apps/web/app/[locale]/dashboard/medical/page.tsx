'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Package, Stethoscope, Calendar, Loader2, Syringe, Check, X, Zap } from 'lucide-react';
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

  // Health issues filter
  const [healthFilter, setHealthFilter] = useState<string>('all');

  // Compute animals with health issues
  const healthIssuesAnimals = allAnimals.filter(a => 
    a.is_critical || a.is_pregnant || a.is_diabetic || a.is_lactating || a.is_cancer
  );

  const filteredHealthAnimals = healthFilter === 'all' 
    ? healthIssuesAnimals 
    : healthIssuesAnimals.filter(a => {
        switch (healthFilter) {
          case 'critical': return a.is_critical;
          case 'pregnant': return a.is_pregnant;
          case 'diabetic': return a.is_diabetic;
          case 'lactating': return a.is_lactating;
          case 'cancer': return a.is_cancer;
          default: return true;
        }
      });

  // Bulk vaccination state
  const [bulkVaccineOpen, setBulkVaccineOpen] = useState(false);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<Set<string>>(new Set());
  const [vaccineType, setVaccineType] = useState<string>('');
  const [vaccineDate, setVaccineDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [vaccineNotes, setVaccineNotes] = useState<string>('');
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [availableLots, setAvailableLots] = useState<Array<{ id: string; lot_number: string | null; quantity: number; expires_at: string | null }>>([]);
  const [loadingLots, setLoadingLots] = useState(false);

  // Vaccinations list state
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [vaccinationsPage, setVaccinationsPage] = useState(1);
  const [vaccinationsTotal, setVaccinationsTotal] = useState(0);
  const [vaccineFilterType, setVaccineFilterType] = useState<string>('');
  const [vaccineFilterLot, setVaccineFilterLot] = useState<string>('');

useEffect(() => {
    const fetchMedicalData = async () => {
      try {
        setLoading(true);

        // Fetch animals in quarantine
        const animalsData = await ApiClient.getAnimals({ status: 'quarantine' });
        setQuarantineAnimals(animalsData.items || []);

        // Fetch all animals for bulk vaccination (only valid shelter statuses)
        const allAnimalsData = await ApiClient.getAnimals({ page_size: 500 });
        const validStatuses = ['intake', 'available', 'reserved', 'fostered', 'hold', 'quarantine'];
        setAllAnimals((allAnimalsData.items || []).filter(a => validStatuses.includes(a.status)));

        // Fetch medication/vaccine inventory
        // TODO: Add getInventoryItems method to ApiClient
        // For now, use empty array
        setMedicationStock([]);

        // Fetch medical tasks
        // TODO: Add getTasks method with type filter to ApiClient
        // For now, use empty array
        setMedicalTasks([]);

        // Fetch vaccinations
        const vacsData = await ApiClient.getVaccinations({ page: 1, page_size: 50 });
        setVaccinations(vacsData.items || []);
        setVaccinationsTotal(vacsData.total || 0);
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
    setSelectedLotId('');
    setAvailableLots([]);
  };

  const handleVaccineTypeChange = async (type: string) => {
    setVaccineType(type);
    setSelectedLotId('');
    if (type) {
      setLoadingLots(true);
      try {
        const lots = await ApiClient.getAvailableLots(type);
        setAvailableLots(lots);
      } catch (e) {
        console.error('Failed to load lots:', e);
        setAvailableLots([]);
      } finally {
        setLoadingLots(false);
      }
    } else {
      setAvailableLots([]);
    }
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

      {/* Section: Animals with Health Issues */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-red-600" />
              <CardTitle>{t('medical.healthIssues.title')}</CardTitle>
            </div>
            <Badge variant="outline">
              {t('medical.healthIssues.count', { count: healthIssuesAnimals.length })}
            </Badge>
          </div>
          <CardDescription>{t('medical.healthIssues.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={healthFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHealthFilter('all')}
            >
              {t('medical.healthIssues.filterAll')}
            </Button>
            <Button
              variant={healthFilter === 'critical' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHealthFilter('critical')}
              className={healthFilter === 'critical' ? '' : 'border-red-300 text-red-700 hover:bg-red-50'}
            >
              🔥 {t('medical.healthIssues.filterCritical')}
            </Button>
            <Button
              variant={healthFilter === 'pregnant' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHealthFilter('pregnant')}
              className={healthFilter === 'pregnant' ? '' : 'border-pink-300 text-pink-700 hover:bg-pink-50'}
            >
              🤰 {t('medical.healthIssues.filterPregnant')}
            </Button>
            <Button
              variant={healthFilter === 'lactating' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHealthFilter('lactating')}
              className={healthFilter === 'lactating' ? '' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}
            >
              🍼 {t('medical.healthIssues.filterLactating')}
            </Button>
            <Button
              variant={healthFilter === 'diabetic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHealthFilter('diabetic')}
              className={healthFilter === 'diabetic' ? '' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}
            >
              💉 {t('medical.healthIssues.filterDiabetic')}
            </Button>
            <Button
              variant={healthFilter === 'cancer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHealthFilter('cancer')}
              className={healthFilter === 'cancer' ? '' : 'border-rose-300 text-rose-700 hover:bg-rose-50'}
            >
              🎗️ {t('medical.healthIssues.filterCancer')}
            </Button>
          </div>

          {filteredHealthAnimals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('medical.healthIssues.noAnimals')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredHealthAnimals.map((animal) => (
                <Link key={animal.id} href={`/dashboard/animals/${animal.id}`}>
                  <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <AnimalImage animal={animal} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{animal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{animal.public_code}
                        {animal.current_kennel_code && <> · <span className="font-mono">{animal.current_kennel_code}</span></>}
                      </p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {animal.is_critical && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">🔥 Kritický</span>
                        )}
                        {animal.is_pregnant && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded-full">🤰 Těhotná</span>
                        )}
                        {animal.is_lactating && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">🍼 Kojící</span>
                        )}
                        {animal.is_diabetic && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">💉 Diabetes</span>
                        )}
                        {animal.is_cancer && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full">🎗️ Rakovina</span>
                        )}
                      </div>
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

{/* Section 2: Vaccinations Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-blue-600" />
              <CardTitle>Přehled očkování</CardTitle>
            </div>
            <Badge variant="outline">
              Celkem: {vaccinationsTotal}
            </Badge>
          </div>
          <CardDescription>Seznam provedených očkování</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <Select value={vaccineFilterType || undefined} onValueChange={(v) => { setVaccineFilterType(v === 'all' ? '' : v); setVaccinationsPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Typ očkování" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny typy</SelectItem>
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
            <Input 
              placeholder="Filtrovat podle šarže..." 
              value={vaccineFilterLot}
              onChange={(e) => { setVaccineFilterLot(e.target.value); setVaccinationsPage(1); }}
              className="w-[180px]"
            />
          </div>

          {vaccinations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Žádná očkování</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Zvíře</th>
                    <th className="text-left px-3 py-2 font-medium">Typ</th>
                    <th className="text-left px-3 py-2 font-medium">Datum</th>
                    <th className="text-left px-3 py-2 font-medium">Šarže</th>
                  </tr>
                </thead>
                <tbody>
                  {vaccinations
                    .filter((v: any) => !vaccineFilterType || v.vaccination_type === vaccineFilterType)
                    .filter((v: any) => !vaccineFilterLot || (v.lot_number && v.lot_number.toLowerCase().includes(vaccineFilterLot.toLowerCase())))
                    .map((vac: any) => (
                    <tr key={vac.id} className="border-t">
                      <td className="px-3 py-2">
                        <Link href={`/dashboard/animals/${vac.animal_id}`} className="hover:underline text-primary">
                          {vac.animal_name || vac.animal_public_code || 'Neznámé'}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {vac.vaccination_type === 'rabies' && 'Vzteklina'}
                        {vac.vaccination_type === 'distemper' && 'Psinka'}
                        {vac.vaccination_type === 'parvovirus' && 'Parvoviróza'}
                        {vac.vaccination_type === 'hepatitis' && 'Infekční hepatitida'}
                        {vac.vaccination_type === 'leptospirosis' && 'Leptospiróza'}
                        {vac.vaccination_type === 'bordetella' && 'Bordetella'}
                        {vac.vaccination_type === 'feline_vaccine' && 'Kočičí očkování'}
                        {vac.vaccination_type === 'other' && 'Jiné'}
                        {!['rabies','distemper','parvovirus','hepatitis','leptospirosis','bordetella','feline_vaccine','other'].includes(vac.vaccination_type) && vac.vaccination_type}
                      </td>
                      <td className="px-3 py-2">
                        {new Date(vac.administered_at).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="px-3 py-2">
                        {vac.lot_number || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Typ očkování</Label>
                <Select value={vaccineType} onValueChange={handleVaccineTypeChange}>
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
                <Label>Šarže (volitelné)</Label>
                <Select 
                  value={selectedLotId || undefined}
                  onValueChange={(v) => setSelectedLotId(v === 'none' ? '' : v)}
                  disabled={!vaccineType || loadingLots || availableLots.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingLots ? "Načítání..." : "Vyberte šarži"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez šarže</SelectItem>
                    {availableLots.map(lot => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.lot_number || 'Bez čísla'} ({lot.quantity} ks)
                        {lot.expires_at ? ` - exp: ${lot.expires_at}` : ''}
                      </SelectItem>
                    ))}
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
              onClick={async () => {
                try {
                  const vaccineDateTime = new Date(vaccineDate);
                  for (const animalId of selectedAnimalIds) {
                    await ApiClient.createVaccination({
                      animal_id: animalId,
                      vaccination_type: vaccineType,
                      lot_id: selectedLotId || undefined,
                      administered_at: vaccineDateTime.toISOString(),
                      notes: vaccineNotes || undefined,
                    });
                  }
                  toast.success(`Očkováno ${selectedAnimalIds.size} zvířat`);
                  setBulkVaccineOpen(false);
                  resetBulkVaccineDialog();
                } catch (e: any) {
                  toast.error('Chyba při očkování: ' + (e.message || ''));
                }
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
