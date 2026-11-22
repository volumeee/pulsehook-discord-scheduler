'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SessionPrincipal } from '../../lib/api';
import { ApiAccessView } from '../api-access/ApiAccessView';
import { LogsView } from '../logs/LogsView';
import { AmbientCanvas } from '../shared/AmbientCanvas';
import { EASE_SETTLE } from '../shared/motion';
import type { ToastItem } from '../shared/ToastStack';
import { MobileNavigation } from './MobileNavigation';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import type { ActiveTab } from './navItems';
import { OverviewView } from '../overview/OverviewView';
import { TaskEditorSheet } from '../task-editor/TaskEditorSheet';
import { TasksView, type TaskStatusFilter } from '../tasks/TasksView';
import { useWorkspaceActions } from './useWorkspaceActions';
import { initialLogQuery } from './logQuery';
import { useWorkspaceData } from './useWorkspaceData';

interface WorkspaceLayoutProps {
  principal: SessionPrincipal;
  sessionId: number;
  isSessionCurrent: (sessionId: number) => boolean;
  onUnauthorized: (sessionId: number, error: unknown) => boolean;
  onSignOut: (sessionId: number) => Promise<void>;
  pushToast: (tone: ToastItem['tone'], title: string, detail?: string) => void;
}

export function WorkspaceLayout({
  principal,
  sessionId,
  isSessionCurrent,
  onUnauthorized,
  onSignOut,
  pushToast,
}: WorkspaceLayoutProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>('all');
  const isCurrent = useCallback(() => isSessionCurrent(sessionId), [isSessionCurrent, sessionId]);
  const handleUnauthorized = useCallback(
    (error: unknown) => onUnauthorized(sessionId, error),
    [onUnauthorized, sessionId]
  );
  const handleSignOut = useCallback(() => onSignOut(sessionId), [onSignOut, sessionId]);
  const pushSessionToast = useCallback(
    (tone: ToastItem['tone'], title: string, detail?: string) => {
      if (isCurrent()) pushToast(tone, title, detail);
    },
    [isCurrent, pushToast]
  );
  const { data, logQuery, changeLogQuery, refreshWorkspace } = useWorkspaceData(
    isCurrent,
    handleUnauthorized
  );
  const {
    editorOpen,
    setEditorOpen,
    editingTask,
    setEditingTask,
    savingTask,
    seedingSamples,
    runningTaskIds,
    recentRunFeedback,
    togglingTaskIds,
    openCreateEditor,
    openEditEditor,
    handleSaveTask,
    handleToggleStatus,
    handleDuplicateTask,
    handleDeleteTask,
    handleRunTaskById,
    handleSeedSamples,
    handleCreateApiKey,
    handleRevokeApiKey,
  } = useWorkspaceActions({
    isCurrent,
    handleUnauthorized,
    pushToast: pushSessionToast,
    refreshWorkspace,
    setActiveTab,
  });
  const summary = data.summary.value;
  const tasks = data.tasks.value;
  const logs = data.logs.value?.data ?? [];
  const apiKeys = data.keys.value;
  const loadingSummary = data.summary.loading;
  const loadingTasks = data.tasks.loading;
  const loadingLogs = data.logs.loading;
  const loadingKeys = data.keys.loading;
  return (
    <div className="relative min-h-screen bg-[#F6F7FB] text-[#111827]">
      <AmbientCanvas variant="workspace" />

      {/* Desktop Left Rail Sidebar (252px) */}
      <WorkspaceSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        principal={principal}
        tasksCount={tasks.length}
        logsCount={summary?.totalExecutions ?? data.logs.value?.meta.total ?? logs.length}
        handleSignOut={handleSignOut}
      />

      {/* Main Workspace Area */}
      <div className="relative z-10 flex min-h-screen flex-col lg:pl-[252px]">
        {/* Sticky Top Bar (mobile: brand + refresh + sign out, no New Task; desktop: title + refresh + New Task) */}
        <WorkspaceHeader
          activeTab={activeTab}
          principal={principal}
          loadingSummary={loadingSummary}
          loadingTasks={loadingTasks}
          openCreateEditor={openCreateEditor}
          refreshWorkspace={refreshWorkspace}
          handleSignOut={handleSignOut}
        />
        {/* Active View Body */}
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:py-7">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="view-overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE_SETTLE }}
              >
                <OverviewView
                  principal={principal}
                  summary={summary}
                  loading={loadingSummary && !summary}
                  error={data.summary.error}
                  seeding={seedingSamples}
                  runningTaskIds={runningTaskIds}
                  onRetryLoad={() => void refreshWorkspace(false)}
                  onCreateTask={openCreateEditor}
                  onSeedSamples={() => void handleSeedSamples()}
                  onNavigateTasks={(filter) => {
                    setTaskStatusFilter(filter);
                    setActiveTab('tasks');
                  }}
                  onNavigateLogs={(taskId) => {
                    changeLogQuery({ taskId: taskId ?? 'all' });
                    setActiveTab('logs');
                  }}
                  onRunNow={(task) => void handleRunTaskById(task.id, task.name)}
                />
              </motion.div>
            )}

            {activeTab === 'tasks' && (
              <motion.div
                key="view-tasks"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE_SETTLE }}
              >
                <TasksView
                  tasks={tasks}
                  loading={loadingTasks && tasks.length === 0}
                  error={data.tasks.error}
                  statusFilter={taskStatusFilter}
                  onStatusFilterChange={setTaskStatusFilter}
                  runningTaskIds={runningTaskIds}
                  recentRunFeedback={recentRunFeedback}
                  togglingTaskIds={togglingTaskIds}
                  seeding={seedingSamples}
                  onRetryLoad={() => void refreshWorkspace(false)}
                  onCreateTask={openCreateEditor}
                  onEditTask={openEditEditor}
                  onDuplicateTask={(task) => void handleDuplicateTask(task)}
                  onDeleteTask={handleDeleteTask}
                  onToggleStatus={(task) => void handleToggleStatus(task)}
                  onRunNow={(task) => void handleRunTaskById(task.id, task.name)}
                  onViewLogs={(taskId) => {
                    changeLogQuery({ taskId });
                    setActiveTab('logs');
                  }}
                  onSeedSamples={() => void handleSeedSamples()}
                />
              </motion.div>
            )}

            {activeTab === 'logs' && (
              <motion.div
                key="view-logs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE_SETTLE }}
              >
                <LogsView
                  logs={logs}
                  tasks={tasks}
                  selectedTaskId={logQuery.taskId}
                  onSelectedTaskIdChange={(taskId) => changeLogQuery({ taskId })}
                  statusFilter={logQuery.status}
                  onStatusFilterChange={(status) => changeLogQuery({ status })}
                  search={logQuery.search}
                  onSearchChange={(search) => changeLogQuery({ search })}
                  page={logQuery.page}
                  totalPages={data.logs.value?.meta.totalPages ?? 1}
                  onPageChange={(page) => changeLogQuery({ page })}
                  onResetFilters={() => changeLogQuery(initialLogQuery)}
                  metrics={
                    data.logs.value?.meta.metrics ?? {
                      total: 0,
                      success: 0,
                      failed: 0,
                      retrying: 0,
                      avgDurationMs: 0,
                    }
                  }
                  loading={loadingLogs}
                  error={data.logs.error}
                  runningTaskIds={runningTaskIds}
                  onRefresh={() => void refreshWorkspace(false)}
                  onRerunTask={(taskId) => void handleRunTaskById(taskId)}
                />
              </motion.div>
            )}

            {activeTab === 'api' && (
              <motion.div
                key="view-api"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE_SETTLE }}
              >
                <ApiAccessView
                  principal={principal}
                  apiKeys={apiKeys}
                  loading={loadingKeys && apiKeys.length === 0}
                  error={data.keys.error}
                  onRetryLoad={() => void refreshWorkspace(false)}
                  onCreateKey={handleCreateApiKey}
                  onRevokeKey={handleRevokeApiKey}
                  onSignOut={() => void handleSignOut()}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Fixed Curved Bottom Tab Bar with Circular New Task FAB */}
      <MobileNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openCreateEditor={openCreateEditor}
      />

      {/* Task Editor Drawer / Mobile Bottom Sheet */}
      <TaskEditorSheet
        open={editorOpen}
        editingTask={editingTask}
        saving={savingTask}
        onClose={() => {
          setEditorOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
      />
    </div>
  );
}
