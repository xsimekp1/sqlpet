'use client';

import { useState, useEffect, useRef } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Package, TrendingUp, TrendingDown, Calendar, Trash2, Receipt, UtensilsCrossed, Pill, Syringe, Archive, Pencil, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Truck, Flame, Camera, XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/app/lib/dateFormat';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  rodent: 'Hlodavec',
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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showEmptyLots, setShowEmptyLots] = useState(false);
  const [notesValue, setNotesValue] = useState<string>('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
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

  // Fetch on-the-way quantity
  const { data: onTheWayData } = useQuery({
    queryKey: ['on-the-way', itemId],
    queryFn: () => ApiClient.getOnTheWayQuantity(itemId),
    enabled: !!itemId,
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

  // Fetch active feeding plans for this food item (food only)
  const { data: feedingPlansData } = useQuery({
    queryKey: ['feeding-plans-by-food', itemId],
    queryFn: () => ApiClient.get('/feeding/plans', { food_id: itemId, is_active: true }),
    enabled: !!itemId && item?.category === 'food',
  });

  // Must be before early returns to satisfy Rules of Hooks
  useEffect(() => {
    if (item?.notes != null) setNotesValue(item.notes);
  }, [item?.id]);

  const lots = Array.isArray(lotsData) ? lotsData : (lotsData?.items ?? []);
  const displayedLots = showEmptyLots ? lots : lots.filter((lot: any) => lot.quantity > 0);
  const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData?.items ?? []);
  const totalQuantity = lots.reduce((sum: number, lot: any) => sum + (Number(lot.quantity) || 0), 0);

  const earliestDelivery = onTheWayData?.purchase_orders
    ?.map((po: any) => po.expected_delivery_date)
    .filter(Boolean)
    .sort()[0] ?? null;

  const activeFeedingPlans: any[] = feedingPlansData?.items ?? [];
  const dailyConsumptionG = activeFeedingPlans.reduce((sum: number, p: any) => sum + (Number(p.amount_g) || 0), 0);

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

  const saveNotesMutation = useMutation({
    mutationFn: (notes: string) => ApiClient.put(`/inventory/items/${itemId}`, { notes }),
    onSuccess: () => {
      toast({ title: t('messages.itemUpdated'), description: t('messages.itemUpdatedDesc') });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', itemId] });
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

  // Cancel (reverse) transaction mutation
  const cancelTransactionMutation = useMutation({
    mutationFn: (transactionId: string) => ApiClient.delete(`/inventory/transactions/${transactionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions', itemId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-lots', itemId] });
      toast({ title: t('transactions.cancelled'), description: t('transactions.cancelledDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      await ApiClient.uploadInventoryItemPhoto(itemId, file);
      queryClient.invalidateQueries({ queryKey: ['inventory-item', itemId] });
      toast({ title: t('messages.photoUploaded') });
    } catch (err: any) {
      toast({ title: t('messages.error'), description: err.message, variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
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

  const TRACKS_LOTS = ['medication', 'vaccine', 'food'];
  const tracksLots = TRACKS_LOTS.includes(item?.category ?? '');

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
            {onTheWayData && onTheWayData.quantity_on_the_way > 0 && (
              earliestDelivery ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 cursor-default">
                        <Truck className="h-3 w-3 mr-1" />
                        {formatQuantity(onTheWayData.quantity_on_the_way, item.unit)} {t('onTheWay')}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t('expectedDelivery')}: {formatDate(earliestDelivery)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Truck className="h-3 w-3 mr-1" />
                  {formatQuantity(onTheWayData.quantity_on_the_way, item.unit)} {t('onTheWay')}
                </Badge>
              )
            )}
          </div>
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

      {/* Item Info Cards - Compact */}
      <div className="grid gap-2 md:grid-cols-6 lg:grid-cols-8">
        <div className="border rounded-lg p-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 min-h-[2rem]">
            <Package className="h-3 w-3" />
            {t('totalQuantity')}
          </div>
          <div className="text-base font-medium">
            {formatQuantity(totalQuantity, item.unit)} {item.unit || ''}
          </div>
        </div>
        <div className="border rounded-lg p-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 min-h-[2rem]">
            <Package className="h-3 w-3" />
            {t('activeLots')}
          </div>
          <div className="text-base font-medium">
            {lots.filter((lot: any) => lot.quantity > 0).length}
          </div>
        </div>
        <div className="border rounded-lg p-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 min-h-[2rem]">
            <TrendingDown className="h-3 w-3" />
            {t('reorderThreshold')}
          </div>
          <div className="text-base font-medium">
            {item.reorder_threshold !== null && item.reorder_threshold !== undefined ? item.reorder_threshold : '—'}
          </div>
        </div>
        <div className="border rounded-lg p-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 min-h-[2rem]">
            <Receipt className="h-3 w-3" />
            {t('fields.pricePerUnit')}
          </div>
          <div className="text-base font-medium">
            {item.price_per_unit != null
              ? `${item.price_per_unit} Kč`
              : <span className="text-muted-foreground text-sm">—</span>}
          </div>
        </div>
        {item.category === 'food' && item.kcal_per_100g && (
          <div className="border rounded-lg p-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 min-h-[2rem]">
              <UtensilsCrossed className="h-3 w-3" />
              {t('fields.kcalPer100g')}
            </div>
            <div className="text-base font-medium">{item.kcal_per_100g} kcal</div>
          </div>
        )}
        {item.category === 'food' && dailyConsumptionG > 0 && (
          <div className="border rounded-lg p-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 min-h-[2rem]">
              <Flame className="h-3 w-3" />
              {t('dailyConsumption')}
            </div>
            <div className="text-base font-medium">
              {Math.round(dailyConsumptionG).toLocaleString()} g/den
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {activeFeedingPlans.length} {t('activePlans')}
            </div>
          </div>
        )}
        {/* Feeding Plans - Show which plans include this food item */}
        {item.category === 'food' && activeFeedingPlans.length > 0 && (
          <div className="border rounded-lg p-2 md:col-span-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              <UtensilsCrossed className="h-3 w-3" />
              {t('feedingPlans')}
            </div>
            <div className="text-xs space-y-0.5">
              {activeFeedingPlans.slice(0, 3).map((plan: any) => (
                <div key={plan.id} className="truncate font-medium">{plan.name}</div>
              ))}
              {activeFeedingPlans.length > 3 && (
                <div className="text-muted-foreground">+{activeFeedingPlans.length - 3} dalších</div>
              )}
            </div>
          </div>
        )}
      </div>

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
      <Tabs defaultValue={tracksLots ? 'lots' : 'transactions'} className="space-y-4">
        <TabsList>
          {tracksLots && <TabsTrigger value="lots">{t('lots')}</TabsTrigger>}
          <TabsTrigger value="transactions">{t('transactions.title')}</TabsTrigger>
        </TabsList>

        {/* Lots Tab */}
        {tracksLots && <TabsContent value="lots" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t('lots')}</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showEmptyLots}
                  onChange={(e) => setShowEmptyLots(e.target.checked)}
                  className="rounded"
                />
                {t('showEmptyLots')}
              </label>
              <p className="text-sm text-muted-foreground">{t('messages.lotsCreatedOnReceiving')}</p>
            </div>
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
                {displayedLots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('noLotsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedLots.map((lot: any) => (
                    <TableRow key={lot.id} className={lot.quantity <= 0 ? 'opacity-50' : ''}>
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
                            {formatDate(lot.expires_at)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lot.cost_per_unit != null ? `${lot.cost_per_unit} Kč` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(lot.created_at)}
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
        </TabsContent>}

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
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                        {formatDate(tx.created_at, true)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={cancelTransactionMutation.isPending}
                          onClick={() => {
                            if (window.confirm(t('transactions.confirmCancel'))) {
                              cancelTransactionMutation.mutate(tx.id);
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Notes / Description - at the bottom */}
      <div className="border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground">{t('fields.notes')}</label>
          {notesValue !== (item?.notes ?? '') && (
            <Button
              size="sm"
              variant="default"
              onClick={() => saveNotesMutation.mutate(notesValue)}
              disabled={saveNotesMutation.isPending}
            >
              {saveNotesMutation.isPending ? t('messages.saving') : t('actions.save')}
            </Button>
          )}
        </div>
        <Textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          placeholder={t('fields.notesPlaceholder')}
          className="resize-none min-h-[80px]"
        />
      </div>
    </div>
  );
}
