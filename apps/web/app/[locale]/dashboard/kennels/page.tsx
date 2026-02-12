'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Plus, Search, Loader2, Grid, Table, MapPin, Settings, 
  Footprints, MoreHorizontal, AlertTriangle, Users, Edit
} from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ApiClient, { Kennel, KennelAnimal } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';



interface FilterState {
  zone_id: string;
  status: string;
  type: string;
  size_category: string;
  occupancy: string;
}

export default function KennelsPage() {
  const t = useTranslations('kennels');
  const [search, setSearch] = useState('');
  const [kennels, setKennels] = useState<Kennel[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'grid'>('grid');
  const [filters, setFilters] = useState<FilterState>({
    zone_id: '',
    status: '',
    type: '',
    size_category: '',
    occupancy: '',
  });

  // Fetch kennels from API
  useEffect(() => {
    const fetchKennels = async () => {
      try {
        setLoading(true);
        const params: any = {};
        
        if (filters.zone_id) params.zone_id = filters.zone_id;
        if (filters.status) params.status = filters.status;
        if (filters.type) params.type = filters.type;
        if (filters.size_category) params.size_category = filters.size_category;
        if (search) params.q = search;
        
        const data = await ApiClient.getKennels(params);
        setKennels(data);
      } catch (error) {
        toast.error(t('errors.fetchFailed') || 'Failed to load kennels');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchKennels();
  }, [filters, search]);

  const getOccupancyStatusColor = (occupied: number, capacity: number) => {
    if (occupied === 0) return 'bg-gray-100 text-gray-800';
    if (occupied < capacity) return 'bg-green-100 text-green-800';
    if (occupied === capacity) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getOccupancyStatus = (occupied: number, capacity: number) => {
    if (occupied === 0) return 'empty';
    if (occupied < capacity) return 'partial';
    if (occupied === capacity) return 'full';
    return 'over';
  };

  const getZoneColor = (zoneId: string) => {
    const colors = {
      'A': 'bg-blue-100 text-blue-800',
      'B': 'bg-green-100 text-green-800',
      'C': 'bg-purple-100 text-purple-800',
      'D': 'bg-orange-100 text-orange-800',
    };
    return colors[zoneId[0] as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'default';
      case 'maintenance': return 'secondary';
      case 'closed': return 'destructive';
      default: return 'outline';
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      'indoor': 'bg-blue-100 text-blue-800',
      'outdoor': 'bg-green-100 text-green-800',
      'isolation': 'bg-red-100 text-red-800',
      'quarantine': 'bg-yellow-100 text-yellow-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const filteredKennels = kennels.filter(kennel => {
    const matchesSearch = !search || 
      kennel.code.toLowerCase().includes(search.toLowerCase()) ||
      kennel.name.toLowerCase().includes(search.toLowerCase()) ||
      kennel.animals_preview?.some(animal => 
        animal.name.toLowerCase().includes(search.toLowerCase())
      );
    
    const matchesZone = !filters.zone_id || kennel.zone_id === filters.zone_id;
    const matchesStatus = !filters.status || kennel.status === filters.status;
    const matchesType = !filters.type || kennel.type === filters.type;
    const matchesSize = !filters.size_category || kennel.size_category === filters.size_category;
    
    const matchesOccupancy = !filters.occupancy || 
      getOccupancyStatus(kennel.occupied_count, kennel.capacity) === filters.occupancy;

    return matchesSearch && matchesZone && matchesStatus && matchesType && matchesSize && matchesOccupancy;
  });

  const AnimalAvatar = ({ animal }: { animal: KennelAnimal }) => {
    if (animal.photo_url) {
      return (
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
          <Image
            src={animal.photo_url}
            alt={animal.name}
            width={32}
            height={32}
            className="object-cover"
          />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium">
        {animal.name.slice(0, 2).toUpperCase()}
      </div>
    );
  };

  const KennelCard = ({ kennel }: { kennel: Kennel }) => {
    const occupancyPercent = (kennel.occupied_count / kennel.capacity) * 100;
    
    return (
      <Link href={`/dashboard/kennels/${kennel.id}`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer group">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{kennel.code}</span>
                <Badge className={getZoneColor(kennel.zone_id)}>
                  {kennel.zone_name || kennel.zone_id}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Users className="h-4 w-4 mr-2" />
                    Move Animals
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="h-4 w-4 mr-2" />
                    Set Maintenance
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardDescription className="font-medium">{kennel.name}</CardDescription>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusColor(kennel.status)} className="capitalize">
                {kennel.status}
              </Badge>
              <Badge className={getTypeColor(kennel.type)} variant="outline">
                {kennel.type}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Animal Photo Mosaic */}
            <div className="mb-4">
              {kennel.animals_preview && kennel.animals_preview.length > 0 ? (
                <div className="grid gap-1" style={{
                  gridTemplateColumns: kennel.animals_preview.length <= 4 
                    ? `repeat(${Math.ceil(Math.sqrt(kennel.animals_preview.length))}, 1fr)`
                    : kennel.animals_preview.length <= 9 ? 'repeat(3, 1fr)'
                    : 'repeat(4, 1fr)'
                }}>
                  {kennel.animals_preview.slice(0, 16).map((animal, index) => (
                    <div key={animal.id} className="aspect-square relative rounded overflow-hidden">
                      {animal.photo_url ? (
                        <Image
                          src={animal.photo_url}
                          alt={animal.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs">
                          {animal.name.slice(0, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                  {kennel.animals_preview.length > 16 && (
                    <div className="aspect-square bg-gray-200 rounded flex items-center justify-center text-xs font-medium">
                      +{kennel.animals_preview.length - 16}
                    </div>
                  )}
                </div>
              ) : kennel.primary_photo_path ? (
                <div className="aspect-video relative rounded overflow-hidden">
                  <Image
                    src={kennel.primary_photo_path}
                    alt={kennel.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 rounded flex items-center justify-center text-gray-400">
                  No animals
                </div>
              )}
            </div>

            {/* Occupancy and Alerts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Occupancy</span>
                <span className="text-sm font-medium">
                  {kennel.occupied_count}/{kennel.capacity}
                </span>
              </div>
              <Progress value={occupancyPercent} className="h-2" />
              <div className="flex justify-between items-center">
                <Badge className={getOccupancyStatusColor(kennel.occupied_count, kennel.capacity)}>
                  {t(`occupancy.${getOccupancyStatus(kennel.occupied_count, kennel.capacity)}`)}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="text-xs capitalize">{kennel.size_category}</span>
                </div>
              </div>
              
              {kennel.alerts && kennel.alerts.length > 0 && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs">{kennel.alerts.length} alerts</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
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
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView(view === 'table' ? 'grid' : 'table')}
          >
            {view === 'table' ? <Grid className="h-4 w-4" /> : <Table className="h-4 w-4" />}
            {t(`view.${view === 'table' ? 'grid' : 'table'}`)}
          </Button>
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            {t('quickActions.manageZones')}
          </Button>
          <Button variant="outline" className="gap-2">
            <Footprints className="h-4 w-4" />
            {t('quickActions.walkMode')}
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t('quickActions.addKennel')}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('search')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.zone_id || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, zone_id: value === "all" ? "" : value }))}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('filters.zone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.zone')}</SelectItem>
                {/* TODO: Fetch zones from API */}
                <SelectItem value="A">Zone A</SelectItem>
                <SelectItem value="B">Zone B</SelectItem>
                <SelectItem value="C">Zone C</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "all" ? "" : value }))}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.status')}</SelectItem>
                <SelectItem value="available">{t('status.available')}</SelectItem>
                <SelectItem value="maintenance">{t('status.maintenance')}</SelectItem>
                <SelectItem value="closed">{t('status.closed')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.type || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value === "all" ? "" : value }))}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('filters.type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.type')}</SelectItem>
                <SelectItem value="indoor">{t('type.indoor')}</SelectItem>
                <SelectItem value="outdoor">{t('type.outdoor')}</SelectItem>
                <SelectItem value="isolation">{t('type.isolation')}</SelectItem>
                <SelectItem value="quarantine">{t('type.quarantine')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.occupancy || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, occupancy: value === "all" ? "" : value }))}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('filters.occupancy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.occupancy')}</SelectItem>
                <SelectItem value="empty">{t('occupancy.empty')}</SelectItem>
                <SelectItem value="partial">{t('occupancy.partial')}</SelectItem>
                <SelectItem value="full">{t('occupancy.full')}</SelectItem>
                <SelectItem value="over">{t('occupancy.over')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Kennels Grid/Table */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredKennels.map((kennel) => (
            <KennelCard key={kennel.id} kennel={kennel} />
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
                  <th className="text-left p-3">Zone</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Size</th>
                  <th className="text-left p-3">Capacity</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Animals</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredKennels.map((kennel) => (
                  <tr key={kennel.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">
                      <Link href={`/dashboard/kennels/${kennel.id}`} className="hover:text-primary">
                        {kennel.code}
                      </Link>
                    </td>
                    <td className="p-3">{kennel.name}</td>
                    <td className="p-3">
                      <Badge className={getZoneColor(kennel.zone_id)} variant="outline">
                        {kennel.zone_name || kennel.zone_id}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={getTypeColor(kennel.type)} variant="outline">
                        {kennel.type}
                      </Badge>
                    </td>
                    <td className="p-3 capitalize">{kennel.size_category}</td>
                    <td className="p-3">{kennel.capacity}</td>
                    <td className="p-3">
                      <Badge variant={getStatusColor(kennel.status)} className="capitalize">
                        {kennel.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {kennel.occupied_count === 0 ? (
                        <span className="text-gray-500">Empty</span>
                      ) : kennel.animals_preview && kennel.animals_preview.length === 1 ? (
                        <div className="flex items-center gap-2">
                          <AnimalAvatar animal={kennel.animals_preview[0]!} />
                          <span className="text-sm">{kennel.animals_preview[0]!.name}</span>
                        </div>
                      ) : (
                        <Badge className={getOccupancyStatusColor(kennel.occupied_count, kennel.capacity)}>
                          {kennel.occupied_count} animals
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Users className="h-4 w-4 mr-2" />
                            Move Animals
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Set Maintenance
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filteredKennels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {t(`noResults.${search || Object.values(filters).some(v => v) ? 'withFilter' : 'noFilter'}`)}
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('quickActions.addKennel')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}