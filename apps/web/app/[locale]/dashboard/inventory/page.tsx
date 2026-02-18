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
import { Plus, AlertTriangle, Package, AlertCircle, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { getUnitSymbol } from '@/app/lib/constants';
import { AddToCartButton } from '@/app/components/inventory/AddToCartButton';
import { ShoppingListPanel } from '@/app/components/inventory/ShoppingListPanel';
import { ShoppingListFloatingButton } from '@/app/components/inventory/ShoppingListFloatingButton';
import { useShoppingListStore } from '@/app/stores/shoppingListStore';

const DECIMAL_UNITS = ['kg', 'g', 'l', 'ml'];

function formatQuantity(value: number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined) return '0';
  if (unit && DECIMAL_UNITS.includes(unit)) {
    return value.toFixed(2);
  }
  return Math.round(value).toString();
}

type CategoryFilter = 'all' | 'medication' | 'vaccine' | 'food' | 'supply' | 'other';

export default function InventoryPage() {
  const t = useTranslations('inventory');
  const tShoppingList = useTranslations('shoppingList');

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { addLowStockItems, items: shoppingItems } = useShoppingListStore();

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

  const isLowStock = (stock: any) => {
    return stock.item.reorder_threshold && stock.total_quantity < stock.item.reorder_threshold;
  };

  const isOutOfStock = (stock: any) => {
    return stock.total_quantity === 0 || !stock.total_quantity;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('messages.loadingInventory')}</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${shoppingItems.length > 0 ? 'lg:mr-80' : ''}`}>
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
      <div className="flex gap-4 items-center flex-wrap">
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            addLowStockItems(items);
          }}
          className="ml-auto"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {tShoppingList('addAllLowStock')}
        </Button>
      </div>

      {/* Items Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>{t('fields.name')}</TableHead>
              <TableHead>{t('fields.category')}</TableHead>
              <TableHead>{t('totalQuantity')}</TableHead>
              <TableHead>{t('fields.unit')}</TableHead>
              <TableHead>{t('lots')}</TableHead>
              <TableHead>{t('reorderThreshold')}</TableHead>
              <TableHead className="text-right">{t('messages.actions')}</TableHead>
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
              items.map((stock: any) => (
                <TableRow key={stock.item.id}>
                  <TableCell>
                    {isOutOfStock(stock) ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : isLowStock(stock) ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <Package className="h-4 w-4 text-green-600" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{stock.item.name}</div>
                    {isOutOfStock(stock) && (
                      <div className="text-xs text-red-600 font-medium">
                        {t('noStock')}
                      </div>
                    )}
                    {!isOutOfStock(stock) && isLowStock(stock) && (
                      <div className="text-xs text-yellow-600 font-medium">
                        {t('belowThreshold')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getCategoryBadge(stock.item.category)}</TableCell>
                  <TableCell>
                    <span className={
                      isOutOfStock(stock)
                        ? 'text-red-600 font-semibold'
                        : isLowStock(stock)
                        ? 'text-yellow-600 font-semibold'
                        : 'font-medium'
}>
                      {formatQuantity(stock.total_quantity, stock.item.unit) || '0'}
                    </span>
                  </TableCell>
                  <TableCell>{getUnitSymbol(stock.item.unit)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {stock.lots_count || 0} lot(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {stock.item.reorder_threshold ? (
                      <span>{stock.item.reorder_threshold}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <AddToCartButton
                        item={stock.item}
                        totalQuantity={stock.total_quantity}
                      />
                      <Link href={`/dashboard/inventory/items/${stock.item.id}`}>
                        <Button size="sm" variant="ghost">
                          {t('viewDetails')}
                        </Button>
                      </Link>
                    </div>
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
            {t('messages.showingItems', { count: items.length })}
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-600" />
              {t('messages.outOfStock')}: {items.filter((s: any) => isOutOfStock(s)).length}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              {t('lowStock')}: {items.filter((s: any) => !isOutOfStock(s) && isLowStock(s)).length}
            </span>
          </div>
        </div>
      )}

      <ShoppingListPanel />
      <ShoppingListFloatingButton />
    </div>
  );
}
