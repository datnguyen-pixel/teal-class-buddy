import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/AppLayout';

interface Notification {
  id: string;
  user_id: string;
  triggered_by: string;
  type: string;
  lesson_id: number;
  comment_id: string | null;
  content_preview: string | null;
  read: boolean;
  created_at: string;
  triggeredByName?: string;
  triggeredByAvatar?: string | null;
}

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const triggerIds = [...new Set((data || []).map(n => n.triggered_by))];
      if (triggerIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', triggerIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, { name: p.full_name, avatar: p.avatar_url }])
      );

      return (data || []).map(n => ({
        ...n,
        triggeredByName: profileMap.get(n.triggered_by)?.name || 'Someone',
        triggeredByAvatar: profileMap.get(n.triggered_by)?.avatar || null,
      })) as Notification[];
    },
    enabled: !!user,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from('notifications').update({ read: true }).in('id', ids);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length > 0) markReadMutation.mutate(unreadIds);
  };

  const handleClick = (n: Notification) => {
    if (!n.read) markReadMutation.mutate([n.id]);
    navigate('/lessons', { state: { openCommentLessonId: n.lesson_id } });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Thông báo</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markReadMutation.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Không có thông báo nào.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 rounded-xl text-left transition-colors',
                  !n.read
                    ? 'bg-primary/5 hover:bg-primary/10'
                    : 'hover:bg-muted/50'
                )}
              >
                {n.triggeredByAvatar ? (
                  <img
                    src={n.triggeredByAvatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {(n.triggeredByName || 'S').charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', !n.read && 'font-semibold')}>
                    <span className="font-medium">{n.triggeredByName}</span>
                    {n.type === 'reply' ? ' đã trả lời bình luận' : ' đã bình luận'} bài #{n.lesson_id}
                  </p>
                  {n.content_preview && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      "{n.content_preview}"
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {format(new Date(n.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                {!n.read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Notifications;
