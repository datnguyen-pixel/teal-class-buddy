import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
}

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const triggerIds = [...new Set((data || []).map(n => n.triggered_by))];
      if (triggerIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', triggerIds);

      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      return (data || []).map(n => ({
        ...n,
        triggeredByName: nameMap.get(n.triggered_by) || 'Someone',
      })) as Notification[];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from('notifications').update({ read: true }).in('id', ids);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      markReadMutation.mutate(unreadIds);
    }
  };

  const handleClick = (n: Notification) => {
    setOpen(false);
    navigate('/lessons', { state: { openCommentLessonId: n.lesson_id } });
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200">
          <Bell className="w-5 h-5" />
          Notifications
          {unreadCount > 0 && (
            <span className="absolute top-2 left-7 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="px-4 py-3 border-b font-semibold text-sm">Thông báo</div>
        <ScrollArea className="max-h-72">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Không có thông báo.</p>
          ) : (
            <div className="divide-y">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                    !n.read && 'bg-primary/5'
                  )}
                >
                  <p className="text-sm">
                    <span className="font-medium">{n.triggeredByName}</span>
                    {n.type === 'reply' ? ' đã trả lời bình luận' : ' đã bình luận'} bài #{n.lesson_id}
                  </p>
                  {n.content_preview && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">"{n.content_preview}"</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(n.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
