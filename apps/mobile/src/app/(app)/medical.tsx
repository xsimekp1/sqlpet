import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import type { TaskListResponse } from '../../types/tasks';
import type { MedicalTask } from '../../types/medical';

// Reuse task list type, filtered to medical
function toMedicalTask(t: TaskListResponse['items'][number]): MedicalTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    due_at: t.due_at,
    related_entity_id: t.related_entity_id,
    related_entity_type: t.related_entity_type,
    task_metadata: t.task_metadata,
    priority: t.priority,
  };
}

function formatTime(due_at: string | null): { label: string; overdue: boolean } {
  if (!due_at) return { label: '', overdue: false };
  const due = new Date(due_at);
  const now = new Date();
  const overdue = due < now;
  const timeStr = due.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const isToday = dueDay.getTime() === today.getTime();
  if (isToday) return { label: timeStr, overdue };
  const dateStr = due.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  return { label: `${dateStr} ${timeStr}`, overdue };
}

function MedicalItem({
  task,
  onGiven,
  onSkip,
  isLoading,
}: {
  task: MedicalTask;
  onGiven: (id: string) => void;
  onSkip: (id: string) => void;
  isLoading: boolean;
}) {
  const due = formatTime(task.due_at);
  const isCompleted = task.status === 'completed';

  // Try to extract animal name from metadata
  const animalName =
    (task.task_metadata?.animal_name as string | undefined) ??
    (task.task_metadata?.name as string | undefined) ??
    null;
  const kennelName = (task.task_metadata?.kennel_name as string | undefined) ?? null;
  const medication = (task.task_metadata?.medication as string | undefined) ?? null;
  const dose = (task.task_metadata?.dose as string | undefined) ?? null;

  return (
    <View style={[styles.item, isCompleted && styles.itemDone]}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemAnimal}>
          💊 {animalName ?? task.title}
        </Text>
        {kennelName && <Text style={styles.itemKennel}>{kennelName}</Text>}
      </View>

      {medication ? (
        <Text style={styles.itemMed}>{medication}{dose ? ` — ${dose}` : ''}</Text>
      ) : task.description ? (
        <Text style={styles.itemMed} numberOfLines={2}>{task.description}</Text>
      ) : null}

      <View style={styles.itemFooter}>
        {due.label ? (
          <Text style={[styles.itemTime, due.overdue && styles.itemTimeOverdue]}>
            ⏰ {due.label}
          </Text>
        ) : <View />}

        {!isCompleted && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGiven, isLoading && styles.actionBtnDisabled]}
              onPress={() => onGiven(task.id)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.actionBtnTextGiven}>✓ Podáno</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSkip, isLoading && styles.actionBtnDisabled]}
              onPress={() => onSkip(task.id)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.actionBtnTextSkip}>✕ Přeskočit</Text>
            </TouchableOpacity>
          </View>
        )}

        {isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>✓ Podáno</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function MedicalScreen() {
  const { selectedOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const today = new Date().toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const queryKey = ['tasks', 'medical', selectedOrganizationId];

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedOrganizationId) throw new Error('No organization selected');
      return api.get<TaskListResponse>('/tasks?type=medical&status=active&page_size=100', {
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
      setLoadingIds((prev) => new Set(prev).add(taskId));
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<TaskListResponse>(queryKey);
      if (prev) {
        queryClient.setQueryData<TaskListResponse>(queryKey, {
          ...prev,
          items: prev.items.map((t) =>
            t.id === taskId ? { ...t, status: 'completed' as const } : t
          ),
        });
      }
      return { prev };
    },
    onError: (_err, taskId, context) => {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
      if (context?.prev) queryClient.setQueryData(queryKey, context.prev);
    },
    onSettled: (_, __, taskId) => {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedOrganizationId] });
    },
  });

  // "Skip" just marks the task completed as well (simplest MVP approach)
  const handleSkip = (taskId: string) => completeMutation.mutate(taskId);

  const tasks = (data?.items ?? []).map(toMedicalTask);
  const doneCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Léčiva dnes</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        {totalCount > 0 && (
          <View style={styles.headerProgress}>
            <Text style={styles.headerProgressText}>{doneCount}/{totalCount}</Text>
            <Text style={styles.headerProgressLabel}>podáno</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B4EFF" />
          <Text style={styles.loadingText}>Načítám léčiva…</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Nepodařilo se načíst léčiva</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Zkusit znovu</Text>
          </TouchableOpacity>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>💊</Text>
          <Text style={styles.emptyText}>Žádná léčiva dnes</Text>
          <Text style={styles.emptySubtext}>Všechna léčiva byla podána nebo nejsou naplánována.</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MedicalItem
              task={item}
              onGiven={(id) => completeMutation.mutate(id)}
              onSkip={handleSkip}
              isLoading={loadingIds.has(item.id)}
            />
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
  headerDate: {
    fontSize: 12,
    color: '#C4B5FD',
    marginTop: 2,
  },
  headerProgress: {
    alignItems: 'center',
  },
  headerProgressText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerProgressLabel: {
    fontSize: 11,
    color: '#C4B5FD',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  itemDone: {
    opacity: 0.6,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemAnimal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  itemKennel: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemMed: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemTimeOverdue: {
    color: '#EF4444',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnGiven: {
    backgroundColor: '#DCFCE7',
  },
  actionBtnSkip: {
    backgroundColor: '#FEE2E2',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnTextGiven: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  actionBtnTextSkip: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  completedBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
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
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
