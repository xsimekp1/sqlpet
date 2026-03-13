import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTranslations } from '../../i18n';
import api from '../../lib/api';
import type { InventoryStock, InventoryCategory } from '../../types/inventory';

type Filter = 'all' | InventoryCategory;

const FILTER_OPTIONS: { value: Filter; labelKey: string }[] = [
  { value: 'all', labelKey: 'allCategories' },
  { value: 'medication', labelKey: 'categories.medication' },
  { value: 'vaccine', labelKey: 'categories.vaccine' },
  { value: 'food', labelKey: 'categories.food' },
  { value: 'supply', labelKey: 'categories.supply' },
  { value: 'other', labelKey: 'categories.other' },
];

const CATEGORY_COLORS: Record<InventoryCategory, { bg: string; text: string }> = {
  medication: { bg: '#FEE2E2', text: '#991B1B' },
  vaccine: { bg: '#F3E8FF', text: '#6B21A8' },
  food: { bg: '#FFEDD5', text: '#9A3412' },
  supply: { bg: '#DBEAFE', text: '#1E40AF' },
  other: { bg: '#F3F4F6', text: '#374151' },
};

function StockCard({ item }: { item: InventoryStock }) {
  const { t } = useTranslations();
  const categoryColor = CATEGORY_COLORS[item.item.category] || CATEGORY_COLORS.other;
  const isLowStock = item.item.reorder_threshold && item.total_quantity < item.item.reorder_threshold;
  const isOutOfStock = item.total_quantity === 0;

  const getStatusIcon = () => {
    if (isOutOfStock) {
      return <AlertTriangle size={18} color="#DC2626" />;
    }
    if (isLowStock) {
      return <AlertTriangle size={18} color="#F59E0B" />;
    }
    return <CheckCircle size={18} color="#22C55E" />;
  };

  const formatQuantity = (qty: number, unit: string | null) => {
    const decimalUnits = ['kg', 'g', 'l', 'ml'];
    if (unit && decimalUnits.includes(unit)) {
      return qty.toFixed(2);
    }
    return Math.round(qty).toString();
  };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85}>
      {/* Status indicator */}
      <View style={styles.cardLeft}>
        {getStatusIcon()}
      </View>

      {/* Main content */}
      <View style={styles.cardCenter}>
        <Text style={styles.itemName} numberOfLines={1}>{item.item.name}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor.bg }]}>
            <Text style={[styles.categoryText, { color: categoryColor.text }]}>
              {t(`inventory.categories.${item.item.category}`)}
            </Text>
          </View>
          {item.lots_count > 0 && (
            <Text style={styles.lotsText}>
              {item.lots_count} {t('inventory.lots')}
            </Text>
          )}
        </View>
        {isOutOfStock && (
          <Text style={styles.warningTextRed}>{t('inventory.noStock')}</Text>
        )}
        {!isOutOfStock && isLowStock && (
          <Text style={styles.warningTextYellow}>{t('inventory.belowThreshold')}</Text>
        )}
      </View>

      {/* Quantity */}
      <View style={styles.cardRight}>
        <Text style={[
          styles.quantityText,
          isOutOfStock && styles.quantityTextRed,
          !isOutOfStock && isLowStock && styles.quantityTextYellow,
        ]}>
          {formatQuantity(item.total_quantity, item.item.unit)}
        </Text>
        {item.item.unit && (
          <Text style={styles.unitText}>{item.item.unit}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function InventoryScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const { selectedOrganizationId } = useAuthStore();
  const { t } = useTranslations();

  const queryParams = filter === 'all' ? '' : `?category=${filter}`;

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<InventoryStock[]>({
    queryKey: ['inventory-items', selectedOrganizationId, filter],
    queryFn: () =>
      api.get(`/inventory/items${queryParams}`, {
        'x-organization-id': selectedOrganizationId!,
      }),
    enabled: !!selectedOrganizationId,
  });

  const items = data ?? [];
  const lowStockCount = items.filter(
    (s) => s.item.reorder_threshold && s.total_quantity < s.item.reorder_threshold && s.total_quantity > 0
  ).length;
  const outOfStockCount = items.filter((s) => s.total_quantity === 0).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('inventory.title')}</Text>
          {items.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{items.length}</Text>
            </View>
          )}
        </View>

        {/* Filter pills - horizontal scroll */}
        <FlatList
          horizontal
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: opt }) => (
            <TouchableOpacity
              style={[styles.filterPill, filter === opt.value && styles.filterPillActive]}
              onPress={() => setFilter(opt.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, filter === opt.value && styles.filterPillTextActive]}>
                {opt.value === 'all' ? t('inventory.allCategories') : t(`inventory.${opt.labelKey}`)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0891B2" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.item.id}
          renderItem={({ item }) => <StockCard item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6B4EFF" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>{t('inventory.noItemsFound')}</Text>
            </View>
          }
        />
      )}

      {/* Summary footer */}
      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.summaryRow}>
            {outOfStockCount > 0 && (
              <View style={styles.summaryItem}>
                <AlertTriangle size={12} color="#DC2626" />
                <Text style={styles.summaryTextRed}>
                  {t('inventory.messages.outOfStock')}: {outOfStockCount}
                </Text>
              </View>
            )}
            {lowStockCount > 0 && (
              <View style={styles.summaryItem}>
                <AlertTriangle size={12} color="#F59E0B" />
                <Text style={styles.summaryTextYellow}>
                  {t('inventory.lowStock')}: {lowStockCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#0891B2',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    gap: 8,
    paddingRight: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  filterPillTextActive: {
    color: '#0891B2',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLeft: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  cardCenter: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lotsText: {
    fontSize: 11,
    color: '#6B7280',
  },
  warningTextRed: {
    fontSize: 11,
    fontWeight: '500',
    color: '#DC2626',
    marginTop: 4,
  },
  warningTextYellow: {
    fontSize: 11,
    fontWeight: '500',
    color: '#F59E0B',
    marginTop: 4,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  quantityTextRed: {
    color: '#DC2626',
  },
  quantityTextYellow: {
    color: '#F59E0B',
  },
  unitText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  footer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F8F9FA',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryTextRed: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  summaryTextYellow: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
});
