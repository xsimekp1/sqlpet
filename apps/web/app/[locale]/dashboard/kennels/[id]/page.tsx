'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Settings, Users, AlertTriangle, MapPin, Calendar, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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
import { KennelImage } from '@/app/components/kennels/KennelImage';
import ApiClient, { Kennel } from '@/app/lib/api';
import { toast } from 'sonner';

export default function KennelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const kennelId = params.id as string;
  const [kennel, setKennel] = useState<Kennel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKennel = async () => {
      try {
        setLoading(true);
        const data = await ApiClient.getKennel(kennelId);
        setKennel(data);
      } catch (error) {
        toast.error('Failed to load kennel');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (kennelId) {
      fetchKennel();
    }
  }, [kennelId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'closed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'indoor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'outdoor':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'isolation':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'quarantine':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOccupancyStatus = (occupied: number, capacity: number) => {
    if (occupied === 0) return 'empty';
    if (occupied < capacity) return 'partial';
    if (occupied === capacity) return 'full';
    return 'over';
  };

  const getOccupancyStatusColor = (occupied: number, capacity: number) => {
    if (occupied === 0) return 'bg-gray-100 text-gray-800';
    if (occupied < capacity) return 'bg-green-100 text-green-800';
    if (occupied === capacity) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!kennel) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/kennels">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Kennel Not Found</h1>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Kennel not found</p>
            <Link href="/dashboard/kennels">
              <Button className="mt-4">Back to Kennels</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const occupancyPercent = (kennel.occupied_count / kennel.capacity) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/kennels">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{kennel.name}</h1>
            <Badge className={getStatusColor(kennel.status)}>
              {kennel.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            #{kennel.code} • {kennel.zone_name || kennel.zone_id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Kennel Image */}
      <KennelImage kennel={kennel} size="lg" className="w-full max-w-2xl mx-auto" />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="animals">Animals</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Core details about this kennel</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Kennel Code</p>
                <p className="font-medium">{kennel.code}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Zone</p>
                <p className="font-medium">{kennel.zone_name || kennel.zone_id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge className={getTypeColor(kennel.type)}>
                  {kennel.type}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Size</p>
                <Badge variant="outline" className="capitalize">
                  {kennel.size_category}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Capacity</p>
                <p className="font-medium">{kennel.capacity}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Occupancy</p>
                <p className="font-medium">{kennel.occupied_count}/{kennel.capacity}</p>
              </div>
            </CardContent>
          </Card>

          {/* Occupancy Status */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Occupancy Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Current Occupancy</span>
                <span className="font-medium">{occupancyPercent.toFixed(1)}%</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <Badge className={getOccupancyStatusColor(kennel.occupied_count, kennel.capacity)}>
                  {getOccupancyStatus(kennel.occupied_count, kennel.capacity)}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="text-sm">{kennel.occupied_count} of {kennel.capacity}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {kennel.alerts && kennel.alerts.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-700">
                  <AlertTriangle className="h-5 w-5" />
                  Active Alerts ({kennel.alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {kennel.alerts.map((alert, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-sm text-yellow-800">{alert}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="animals">
          <Card>
            <CardHeader>
              <CardTitle>Current Animals</CardTitle>
              <CardDescription>Animals currently in this kennel</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Animal management coming in M4
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Occupancy and maintenance history</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Timeline feature coming in M4
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Log</CardTitle>
              <CardDescription>Track maintenance and cleaning</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Maintenance tracking coming in M4
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}