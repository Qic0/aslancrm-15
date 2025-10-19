import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Info } from 'lucide-react';
import { StageChainCard } from './StageChainCard';
import { StageSettingsDialog } from './StageSettingsDialog';
import { useStageChain } from '@/hooks/useStageChain';
import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const StageChainEditor: React.FC = () => {
  const { chain, isLoading, toggleStage, getStageName } = useStageChain();
  const { getStagesWithTasks } = useAutomationSettings();
  
  const stagesWithTasks = getStagesWithTasks();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSettingsClick = (stageId: string) => {
    setSelectedStageId(stageId);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center space-x-2"
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Загрузка схемы автоматизации...</span>
        </motion.div>
      </div>
    );
  }

  if (!chain || chain.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Схема автоматизации не настроена. Обратитесь к администратору системы.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            Эта схема показывает последовательность этапов производства. Когда все задачи на текущем 
            этапе завершены, заказ автоматически переносится на следующий этап, если автоматизация активна.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-6">
          {chain.map((link, index) => {
            const isLast = index === chain.length - 1;
            const nextLink = !isLast ? chain[index + 1] : null;
            const stageData = stagesWithTasks.find(s => s.stage_id === link.from_stage_id);

            return (
              <StageChainCard
                key={link.id}
                link={link}
                stageName={getStageName(link.from_stage_id)}
                nextStageName={nextLink ? getStageName(nextLink.from_stage_id) : undefined}
                stageData={stageData}
                onToggle={(id, isActive) => toggleStage({ id, isActive })}
                onSettingsClick={() => handleSettingsClick(link.from_stage_id)}
                isLast={isLast}
              />
            );
          })}
        </div>

        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Как это работает:
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Когда работник завершает последнюю задачу на этапе, система автоматически проверяет цепочку</li>
            <li>Если автоматизация активна, заказ переносится на следующий этап</li>
            <li>Автоматически создаются задачи для нового этапа согласно настройкам</li>
            <li>Ответственные работники получают уведомления о новых задачах</li>
            <li>Вы можете отключить автоматизацию для любого этапа переключателем</li>
          </ul>
        </div>
      </div>

      <StageSettingsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stageId={selectedStageId}
        stageName={selectedStageId ? getStageName(selectedStageId) : ''}
      />
    </>
  );
};
