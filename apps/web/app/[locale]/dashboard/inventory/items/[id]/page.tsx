'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/app/lib/api';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
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
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Package, TrendingUp, TrendingDown, Calendar, Trash2, Receipt, UtensilsCrossed, Pill, Syringe, Archive, Pencil, ArrowDownToLine, ArrowUpFromLine, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  food: <UtensilsCrossed className="h-8 w-8" />,
  medication: <Pill className="h-8 w-8" />,
  vaccine: <Syringe className="h-8 w-8" />,
  supply: <Package className="h-8 w-8" />,
  other: <Archive className="h-8 w-8" />,
};

const SPECIES_LABELS: Record<string, string> = {
  dog: 'Pes',
  cat: 'Kočka',
  rabbit: 'Králík',
  bird: 'Pták',
  small_animal: 'Drobné zvíře',
  reptile: 'Plaz',
  other: 'Jiné',
};

const DECIMAL_UNITS = ['kg', 'g', 'l', 'ml'];

function formatQuantity(value: number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined) return '0';
  if (unit && DECIMAL_UNITS.includes(unit)) {
    return value.toFixed(2);
  }
  return Math.round(value).toString();
}

export default function InventoryItemDetailPage() {
  const t = useTranslations('inventory');
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const itemId = params.id as string;
  const queryClient = useQueryClient();

  const [addLotOpen, setAddLotOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
  const [lotFormData, setLotFormData] = useState({
    lot_number: '',
    expires_at: '',
    quantity: '',
    cost_per_unit: '',
  });
  const [transactionFormData, setTransactionFormData] = useState({
    reason: 'purchase' as 'opening_balance' | 'purchase' | 'donation' | 'consumption' | 'writeoff',
    quantity: '',
    note: '',
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

  const lots = Array.isArray(lotsData) ? lotsData : (lotsData?.items ?? []);
  const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData?.items ?? []);
  const totalQuantity = item?.quantity_current ?? lots.reduce((sum: number, lot: any) => sum + (Number(lot.quantity) || 0), 0);

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
      router.push(`/${locale}/dashboard/inventory`);
    },
    onError: (error: Error) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
      setDeleteConfirmOpen(false);
    },
  });

  const editItemMutation = useMutation({
    mutationFn: (data: { name?: string; kcal_per_100g?: number; reorder_threshold?: number }) => 
      ApiClient.put(`/inventory/items/${itemId}`, data),
    onSuccess: () => {
      toast({ title: t('messages.itemUpdated'), description: t('messages.itemUpdatedDesc') });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', itemId] });
      setEditOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteLotMutation = useMutation({
    mutationFn: (lotId: string) => ApiClient.deleteInventoryLot(lotId),
    onSuccess: () => {
      toast({ title: t('messages.lotDeleted'), description: t('messages.lotDeletedDesc') });
      queryClient.invalidateQueries({ queryKey: ['inventory-lots', itemId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', itemId] });
    },
    onError: (error: Error) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  // Add transaction mutation
  const addTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await ApiClient.createInventoryTransaction({
        item_id: itemId,
        reason: data.reason,
        quantity: Number(data.quantity),
        note: data.note || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions', itemId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-lots', itemId] });
      toast({
        title: t('messages.transactionCreated'),
        description: t('messages.transactionCreatedDesc'),
      });
      setAddTransactionOpen(false);
      setTransactionFormData({
        reason: 'purchase',
        quantity: '',
        note: '',
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

  const handleAddTransaction = () => {
    if (!transactionFormData.quantity || Number(transactionFormData.quantity) <= 0) {
      toast({
        title: t('messages.validationError'),
        description: t('messages.quantityRequired'),
        variant: 'destructive',
      });
      return;
    }
    addTransactionMutation.mutate(transactionFormData);
  };

  const handleAddLot = () => {
    if (!lotFormData.quantity) {
      toast({
        title: t('messages.validationError'),
        description: t('messages.quantityRequired'),
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
        <div className="text-muted-foreground">{t('messages.loadingItem')}</div>
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
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-muted text-muted-foreground shrink-0">
          {CATEGORY_ICONS[item.category] ?? <Package className="h-8 w-8" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
            {getCategoryBadge(item.category)}
          </div>
          <p className="text-muted-foreground">
            {t('totalStock')}: <span className="font-semibold">{formatQuantity(totalQuantity, item.unit)}</span> {item.unit ? t(`units.${item.unit}`) : ''}
          </p>
        </div>
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t('delete')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteItem')}</DialogTitle>
              <DialogDescription>
                {t('deleteItemConfirm', { name: item.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>{t('cancel')}</Button>
              <Button
                variant="destructive"
                onClick={() => deleteItemMutation.mutate()}
                disabled={deleteItemMutation.isPending}
              >
                {deleteItemMutation.isPending ? t('deleting') : t('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Edit Button */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4 mr-1.5" />
              {t('actions.editItem')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('actions.editItem')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t('fields.name')}</Label>
                <Input
                  id="edit-name"
                  defaultValue={item?.name}
                  onChange={(e) => {}}
                />
              </div>
              {item?.category === 'food' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-kcal">{t('fields.kcalPer100g')}</Label>
                  <Input
                    id="edit-kcal"
                    type="number"
                    defaultValue={item?.kcal_per_100g || ''}
                    placeholder="např. 350"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-reorder">{t('fields.reorderThreshold')}</Label>
                <Input
                  id="edit-reorder"
                  type="number"
                  defaultValue={item?.reorder_threshold || ''}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>{t('cancel')}</Button>
              <Button
                onClick={() => {
                  const name = (document.getElementById('edit-name') as HTMLInputElement).value;
                  const kcal = (document.getElementById('edit-kcal') as HTMLInputElement).value;
                  const reorder = (document.getElementById('edit-reorder') as HTMLInputElement).value;
                  editItemMutation.mutate({
                    name: name || undefined,
                    kcal_per_100g: kcal ? Number(kcal) : undefined,
                    reorder_threshold: reorder ? Number(reorder) : undefined,
                  });
                }}
                disabled={editItemMutation.isPending}
              >
                {editItemMutation.isPending ? t('messages.saving') : t('actions.editItem')}
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
            {t('totalQuantity')}
          </div>
          <div className="text-2xl font-bold">
            {formatQuantity(totalQuantity, item.unit)} {item.unit || ''}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Package className="h-4 w-4" />
            {t('activeLots')}
          </div>
          <div className="text-2xl font-bold">
            {lots.filter((lot: any) => lot.quantity > 0).length}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingDown className="h-4 w-4" />
            {t('reorderThreshold')}
          </div>
          <div className="text-2xl font-bold">
            {item.reorder_threshold !== null && item.reorder_threshold !== undefined ? item.reorder_threshold : '-'}
          </div>
        </div>
      </div>

      {/* Kcal (food only) */}
      {item.category === 'food' && item.kcal_per_100g && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <UtensilsCrossed className="h-4 w-4" />
            {t('fields.kcalPer100g')}
          </div>
          <div className="text-2xl font-bold">
            {item.kcal_per_100g} kcal / 100g
          </div>
        </div>
      )}

      {/* Allowed species (food only) */}
      {item.category === 'food' && item.allowed_species?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Vhodné pro:</span>
          {item.allowed_species.map((sp: string) => (
            <Badge key={sp} variant="secondary">{SPECIES_LABELS[sp] || sp}</Badge>
          ))}
        </div>
      )}

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
                    {t('messages.addNewLotTitle', { name: item.name })}
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
                    {t('cancel')}
                  </Button>
                  <Button onClick={handleAddLot} disabled={addLotMutation.isPending}>
                    {addLotMutation.isPending ? t('adding') : t('addLot')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('lotNumber')}</TableHead>
                  <TableHead>{t('quantity')}</TableHead>
                  <TableHead>{t('fields.expiresAt')}</TableHead>
                  <TableHead>{t('fields.costPerUnit')}</TableHead>
                  <TableHead>{t('fields.created')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('noLotsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  lots.map((lot: any) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {lot.lot_number !== null && lot.lot_number !== undefined ? lot.lot_number : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
<span className={lot.quantity > 0 ? 'font-semibold' : 'text-muted-foreground'}>
                          {formatQuantity(lot.quantity, item.unit)} {item.unit || ''}
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
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteLotMutation.mutate(lot.id)}
                          disabled={deleteLotMutation.isPending}
                          title="Delete lot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t('transactions.title')}</h2>
            <Dialog open={addTransactionOpen} onOpenChange={setAddTransactionOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('transactions.add')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('transactions.add')}</DialogTitle>
                  <DialogDescription>
                    {t('messages.addTransactionDesc', { name: item.name })}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">{t('transactions.reason')}</Label>
                    <Select
                      value={transactionFormData.reason}
                      onValueChange={(value) => setTransactionFormData({ ...transactionFormData, reason: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opening_balance">{t('transactions.reasons.opening_balance')}</SelectItem>
                        <SelectItem value="purchase">{t('transactions.reasons.purchase')}</SelectItem>
                        <SelectItem value="donation">{t('transactions.reasons.donation')}</SelectItem>
                        <SelectItem value="consumption">{t('transactions.reasons.consumption')}</SelectItem>
                        <SelectItem value="writeoff">{t('transactions.reasons.writeoff')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tx_quantity">{t('fields.quantity')} *</Label>
                    <Input
                      id="tx_quantity"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 10"
                      value={transactionFormData.quantity}
                      onChange={(e) =>
                        setTransactionFormData({ ...transactionFormData, quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tx_note">{t('transactions.note')}</Label>
                    <Input
                      id="tx_note"
                      placeholder={t('transactions.notePlaceholder')}
                      value={transactionFormData.note}
                      onChange={(e) =>
                        setTransactionFormData({ ...transactionFormData, note: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddTransactionOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button onClick={handleAddTransaction} disabled={addTransactionMutation.isPending}>
                    {addTransactionMutation.isPending ? t('adding') : t('transactions.add')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('transactions.direction')}</TableHead>
                  <TableHead>{t('transactions.reason')}</TableHead>
                  <TableHead>{t('fields.quantity')}</TableHead>
                  <TableHead>{t('transactions.note')}</TableHead>
                  <TableHead>{t('fields.created')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('transactions.noTransactions')}
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tx.direction === 'in' ? (
                            <ArrowUpFromLine className="h-4 w-4 text-green-600" />
                          ) : tx.direction === 'out' ? (
                            <ArrowDownToLine className="h-4 w-4 text-red-600" />
                          ) : (
                            <RotateCcw className="h-4 w-4 text-blue-600" />
                          )}
                          <Badge variant={tx.direction === 'in' ? 'default' : tx.direction === 'out' ? 'destructive' : 'secondary'}>
                            {t(`transactions.directions.${tx.direction}`)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {t(`transactions.reasons.${tx.reason}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={tx.direction === 'in' ? 'text-green-600 font-semibold' : tx.direction === 'out' ? 'text-red-600 font-semibold' : ''}>
                          {tx.direction === 'in' ? '+' : tx.direction === 'out' ? '-' : ''}
                          {formatQuantity(tx.quantity, item.unit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.note || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.created_at ? format(new Date(tx.created_at), 'MMM d, yyyy HH:mm') : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
