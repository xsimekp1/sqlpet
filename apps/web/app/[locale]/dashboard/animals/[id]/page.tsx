'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Edit, Trash2, MapPin, Calendar, Loader2, Stethoscope } from 'lucide-react';
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
import { AnimalImage } from '@/app/components/animals/AnimalImage';

export default function AnimalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicalDialogOpen, setMedicalDialogOpen] = useState(false);

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

    fetchAnimal();
  }, [animalId]);

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
            <Link href="/dashboard/animals">
              <Button variant="ghost" size="icon" className="mr-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">{animal.name}</h1>
            <Badge className={getStatusColor(animal.status)}>
              {animal.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mb-4">
            #{animal.public_code} • {animal.species}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center sm:justify-start">
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
              <CardDescription>Core details about this animal</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{animal.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Public Code</p>
                <p className="font-medium">#{animal.public_code}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Species</p>
                <p className="font-medium">{animal.species}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Sex</p>
                <p className="font-medium">
                  {animal.sex === 'male' ? '♂ Male' : animal.sex === 'female' ? '♀ Female' : '? Unknown'}
                </p>
              </div>
              {animal.color && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Color</p>
                  <p className="font-medium">{animal.color}</p>
                </div>
              )}
              {animal.estimated_age_years !== null && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Estimated Age</p>
                  <p className="font-medium">
                    {animal.estimated_age_years} {animal.estimated_age_years === 1 ? 'year' : 'years'}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Intake Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{new Date(animal.intake_date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={getStatusColor(animal.status)}>
                  {animal.status}
                </Badge>
              </div>
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
              <p className="text-muted-foreground text-center py-8">
                Timeline feature coming in M4
              </p>
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
