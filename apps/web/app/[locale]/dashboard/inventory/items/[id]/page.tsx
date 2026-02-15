'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/app/lib/api';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Package, TrendingUp, TrendingDown, Calendar, Trash2, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export default function InventoryItemDetailPage() {
  const t = useTranslations('inventory');
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const queryClient = useQueryClient();

  const [addLotOpen, setAddLotOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lotFormData, setLotFormData] = useState({
    lot_number: '',
    expires_at: '',
    quantity: '',
    cost_per_unit: '',
  });

  // Fetch item details
  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['inventory-item', itemId],
    queryFn: () => ApiClient.get(`/inventory/items/${itemId}`),
  });

  // Fetch lots
  const { data: lotsData } = useQuery({
    queryKey: ['inventory-lots', itemId],
    queryFn: () => ApiClient.get('/inventory/lots', { item_id: itemId }),
  });

  // Fetch transactions
  const { data: transactionsData } = useQuery({
    queryKey: ['inventory-transactions', itemId],
    queryFn: () => ApiClient.get('/inventory/transactions', { item_id: itemId }),
  });

  const lots = lotsData?.items || [];
  const transactions = transactionsData?.items || [];

  // Add lot mutation
  const addLotMutation = useMutation({
    mutationFn: async (data: any) => {
      return await ApiClient.post('/inventory/lots', {
        item_id: itemId,
        lot_number: data.lot_number || undefined,
        expires_at: data.expires_at || undefined,
        quantity: Number(data.quantity),
        cost_per_unit: data.cost_per_unit ? Number(data.cost_per_unit) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots', itemId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', itemId] });
      toast({
        title: t('messages.lotCreated'),
        description: t('messages.lotCreatedDesc'),
      });
      setAddLotOpen(false);
      setLotFormData({
        lot_number: '',
        expires_at: '',
        quantity: '',
        cost_per_unit: '',
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: () => ApiClient.deleteInventoryItem(itemId),
    onSuccess: () => {
      toast({ title: t('messages.itemDeleted'), description: t('messages.itemDeletedDesc') });
      router.push('/dashboard/inventory');
    },
    onError: (error: Error) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
      setDeleteConfirmOpen(false);
    },
  });

  const handleAddLot = () => {
    if (!lotFormData.quantity) {
      toast({
        title: 'Validation Error',
        description: 'Quantity is required',
        variant: 'destructive',
      });
      return;
    }
    addLotMutation.mutate(lotFormData);
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      medication: 'bg-red-100 text-red-800',
      vaccine: 'bg-purple-100 text-purple-800',
      food: 'bg-orange-100 text-orange-800',
      supply: 'bg-blue-100 text-blue-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[category] || colors.other} variant="outline">
        {t(`categories.${category}`)}
      </Badge>
    );
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'out':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Package className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    const variants: Record<string, any> = {
      in: { variant: 'default', className: 'bg-green-600' },
      out: { variant: 'destructive', className: '' },
      adjust: { variant: 'secondary', className: '' },
    };
    const config = variants[type] || variants.adjust;
    return (
      <Badge {...config}>
        {t(type as any)}
      </Badge>
    );
  };

  if (itemLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading item...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Item not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
            {getCategoryBadge(item.category)}
          </div>
          <p className="text-muted-foreground">
            Total stock: <span className="font-semibold">{item.total_quantity?.toFixed(2) || '0.00'}</span> {item.unit ? t(`units.${item.unit}`) : ''}
          </p>
        </div>
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete item?</DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{item.name}</strong>. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteItemMutation.mutate()}
                disabled={deleteItemMutation.isPending}
              >
                {deleteItemMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Item Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Package className="h-4 w-4" />
            Total Quantity
          </div>
          <div className="text-2xl font-bold">
            {item.total_quantity?.toFixed(2) || '0.00'} {item.unit || ''}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Package className="h-4 w-4" />
            Active Lots
          </div>
          <div className="text-2xl font-bold">
            {lots.filter((lot: any) => lot.quantity > 0).length}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingDown className="h-4 w-4" />
            Reorder Threshold
          </div>
          <div className="text-2xl font-bold">
            {item.reorder_threshold || '-'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="lots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lots">{t('lots')}</TabsTrigger>
          <TabsTrigger value="transactions">{t('transactions')}</TabsTrigger>
        </TabsList>

        {/* Lots Tab */}
        <TabsContent value="lots" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Inventory Lots</h2>
            <Dialog open={addLotOpen} onOpenChange={setAddLotOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addLot')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('addLot')}</DialogTitle>
                  <DialogDescription>
                    Add a new lot of {item.name} to inventory
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="lot_number">{t('fields.lotNumber')}</Label>
                    <Input
                      id="lot_number"
                      placeholder="e.g. LOT-2024-001"
                      value={lotFormData.lot_number}
                      onChange={(e) =>
                        setLotFormData({ ...lotFormData, lot_number: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires_at">{t('fields.expiresAt')}</Label>
                    <Input
                      id="expires_at"
                      type="date"
                      value={lotFormData.expires_at}
                      onChange={(e) =>
                        setLotFormData({ ...lotFormData, expires_at: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">{t('fields.quantity')} *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 50"
                      value={lotFormData.quantity}
                      onChange={(e) =>
                        setLotFormData({ ...lotFormData, quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_per_unit">{t('fields.costPerUnit')}</Label>
                    <Input
                      id="cost_per_unit"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 25.50"
                      value={lotFormData.cost_per_unit}
                      onChange={(e) =>
                        setLotFormData({ ...lotFormData, cost_per_unit: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddLotOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddLot} disabled={addLotMutation.isPending}>
                    {addLotMutation.isPending ? 'Adding...' : 'Add Lot'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot Number</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Cost/Unit</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No lots found. Add a lot to start tracking inventory.
                    </TableCell>
                  </TableRow>
                ) : (
                  lots.map((lot: any) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {lot.lot_number || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={lot.quantity > 0 ? 'font-semibold' : 'text-muted-foreground'}>
                          {lot.quantity?.toFixed(2)} {item.unit || ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        {lot.expires_at ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(lot.expires_at), 'MMM d, yyyy')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lot.cost_per_unit ? `$${lot.cost_per_unit}` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(lot.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Receipt className="h-10 w-10 opacity-30" />
            <p className="text-sm">{t('transactions.comingSoon' as any)}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
