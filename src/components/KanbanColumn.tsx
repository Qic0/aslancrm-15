import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Check, X, Zap, ZapOff, Info } from "lucide-react";
import OrderCard from "./OrderCard";
import { Order, ColumnType } from "./KanbanBoard";
import type { AutomationSetting } from "@/hooks/useAutomationSettings";

interface KanbanColumnProps {
  column: {
    id: ColumnType;
    title: string;
    count: number;
  };
  orders: Order[];
  onMoveOrder: (orderId: string, fromColumn: ColumnType, toColumn: ColumnType) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, toColumn: ColumnType) => void;
  onUpdateColumnTitle: (columnId: ColumnType, newTitle: string) => void;
  draggedOrder: string | null;
  onDragStart: (orderId: string) => void;
  onDragEnd: () => void;
  columnIndex?: number;
  stageTasks?: AutomationSetting[];
  isAutomationActive?: boolean;
}

  const getColumnStatusColor = (columnId: ColumnType) => {
    const colors = {
      new: 'bg-minimalist-platinum text-minimalist-text border-border',
      progress: 'bg-minimalist-accent/10 text-minimalist-accent border-minimalist-accent/20',
      review: 'bg-purple-50 text-purple-600 border-purple-200',
      done: 'bg-green-50 text-green-600 border-green-200'
    };
    return colors[columnId];
  };

const KanbanColumn = ({ 
  column, 
  orders, 
  onMoveOrder, 
  onDragOver, 
  onDrop, 
  onUpdateColumnTitle, 
  draggedOrder, 
  onDragStart, 
  onDragEnd,
  columnIndex = 0,
  stageTasks = [],
  isAutomationActive = false
}: KanbanColumnProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);

  const handleSave = () => {
    if (editTitle.trim()) {
      onUpdateColumnTitle(column.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(column.title);
    setIsEditing(false);
  };

  const isDraggedOver = draggedOrder && orders.some(order => order.id === draggedOrder);

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: index * 0.1,
        duration: 0.4
      }
    })
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  };

  const statsVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        delay: 0.2,
        duration: 0.4
      }
    }
  };

  return (
    <motion.div 
      className={`kanban-column kanban-drop-zone p-4 ${
        isDraggedOver ? 'drag-over' : ''
      }`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
      initial="hidden"
      animate="visible"
    >
      <motion.div 
        className="flex items-center justify-between mb-6"
        variants={headerVariants}
      >
        <div className="flex-1 text-center">
          {isEditing ? (
            <motion.div 
              className="flex items-center gap-2 mb-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-classical-serif text-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                autoFocus
              />
              <motion.button 
                onClick={handleSave}
                className="p-1 text-green-600 hover:bg-green-100 rounded"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Check size={16} />
              </motion.button>
              <motion.button 
                onClick={handleCancel}
                className="p-1 text-red-600 hover:bg-red-100 rounded"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={16} />
              </motion.button>
            </motion.div>
          ) : (
            <div className="relative mb-3 group">
              <div className="flex items-center justify-center gap-2 mb-2">
                <motion.h3 
                  className="font-classical-serif text-xl font-semibold tracking-wide"
                  layoutId={`title-${column.id}`}
                >
                  {column.title}
                </motion.h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className={`p-1 rounded-full ${isAutomationActive ? 'text-green-600' : 'text-muted-foreground'}`}
                      >
                        {isAutomationActive ? <Zap size={14} /> : <ZapOff size={14} />}
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs z-[9999]">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 font-semibold">
                          {isAutomationActive ? <Zap size={14} /> : <ZapOff size={14} />}
                          <span>{isAutomationActive ? 'Автоматизация активна' : 'Автоматизация отключена'}</span>
                        </div>
                        {stageTasks.length > 0 && isAutomationActive ? (
                          <div className="text-sm space-y-1">
                            <p className="font-medium">Создаются задачи при переходе:</p>
                            {stageTasks.map((task, idx) => (
                              <div key={task.id} className="pl-2 border-l-2 border-primary/30">
                                <p className="font-medium">{task.task_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Оплата: {task.payment_amount} ₽ | Срок: {task.duration_days} дн.
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {isAutomationActive ? 'Нет настроенных задач' : 'Задачи не будут создаваться автоматически'}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-3" />
            </div>
          )}
          <motion.div 
            className="space-y-3"
            variants={statsVariants}
          >
            <motion.div 
              className="text-center text-xl font-classical-sans font-semibold text-minimalist-text"
              key={orders.reduce((sum, order) => sum + order.value, 0)}
              initial={{ scale: 1.1, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {orders.reduce((sum, order) => sum + order.value, 0).toLocaleString('ru-RU')} ₽
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Badge variant="secondary" className={`kanban-badge ${getColumnStatusColor(column.id)}`}>
                {column.count} {column.count === 1 ? 'заказ' : 'заказов'}
              </Badge>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      <div className="mb-6">
        <div className="h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60 shadow-sm" />
      </div>

      <motion.div 
        className="space-y-3 min-h-[200px]"
        initial="hidden"
        animate="visible"
      >
        {orders.map((order, index) => (
          <motion.div
            key={order.id}
            variants={cardVariants}
            custom={index}
            layout
            layoutId={order.id}
          >
            <OrderCard
              order={order}
              columnId={column.id}
              onMoveOrder={onMoveOrder}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={draggedOrder === order.id}
              orderIndex={index}
            />
          </motion.div>
        ))}
        
        {orders.length === 0 && (
          <motion.div 
            className="kanban-empty-state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <p>Нет задач</p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default KanbanColumn;