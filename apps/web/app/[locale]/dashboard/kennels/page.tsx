'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, Loader2, Grid, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ApiClient from '@/app/lib/api';
import { toast } from 'sonner';

export default function KennelsPage() {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [kennels, setKennels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'grid'>('grid');

  // Fetch kennels from API
  useEffect(() => {
    const fetchKennels = async () => {
      try {
        setLoading(true);
        const data = await ApiClient.get('/kennels');
        setKennels(data);
      } catch (error) {
        toast.error('Failed to load kennels');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchKennels();
  }, []);

  const getOccupancyStatusColor = (occupied: number, capacity: number) => {
    if (occupied === 0) return 'bg-gray-100 text-gray-800';
    if (occupied < capacity) return 'bg-green-100 text-green-800';
    if (occupied === capacity) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getOccupancyStatus = (occupied: number, capacity: number) => {
    if (occupied === 0) return 'Empty';
    if (occupied < capacity) return 'Partial';
    if (occupied === capacity) return 'Full';
    return 'Over';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('nav.kennels') || 'Kennels'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage shelter kennels and zones
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView(view === 'table' ? 'grid' : 'table')}
          >
            {view === 'table' ? <Grid className="h-4 w-4" /> : <Table className="h-4 w-4" />}
            {view === 'table' ? 'Grid' : 'Table'}
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Kennel
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find kennels by name, code, or zone</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search kennels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kennels Grid/Table */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {kennels.map((kennel) => (
            <Card key={kennel.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{kennel.code}</span>
                  <Badge variant="outline">{kennel.type}</Badge>
                </CardTitle>
                <CardDescription>{kennel.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Occupancy:</span>
                    <Badge className={getOccupancyStatusColor(kennel.occupied_count, kennel.capacity)}>
                      {kennel.occupied_count}/{kennel.capacity} ({getOccupancyStatus(kennel.occupied_count, kennel.capacity)})
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Size:</span>
                    <span className="text-sm font-medium capitalize">{kennel.size_category}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge 
                      variant={kennel.status === 'available' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {kennel.status}
                    </Badge>
                  </div>

                  {kennel.animals_preview && kennel.animals_preview.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm text-muted-foreground">Animals:</span>
                      <div className="flex -space-x-2 mt-1">
                        {kennel.animals_preview.slice(0, 3).map((animal: any) => (
                          <div
                            key={animal.id}
                            className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium"
                            title={animal.name}
                          >
                            {animal.name.slice(0, 2).toUpperCase()}
                          </div>
                        ))}
                        {kennel.animals_preview.length > 3 && (
                          <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium">
                            +{kennel.animals_preview.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Size</th>
                  <th className="text-left p-3">Capacity</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {kennels.map((kennel) => (
                  <tr key={kennel.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{kennel.code}</td>
                    <td className="p-3">{kennel.name}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="capitalize">
                        {kennel.type}
                      </Badge>
                    </td>
                    <td className="p-3 capitalize">{kennel.size_category}</td>
                    <td className="p-3">{kennel.capacity}</td>
                    <td className="p-3">
                      <Badge 
                        variant={kennel.status === 'available' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {kennel.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={getOccupancyStatusColor(kennel.occupied_count, kennel.capacity)}>
                        {kennel.occupied_count}/{kennel.capacity}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {kennels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No kennels found</p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add your first kennel
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}