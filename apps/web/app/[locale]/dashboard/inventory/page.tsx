'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/app/lib/api';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, AlertTriangle, Package, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type CategoryFilter = 'all' | 'medication' | 'vaccine' | 'food' | 'supply' | 'other';

export default function InventoryPage() {
  const t = useTranslations('inventory');

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Fetch inventory items
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ['inventory-items', categoryFilter, lowStockOnly],
    queryFn: () =>
      ApiClient.get('/inventory/items', {
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        low_stock_only: lowStockOnly,
      }),
  });

  const items = Array.isArray(itemsData) ? itemsData : [];

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      medication: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      vaccine: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      food: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      supply: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    };

    return (
      <Badge className={colors[category] || colors.other} variant="outline">
        {t(`categories.${category}`)}
      </Badge>
    );
  };

  const isLowStock = (item: any) => {
    return item.reorder_threshold && item.total_quantity < item.reorder_threshold;
  };

  const isOutOfStock = (item: any) => {
    return item.total_quantity === 0 || !item.total_quantity;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Link href="/dashboard/inventory/items/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('createItem')}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="w-48">
          <Select
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="medication">{t('categories.medication')}</SelectItem>
              <SelectItem value="vaccine">{t('categories.vaccine')}</SelectItem>
              <SelectItem value="food">{t('categories.food')}</SelectItem>
              <SelectItem value="supply">{t('categories.supply')}</SelectItem>
              <SelectItem value="other">{t('categories.other')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">{t('lowStock')} only</span>
        </label>
      </div>

      {/* Items Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Total Quantity</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Lots</TableHead>
              <TableHead>Reorder Threshold</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No inventory items found. Create your first item to get started.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {isOutOfStock(item) ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : isLowStock(item) ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <Package className="h-4 w-4 text-green-600" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    {isOutOfStock(item) && (
                      <div className="text-xs text-red-600 font-medium">
                        {t('noStock')}
                      </div>
                    )}
                    {!isOutOfStock(item) && isLowStock(item) && (
                      <div className="text-xs text-yellow-600 font-medium">
                        {t('belowThreshold')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getCategoryBadge(item.category)}</TableCell>
                  <TableCell>
                    <span className={
                      isOutOfStock(item)
                        ? 'text-red-600 font-semibold'
                        : isLowStock(item)
                        ? 'text-yellow-600 font-semibold'
                        : 'font-medium'
                    }>
                      {item.total_quantity?.toFixed(2) || '0.00'}
                    </span>
                  </TableCell>
                  <TableCell>{item.unit || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {item.lots_count || 0} lot(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.reorder_threshold ? (
                      <span>{item.reorder_threshold}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/inventory/items/${item.id}`}>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {items.length} item{items.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-600" />
              Out of stock: {items.filter((i: any) => isOutOfStock(i)).length}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              Low stock: {items.filter((i: any) => !isOutOfStock(i) && isLowStock(i)).length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
