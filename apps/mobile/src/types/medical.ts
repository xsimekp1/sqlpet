// Medical Today uses tasks with type=medical
// (No dedicated /medical/today endpoint exists; uses GET /tasks?type=medical)
export interface MedicalTask {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'cancelled';
  due_at: string | null;
  related_entity_id: string | null;
  related_entity_type: string | null;
  task_metadata: Record<string, unknown> | null;
  priority: string;
}
