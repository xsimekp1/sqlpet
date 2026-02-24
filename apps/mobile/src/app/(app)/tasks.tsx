import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import type { Task, TaskListResponse, TaskPriority, TaskType } from '../../types/tasks';

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low:    '#9CA3AF',
  medium: '#F59E0B',
  high:   '#EF4444',
};

const TYPE_LABELS: Record<TaskType, string> = {
  general:        'Obecné',
  feeding:        'Krmení',
  medical:        'Zdraví',
  cleaning:       'Úklid',
  maintenance:    'Údržba',
  administrative: 'Admin',
  behaviour:      'Chování',
  enrichment:     'Obohacení',
  other:          'Jiné',
};

const TYPE_BADGE_COLORS: Record<TaskType, { bg: string; text: string }> = {
  general:        { bg: '#F3F4F6', text: '#374151' },
  feeding:        { bg: '#FEF9C3', text: '#854D0E' },
  medical:        { bg: '#DBEAFE', text: '#1E40AF' },
  cleaning:       { bg: '#DCFCE7', text: '#166534' },
  maintenance:    { bg: '#FFEDD5', text: '#9A3412' },
  administrative: { bg: '#EDE9FE', text: '#5B21B6' },
  behaviour:      { bg: '#FCE7F3', text: '#9D174D' },
  enrichment:     { bg: '#E0F2FE', text: '#075985' },
  other:          { bg: '#F3F4F6', text: '#374151' },
};

type FilterTab = 'active' | 'all' | 'mine' | 'completed';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'active',    label: 'Aktivní' },
  { key: 'all',       label: 'Všechny' },
  { key: 'mine',      label: 'Moje' },
  { key: 'completed', label: 'Dokončené' },
];

function buildQueryUrl(filter: FilterTab, userId: string | null) {
  const base = '/tasks?page_size=50';
  switch (filter) {
    case 'active':    return `${base}&status=active`;
    case 'completed': return `${base}&status=completed`;
    case 'mine':      return userId ? `${base}&status=active&assigned_to_id=${userId}` : `${base}&status=active`;
    case 'all':       return base;
  }
}

function formatDueDate(due_at: string | null): { label: string; overdue: boolean } {
  if (!due_at) return { label: '', overdue: false };
  const due = new Date(due_at);
  const now = new Date();
  const overdue = due < now;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const isToday = dueDay.getTime() === today.getTime();

  const timeStr = due.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return { label: `Dnes ${timeStr}`, overdue };
  const dateStr = due.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  return { label: `${dateStr} ${timeStr}`, overdue };
}

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const priority = PRIORITY_COLOR[task.priority] ?? '#9CA3AF';
  const typeCfg = TYPE_BADGE_COLORS[task.type] ?? TYPE_BADGE_COLORS.other;
  const typeLabel = TYPE_LABELS[task.type] ?? task.type;
  const due = formatDueDate(task.due_at);
  const isCompleted = task.status === 'completed';

  return (
    <View style={styles.taskRow}>
      {/* Priority dot */}
      <View style={[styles.priorityDot, { backgroundColor: priority }]} />

      {/* Content */}
      <View style={styles.taskContent}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: typeCfg.bg }]}>
            <Text style={[styles.typeText, { color: typeCfg.text }]}>{typeLabel}</Text>
          </View>
        </View>

        {due.label ? (
          <Text style={[styles.taskDue, due.overdue && styles.taskDueOverdue]}>
            {due.overdue ? '⚠️ Opožděno — ' : '⏰ '}{due.label}
          </Text>
        ) : null}

        {task.description ? (
          <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
        ) : null}
      </View>

      {/* Complete button */}
      {!isCompleted && (
        <TouchableOpacity
          style={styles.completeBtn}
          onPress={() => onComplete(task.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.completeBtnText}>✓</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function TasksScreen() {
  const { selectedOrganizationId, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('active');

  const queryKey = ['tasks', selectedOrganizationId, activeFilter];
  const queryUrl = buildQueryUrl(activeFilter, user?.id ?? null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedOrganizationId) throw new Error('No organization selected');
      return api.get<TaskListResponse>(queryUrl, {
        'x-organization-id': selectedOrganizationId,
      });
    },
    enabled: !!selectedOrganizationId,
  });

  const completeMutation = useMutation({
    mutationFn: (taskId: string) =>
      api.post<unknown>(`/tasks/${taskId}/complete`, {}, {
        'x-organization-id': selectedOrganizationId ?? '',
      }),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<TaskListResponse>(queryKey);
      if (prev) {
        queryClient.setQueryData<TaskListResponse>(queryKey, {
          ...prev,
          items: prev.items.filter((t) => t.id !== taskId),
          total: prev.total - 1,
        });
      }
      return { prev };
    },
    onError: (_err, _taskId, context) => {
      if (context?.prev) queryClient.setQueryData(queryKey, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedOrganizationId] });
    },
  });

  const tasks = data?.items ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Úkoly</Text>
        {data && (
          <Text style={styles.headerCount}>{data.total} celkem</Text>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B4EFF" />
          <Text style={styles.loadingText}>Načítám úkoly…</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Nepodařilo se načíst úkoly</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Zkusit znovu</Text>
          </TouchableOpacity>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyText}>Žádné úkoly</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskRow task={item} onComplete={(id) => completeMutation.mutate(id)} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#6B4EFF"
            />
          }
          showsVerticalScrollIndicator={false}
        />
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
    backgroundColor: '#6B4EFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerCount: {
    fontSize: 13,
    color: '#C4B5FD',
    fontWeight: '500',
  },
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filters: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#6B4EFF',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    flexShrink: 0,
  },
  taskContent: {
    flex: 1,
    gap: 4,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
  },
  taskTitleDone: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  typeBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskDue: {
    fontSize: 12,
    color: '#6B7280',
  },
  taskDueOverdue: {
    color: '#EF4444',
    fontWeight: '600',
  },
  taskDesc: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  completeBtnText: {
    fontSize: 16,
    color: '#166534',
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6B4EFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
