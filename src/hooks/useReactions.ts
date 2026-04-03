import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type TargetType = 'message' | 'comment';

export function useReactions(targetType: TargetType, targetIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['reactions', targetType, ...targetIds.sort()];

  const column = targetType === 'message' ? 'message_id' : 'comment_id';

  const { data: reactions = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      if (targetIds.length === 0) return [];
      const { data } = await supabase
        .from('reactions')
        .select('*')
        .in(column, targetIds);
      return data || [];
    },
    enabled: targetIds.length > 0,
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ targetId, emoji }: { targetId: string; emoji: string }) => {
      if (!user) return;
      const existing = reactions.find(
        r => r[column] === targetId && r.emoji === emoji && r.user_id === user.id
      );
      if (existing) {
        await supabase.from('reactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('reactions').insert({
          user_id: user.id,
          emoji,
          [column]: targetId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  function getGrouped(targetId: string) {
    const targetReactions = reactions.filter(r => r[column] === targetId);
    const emojiMap = new Map<string, { count: number; hasReacted: boolean }>();
    for (const r of targetReactions) {
      const existing = emojiMap.get(r.emoji) || { count: 0, hasReacted: false };
      existing.count++;
      if (r.user_id === user?.id) existing.hasReacted = true;
      emojiMap.set(r.emoji, existing);
    }
    return Array.from(emojiMap.entries()).map(([emoji, data]) => ({
      emoji,
      ...data,
    }));
  }

  return { getGrouped, toggleReaction };
}
