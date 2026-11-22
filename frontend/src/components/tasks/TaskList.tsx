'use client';

import { TaskCards } from './TaskCards';
import { TaskTable } from './TaskTable';
import type { TaskRecord } from '../../types/task';

export interface TaskListProps {
  tasks: TaskRecord[];
  runningTaskIds: Set<number>;
  recentRunFeedback: Record<number, 'success' | 'failed'>;
  togglingTaskIds: Set<number>;
  onEditTask: (task: TaskRecord) => void;
  onDuplicateTask: (task: TaskRecord) => void;
  onRequestDelete: (task: TaskRecord) => void;
  onToggleStatus: (task: TaskRecord) => void;
  onRunNow: (task: TaskRecord) => void;
  onViewLogs: (taskId: number) => void;
}

export function TaskList(props: TaskListProps) {
  return (
    <>
      <TaskTable {...props} />

      <TaskCards {...props} />
    </>
  );
}
