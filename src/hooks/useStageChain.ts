import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type StageChainLink = {
  id: string;
  from_stage_id: string;
  to_stage_id: string | null;
  order_position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const STAGE_NAMES: Record<string, string> = {
  'cutting': 'Распил',
  'edging': 'Кромление',
  'drilling': 'Присадка',
  'sanding': 'Шлифовка',
  'priming': 'Грунт',
  'painting': 'Покраска',
};

export const useStageChain = () => {
  const queryClient = useQueryClient();

  const { data: chain = [], isLoading } = useQuery({
    queryKey: ['stage-chain'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_automation_chain')
        .select('*')
        .order('order_position');
      
      if (error) throw error;
      return data as StageChainLink[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateChainMutation = useMutation({
    mutationFn: async (updatedChain: StageChainLink[]) => {
      const promises = updatedChain.map((link, index) => 
        supabase
          .from('stage_automation_chain')
          .update({
            is_active: link.is_active,
            order_position: index + 1,
          })
          .eq('id', link.id)
      );

      const results = await Promise.all(promises);
      
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Ошибка обновления: ${errors[0].error?.message}`);
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-chain'] });
      toast.success('Схема автоматизации успешно обновлена');
    },
    onError: (error) => {
      console.error('Error updating stage chain:', error);
      toast.error('Ошибка при обновлении схемы автоматизации');
    },
  });

  const toggleStageMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('stage_automation_chain')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-chain'] });
      toast.success('Статус автоматизации обновлен');
    },
    onError: (error) => {
      console.error('Error toggling stage:', error);
      toast.error('Ошибка при изменении статуса');
    },
  });

  const getStageName = (stageId: string) => {
    return STAGE_NAMES[stageId] || stageId;
  };

  return {
    chain,
    isLoading,
    updateChain: updateChainMutation.mutate,
    isUpdating: updateChainMutation.isPending,
    toggleStage: toggleStageMutation.mutate,
    getStageName,
  };
};
