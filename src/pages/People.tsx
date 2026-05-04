import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Search, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import ChatWindow from '@/components/people/ChatWindow';

interface UserWithRole {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: 'teacher' | 'student';
}

const People = () => {
  const { user, isTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [chatWith, setChatWith] = useState<UserWithRole | null>(null);

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['people'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url');

      if (!profiles) return [];

      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const { data: blocked } = await supabase.from('blocked_users').select('user_id');

      const blockedIds = new Set((blocked || []).map(b => b.user_id));
      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role as 'teacher' | 'student']));

      // dat.nguyen's user_id - hidden from student view only
      const hiddenFromStudents = 'eb2b69fc-20a9-4197-aab7-a62adf24ce75';

      return profiles
        .filter(p => {
          if (blockedIds.has(p.user_id)) return false;
          if (p.user_id === user?.id) return false;
          if (!isTeacher && p.user_id === hiddenFromStudents) return false;
          return true;
        })
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: roleMap.get(p.user_id) || 'student',
        })) as UserWithRole[];
    },
  });

  // Fetch chat previews (last message + unread per partner)
  const { data: chatPreviews = {} } = useQuery({
    queryKey: ['chat-previews'],
    queryFn: async () => {
      if (!user) return {} as Record<string, { last: string; at: string; unread: number; mine: boolean }>;
      const { data } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, image_url, read, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(500);
      const map: Record<string, { last: string; at: string; unread: number; mine: boolean }> = {};
      (data || []).forEach((m: any) => {
        const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!map[partnerId]) {
          const preview = m.image_url && !m.content ? '📷 Photo' : (m.content || '');
          map[partnerId] = { last: preview, at: m.created_at, unread: 0, mine: m.sender_id === user.id };
        }
        if (m.receiver_id === user.id && !m.read) {
          map[partnerId].unread = (map[partnerId].unread || 0) + 1;
        }
      });
      return map;
    },
  });

  const unreadCounts: Record<string, number> = {};
  Object.entries(chatPreviews).forEach(([k, v]) => { if (v.unread) unreadCounts[k] = v.unread; });

  // Realtime: refresh unread counts on new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('people-unread')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-previews'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const blockMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('blocked_users').insert({
        user_id: userId,
        blocked_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('User has been removed from the application');
    },
    onError: () => toast.error('Failed to remove user'),
  });

  const formatPreviewTime = (iso: string) => {
    const d = new Date(iso); const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return 'now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filtered = people
    .filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ta = chatPreviews[a.user_id]?.at ? new Date(chatPreviews[a.user_id].at).getTime() : 0;
      const tb = chatPreviews[b.user_id]?.at ? new Date(chatPreviews[b.user_id].at).getTime() : 0;
      return tb - ta;
    });

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item} className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">People</h1>
          <p className="text-muted-foreground mt-1">View and connect with everyone in your classroom</p>
        </motion.div>

        <motion.div variants={item} className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search people..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No people found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(person => {
              const preview = chatPreviews[person.user_id];
              const unread = preview?.unread || 0;
              return (
              <motion.div key={person.user_id} variants={item}>
                <Card className={cn(
                  "shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer",
                  unread > 0 && "ring-1 ring-primary/30"
                )}
                onClick={() => {
                  setChatWith(person);
                  queryClient.invalidateQueries({ queryKey: ['chat-previews'] });
                  queryClient.invalidateQueries({ queryKey: ['unread-count'] });
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar className="h-12 w-12">
                          {person.avatar_url ? (
                            <AvatarImage src={person.avatar_url} alt={person.full_name} />
                          ) : null}
                          <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
                            {person.full_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                            {unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm truncate flex-1", unread > 0 ? "font-bold" : "font-semibold")}>
                            {person.full_name}
                          </p>
                          {preview?.at && (
                            <span className={cn("text-[10px] shrink-0", unread > 0 ? "text-primary font-semibold" : "text-muted-foreground")}>
                              {formatPreviewTime(preview.at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant={person.role === 'teacher' ? 'default' : 'secondary'}
                            className="text-[10px] capitalize px-1.5 py-0 h-4"
                          >
                            {person.role}
                          </Badge>
                          <p className={cn(
                            "text-xs truncate flex-1",
                            unread > 0 ? "text-foreground font-semibold" : "text-muted-foreground"
                          )}>
                            {preview?.last
                              ? `${preview.mine ? 'You: ' : ''}${preview.last}`
                              : 'Tap to start chatting'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {isTeacher && person.role !== 'teacher' && (
                      <div className="flex justify-end mt-3" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="gap-2 h-7 text-xs text-destructive hover:text-destructive">
                              <ShieldX className="w-3.5 h-3.5" />
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove this user from the application?
                                They will no longer be able to log in.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => blockMutation.mutate(person.user_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {chatWith && (
        <ChatWindow
          partner={chatWith}
          onClose={() => setChatWith(null)}
        />
      )}
    </AppLayout>
  );
};

export default People;
