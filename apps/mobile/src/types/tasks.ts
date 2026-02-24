export type TaskStatus = 'active' | 'completed' | 'cancelled';
export type TaskType =
  | 'general'
  | 'feeding'
  | 'medical'
  | 'cleaning'
  | 'maintenance'
  | 'administrative'
  | 'behaviour'
  | 'enrichment'
  | 'other';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  assigned_to_id: string | null;
  created_by_id: string | null;
  task_metadata: Record<string, unknown> | null;
  completion_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
}
