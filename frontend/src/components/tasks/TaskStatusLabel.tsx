import type { TaskStatus } from '../../types/task';

export function TaskStatusLabel({ status }: { status: TaskStatus }) {
  const tone =
    status === 'active'
      ? 'text-[#15803D]'
      : status === 'failed'
        ? 'text-[#DC2626]'
        : 'text-[#B45309]';
  const label = status === 'active' ? 'Active' : status === 'failed' ? 'Failed' : 'Paused';
  return <span className={`font-semibold ${tone}`}>{label}</span>;
}
