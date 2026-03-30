import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Search, ShieldX } from 'lucide-react';
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

      return profiles
        .filter(p => !blockedIds.has(p.user_id) && p.user_id !== user?.id)
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: roleMap.get(p.user_id) || 'student',
        })) as UserWithRole[];
    },
  });

  // Fetch unread message counts per sender
  const { data: unreadCounts = {} } = useQuery({
    queryKey: ['unread-per-sender'],
    queryFn: async () => {
      if (!user) return {};
      const { data } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', user.id)
        .eq('read', false);
      if (!data) return {};
      const counts: Record<string, number> = {};
      data.forEach(m => {
        counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
      });
      return counts;
    },
  });

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
        queryClient.invalidateQueries({ queryKey: ['unread-per-sender'] });
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

  const filtered = people.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item} className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">People</h1>
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
            {filtered.map(person => (
              <motion.div key={person.user_id} variants={item}>
                <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          {person.avatar_url ? (
                            <AvatarImage src={person.avatar_url} alt={person.full_name} />
                          ) : null}
                          <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
                            {person.full_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {(unreadCounts[person.user_id] || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                            {unreadCounts[person.user_id]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{person.full_name}</p>
                        <Badge
                          variant={person.role === 'teacher' ? 'default' : 'secondary'}
                          className="mt-1 text-xs capitalize"
                        >
                          {person.role}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => setChatWith(person)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Chat
                      </Button>
                      {isTeacher && person.role !== 'teacher' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="gap-2">
                              <ShieldX className="w-4 h-4" />
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
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
