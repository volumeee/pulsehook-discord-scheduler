import type { ExecutionLogStatus } from '../../types/task';

const STATUS_PRESENTATION: Record<ExecutionLogStatus, { label: string; tone: string }> = {
  success: { label: 'Delivered', tone: 'text-[#15803D]' },
  failed: { label: 'Failed', tone: 'text-[#DC2626]' },
  retrying: { label: 'Retrying', tone: 'text-[#B45309]' },
};

export function LogStatusLabel({ status }: { status: ExecutionLogStatus }) {
  const { label, tone } = STATUS_PRESENTATION[status] ?? STATUS_PRESENTATION.retrying;
  return <span className={`font-semibold ${tone}`}>{label}</span>;
}
