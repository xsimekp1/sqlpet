'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Edit, Trash2, MapPin, Calendar, Loader2, Stethoscope, CheckCircle2, XCircle, HelpCircle, AlertTriangle, Pill, Scissors, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ApiClient, { Animal } from '@/app/lib/api';
import { toast } from 'sonner';
import RequestMedicalProcedureDialog from '@/app/components/animals/RequestMedicalProcedureDialog';
import { AnimalImage, EditableAnimalName, EditableAnimalDetails, AssignKennelButton } from '@/app/components/animals';

export default function AnimalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [animalList, setAnimalList] = useState<Animal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [medicalDialogOpen, setMedicalDialogOpen] = useState(false);
  const [togglingDewormed, setTogglingDewormed] = useState(false);
  const [togglingAggressive, setTogglingAggressive] = useState(false);
  const [togglingAltered, setTogglingAltered] = useState(false);
  const [healthEvents, setHealthEvents] = useState<{ text: string; date: Date }[]>([]);

  const animalId = params.id as string;

  useEffect(() => {
    const fetchAnimal = async () => {
      try {
        setLoading(true);
        const data = await ApiClient.getAnimal(animalId);
        setAnimal(data);
      } catch (error) {
        toast.error('Failed to load animal');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const fetchAnimalList = async () => {
      try {
        const result = await ApiClient.getAnimals({ page_size: 1000 });
        setAnimalList(result.items);
        const idx = result.items.findIndex(a => a.id === animalId);
        if (idx >= 0) setCurrentIndex(idx);
      } catch (error) {
        console.error('Failed to load animal list:', error);
      }
    };

    fetchAnimal();
    fetchAnimalList();
  }, [animalId]);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      router.push(`/dashboard/animals/${animalList[currentIndex - 1].id}`);
    }
  };

  const goToNext = () => {
    if (currentIndex < animalList.length - 1) {
      router.push(`/dashboard/animals/${animalList[currentIndex + 1].id}`);
    }
  };

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < animalList.length - 1;
  const showNav = animalList.length > 1;

  const handleAnimalUpdate = (updatedAnimal: Animal) => {
    setAnimal(updatedAnimal);
  };

  const toggleDewormed = async () => {
    if (!animal) return;
    setTogglingDewormed(true);
    try {
      const newVal = !animal.is_dewormed;
      const updated = await ApiClient.updateAnimal(animal.id, { is_dewormed: newVal } as any);
      setAnimal(updated);
      setHealthEvents((prev) => [
        { text: newVal ? 'Odčervení: označeno jako provedené' : 'Odčervení: označeno jako neprovedené', date: new Date() },
        ...prev,
      ]);
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingDewormed(false);
    }
  };

  const toggleAggressive = async () => {
    if (!animal) return;
    setTogglingAggressive(true);
    try {
      const newVal = !animal.is_aggressive;
      const updated = await ApiClient.updateAnimal(animal.id, { is_aggressive: newVal } as any);
      setAnimal(updated);
      setHealthEvents((prev) => [
        { text: newVal ? 'Agresivita: označena jako problematická' : 'Agresivita: označena jako v pořádku', date: new Date() },
        ...prev,
      ]);
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingAggressive(false);
    }
  };

  const toggleAltered = async () => {
    if (!animal) return;
    setTogglingAltered(true);
    try {
      const isCurrentlyAltered = animal.altered_status === 'neutered' || animal.altered_status === 'spayed';
      const newStatus = isCurrentlyAltered ? 'intact' : (animal.sex === 'female' ? 'spayed' : 'neutered');
      const updated = await ApiClient.updateAnimal(animal.id, { altered_status: newStatus } as any);
      setAnimal(updated);
      setHealthEvents((prev) => [
        { text: isCurrentlyAltered ? 'Kastrace: označena jako neprovedená' : 'Kastrace: označena jako provedená', date: new Date() },
        ...prev,
      ]);
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingAltered(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this animal?')) {
      return;
    }

    try {
      await ApiClient.deleteAnimal(animalId);
      toast.success('Animal deleted successfully');
      router.push('/dashboard/animals');
    } catch (error) {
      toast.error('Failed to delete animal');
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'adopted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'fostered':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'transferred':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'deceased':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'escaped':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!animal) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/animals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Animal Not Found</h1>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Animal not found</p>
            <Link href="/dashboard/animals">
              <Button className="mt-4">Back to Animals</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
{/* Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <div className="flex-shrink-0">
          <AnimalImage animal={animal} size="lg" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
            <div className="flex items-center gap-1">
              {showNav && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={goToPrevious}
                  disabled={!hasPrev}
                  className="mr-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Link href="/dashboard/animals">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              {showNav && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={goToNext}
                  disabled={!hasNext}
                  className="ml-1"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <EditableAnimalName 
                animal={animal} 
                onAnimalUpdate={handleAnimalUpdate} 
              />
            </div>
            <Badge className={getStatusColor(animal.status)}>
              {animal.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mb-4">
            #{animal.public_code} • {animal.species}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center sm:justify-start flex-wrap">
            <AssignKennelButton
              animal={animal}
              onAssigned={(kennel) => {
                setAnimal(prev => prev ? {
                  ...prev,
                  current_kennel_id: kennel?.id ?? null,
                  current_kennel_name: kennel?.name ?? null,
                  current_kennel_code: kennel?.code ?? null,
                } : null);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMedicalDialogOpen(true)}
            >
              <Stethoscope className="h-4 w-4 mr-2" />
              {t('medical.requestProcedure')}
            </Button>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="medical">Medical</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
{/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Core details about this animal (click edit buttons to modify)</CardDescription>
            </CardHeader>
            <CardContent>
              <EditableAnimalDetails 
                animal={animal} 
                onAnimalUpdate={handleAnimalUpdate} 
              />
            </CardContent>
          </Card>

          {/* Days in Shelter */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Days in Shelter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">
                {Math.floor(
                  (new Date().getTime() - new Date(animal.intake_date).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Since {new Date(animal.intake_date).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>

          {/* Health & Welfare */}
          <Card>
            <CardHeader>
              <CardTitle>{t('animals.health.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Neutered / Spayed */}
              <div className="flex items-center gap-3">
                {animal.altered_status === 'neutered' || animal.altered_status === 'spayed' ? (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Scissors className="h-4 w-4 text-green-600" />
                  </div>
                ) : animal.altered_status === 'intact' ? (
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <HelpCircle className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <span className="text-sm font-medium">{t('animals.health.neutered')}</span>
                <button
                  className="ml-auto text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={toggleAltered}
                  disabled={togglingAltered}
                  title={t('animals.health.toggleAltered')}
                >
                  {togglingAltered ? '...' : (animal.altered_status === 'neutered' || animal.altered_status === 'spayed' ? t('animals.health.markIntact') : t('animals.health.markAltered'))}
                </button>
              </div>

              {/* Dewormed */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${animal.is_dewormed ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Pill className={`h-4 w-4 ${animal.is_dewormed ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <span className="text-sm font-medium">{t('animals.health.dewormed')}</span>
                <button
                  className="ml-auto text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={toggleDewormed}
                  disabled={togglingDewormed}
                  title={t('animals.health.toggleDewormed')}
                >
                  {animal.is_dewormed ? t('animals.health.yes') : t('animals.health.no')}
                </button>
              </div>

              {/* Aggressive */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${animal.is_aggressive ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <AlertTriangle className={`h-4 w-4 ${animal.is_aggressive ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <span className="text-sm font-medium">{t('animals.health.aggressive')}</span>
                <button
                  className="ml-auto text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={toggleAggressive}
                  disabled={togglingAggressive}
                  title={t('animals.health.toggleAggressive')}
                >
                  {animal.is_aggressive ? t('animals.health.aggressiveWarning') : t('animals.health.no')}
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                Activity history for this animal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-border" />

                {/* Health toggle events (most recent first) */}
                {healthEvents.map((ev, i) => (
                  <div key={i} className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-blue-400 border-2 border-background" />
                    <div className="pl-2">
                      <p className="text-sm font-semibold">{ev.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.date.toLocaleTimeString()} · {ev.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Event: intake */}
                {animal.intake_date && (
                  <div className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
                    <div className="pl-2">
                      <p className="text-sm font-semibold">Příjem do útulku</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(animal.intake_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Event: created in system */}
                <div className="relative mb-6">
                  <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-background" />
                  <div className="pl-2">
                    <p className="text-sm font-semibold">Záznam vytvořen v systému</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(animal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  {/* TODO: M4 - load full event history from API */}
                  Plná historie událostí bude přidána v M4.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical">
          <Card>
            <CardHeader>
              <CardTitle>Medical Records</CardTitle>
              <CardDescription>
                Health history and medical procedures
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Medical records coming in M4
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Files and attachments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Documents coming in M5+
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Medical Request Dialog */}
      {animal && (
        <RequestMedicalProcedureDialog
          animal={animal}
          open={medicalDialogOpen}
          onOpenChange={setMedicalDialogOpen}
        />
      )}
    </div>
  );
}
