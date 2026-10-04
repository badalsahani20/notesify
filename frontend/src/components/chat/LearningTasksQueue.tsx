import React, { useState, useEffect } from "react";
import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionLabel,
  QueueSectionContent,
  QueueList,
  QueueItem,
  QueueItemIndicator,
  QueueItemContent,
  QueueItemDescription,
  QueueItemActions,
  QueueItemAction,
} from "@/components/ai-elements/queue";
import { useTasks } from "@/hooks/useTasks";
import { type LearningTask } from "@/api/tasks";
import { Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LearningTasksQueueProps {
  tasks?: LearningTask[];
  title?: string;
  className?: string;
  defaultOpen?: boolean;
}

export const LearningTasksQueue: React.FC<LearningTasksQueueProps> = ({
  tasks: propTasks,
  title = "Todo",
  className,
  defaultOpen = true,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const { tasks: queryTasks, deleteTask, archiveTasks } = useTasks(
    propTasks ? undefined : { limit: 30 }
  );

  const displayTasks = propTasks || queryTasks;

  const activeTasks = (displayTasks || []).filter(
    (t) => t.status !== "completed" && t.status !== "skipped"
  );
  const finishedTasks = (displayTasks || []).filter(
    (t) => t.status === "completed" || t.status === "skipped"
  );

  // Automatically reset dismissed state whenever new active tasks arrive
  useEffect(() => {
    if (activeTasks.length > 0) {
      setIsDismissed(false);
    }
  }, [activeTasks.length]);

  if (
    !displayTasks ||
    displayTasks.length === 0 ||
    (isDismissed && activeTasks.length === 0)
  ) {
    return null;
  }

  const handleDelete = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask(taskId);
  };

  return (
    <Queue className={cn("w-full transition-all", className)}>
      {/* Active Tasks Section (pending & in_progress) */}
      {activeTasks.length > 0 && (
        <QueueSection defaultOpen={defaultOpen}>
          <QueueSectionTrigger>
            <QueueSectionLabel count={activeTasks.length} label={title} />
          </QueueSectionTrigger>
          <QueueSectionContent>
            <QueueList>
              {activeTasks.map((task) => (
                <QueueItem
                  key={task._id}
                  className="cursor-default select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <QueueItemIndicator status={task.status} disabled={true} />
                    <QueueItemContent status={task.status}>
                      {task.title}
                    </QueueItemContent>

                    <QueueItemActions>
                      <QueueItemAction
                        onClick={(e) => handleDelete(task._id, e)}
                        title="Delete task"
                      >
                        <Trash2 className="size-3.5" />
                      </QueueItemAction>
                    </QueueItemActions>
                  </div>

                  {task.description && (
                    <QueueItemDescription status={task.status}>
                      {task.description}
                    </QueueItemDescription>
                  )}
                </QueueItem>
              ))}
            </QueueList>
          </QueueSectionContent>
        </QueueSection>
      )}

      {/* Finished Tasks Section (completed & skipped) */}
      {finishedTasks.length > 0 && (
        <QueueSection defaultOpen={activeTasks.length === 0 ? true : false}>
          <QueueSectionTrigger className="flex items-center justify-between">
            <QueueSectionLabel count={finishedTasks.length} label="Completed" />
            {activeTasks.length === 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDismissed(true);
                  if (finishedTasks.length > 0) {
                    archiveTasks(finishedTasks.map((t) => t._id));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    setIsDismissed(true);
                    if (finishedTasks.length > 0) {
                      archiveTasks(finishedTasks.map((t) => t._id));
                    }
                  }
                }}
                className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors cursor-pointer"
                title="Archive and dismiss completed tasks"
              >
                <X className="size-3.5" />
              </span>
            )}
          </QueueSectionTrigger>
          <QueueSectionContent>
            <QueueList>
              {finishedTasks.map((task) => (
                <QueueItem
                  key={task._id}
                  className="cursor-default select-none opacity-85"
                >
                  <div className="flex items-center gap-2.5">
                    <QueueItemIndicator status={task.status} disabled={true} />
                    <QueueItemContent status={task.status}>
                      {task.title}
                    </QueueItemContent>

                    <QueueItemActions>
                      <QueueItemAction
                        onClick={(e) => handleDelete(task._id, e)}
                        title="Delete task"
                      >
                        <Trash2 className="size-3.5" />
                      </QueueItemAction>
                    </QueueItemActions>
                  </div>

                  {task.description && (
                    <QueueItemDescription status={task.status}>
                      {task.description}
                    </QueueItemDescription>
                  )}
                </QueueItem>
              ))}
            </QueueList>
          </QueueSectionContent>
        </QueueSection>
      )}
    </Queue>
  );
};

export default LearningTasksQueue;
