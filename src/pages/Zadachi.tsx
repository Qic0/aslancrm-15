import { motion } from "framer-motion";

import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { RefreshCw, Filter, Plus } from "lucide-react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import TaskDetailsDialog from "@/components/TaskDetailsDialog";
import { TaskFilterDialog, TaskFilters } from "@/components/TaskFilterDialog";
import { useState, useMemo } from "react";
import { useRealtimeZadachi } from "@/hooks/useRealtimeZadachi";

const Zadachi = () => {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>({ statuses: [], taskTypes: [], stages: [], workers: [] });
  
  // Используем хук с real-time обновлениями
  const { data: zadachi, isLoading, isFetching, refetch } = useRealtimeZadachi(['zadachi-main']);

  // Фильтруем задачи
  const filteredZadachi = useMemo(() => {
    if (!zadachi) return [];
    
    let filtered = zadachi;

    // Фильтр по статусам
    if (filters.statuses.length > 0) {
      filtered = filtered.filter((task: any) => 
        filters.statuses.includes(task.status)
      );
    }

    // Фильтр по типу задач
    if (filters.taskTypes.length > 0) {
      filtered = filtered.filter((task: any) => {
        const now = new Date();
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const completedAt = task.completed_at ? new Date(task.completed_at) : null;
        
        const isOverdue = dueDate && dueDate < now && task.status !== 'completed';
        const isCompletedOnTime = task.status === 'completed' && completedAt && dueDate && completedAt <= dueDate;
        
        return filters.taskTypes.some((type: string) => {
          if (type === 'overdue') return isOverdue;
          if (type === 'completed_on_time') return isCompletedOnTime;
          return false;
        });
      });
    }

    // Фильтр по этапам (по stage_id задачи)
    if (filters.stages.length > 0) {
      filtered = filtered.filter((task: any) => {
        return task.stage_id && filters.stages.includes(task.stage_id);
      });
    }

    // Фильтр по работникам
    if (filters.workers.length > 0) {
      filtered = filtered.filter((task: any) => 
        task.responsible_user_id && filters.workers.includes(task.responsible_user_id)
      );
    }

    return filtered;
  }, [zadachi, filters]);

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleTaskDialogClose = () => {
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
  };

  const columns = [
    { key: 'id_zadachi', header: 'ID' },
    { key: 'title', header: 'Задача' },
    { 
      key: 'order_title', 
      header: 'Заказ',
      render: (value: any) => value || '—'
    },
    { 
      key: 'responsible_user_name', 
      header: 'Ответственный',
      render: (value: any) => value || '—'
    },
    { key: 'status', header: 'Статус' },
    { key: 'priority', header: 'Приоритет' },
    { key: 'salary', header: 'Зарплата' },
    { key: 'remaining_time', header: 'Осталось времени' },
    { key: 'due_date', header: 'Срок' },
    { key: 'created_at', header: 'Создана' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      
      <motion.main 
        className="pt-14"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="max-w-7xl mx-auto purposeful-space">
          <PageHeader
            title="Задачи"
            description="Управление задачами по всем заказам"
            gradient={true}
            actions={[
              {
                label: "Фильтр",
                icon: Filter,
                onClick: () => setFilterDialogOpen(true),
                variant: "outline",
                size: "sm"
              },
              {
                label: "Обновить",
                icon: RefreshCw,
                onClick: () => refetch(),
                variant: "outline",
                size: "sm"
              },
              {
                label: "Новая задача",
                icon: Plus,
                onClick: () => setCreateTaskOpen(true),
                variant: "default"
              }
            ]}
          />
          
          <motion.div variants={itemVariants}>
            <DataTable
              title="Все задачи"
              data={filteredZadachi || []}
              columns={columns}
              loading={isLoading}
              isFetching={isFetching}
              emptyMessage="Задачи не найдены. Создайте первую задачу."
              onRowClick={handleTaskClick}
              searchPlaceholder="Поиск задач..."
            />
          </motion.div>

          <TaskDetailsDialog
            task={selectedTask}
            isOpen={isTaskDialogOpen}
            onClose={handleTaskDialogClose}
            onTaskUpdated={() => refetch()}
          />
          
          <CreateTaskDialog 
            open={createTaskOpen}
            onOpenChange={setCreateTaskOpen}
          />

          <TaskFilterDialog
            open={filterDialogOpen}
            onOpenChange={setFilterDialogOpen}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      </motion.main>
    </div>
  );
};

export default Zadachi;