import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { X, Send } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EmojiPicker from '@/components/ui/emoji-picker';
import ReactionPicker from '@/components/ui/reaction-picker';
import ReactionDisplay from '@/components/ui/reaction-display';
import { useReactions } from '@/hooks/useReactions';

interface ChatPartner {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ChatWindowProps {
  partner: ChatPartner;
  onClose: () => void;
}

const ChatWindow = ({ partner, onClose }: ChatWindowProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', partner.user_id],
    queryFn: async () => {
      // Fetch the most recent messages first (DESC) so we always get the latest
      // even past Supabase's default 1000-row cap, then reverse for display.
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${partner.user_id}),and(sender_id.eq.${partner.user_id},receiver_id.eq.${user!.id})`
        )
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) {
        console.error('Failed to load chat messages:', error);
        return [];
      }
      return (data || []).slice().reverse();
    },
    refetchInterval: 3000,
  });

  const messageIds = useMemo(() => messages.map(m => m.id), [messages]);
  const { getGrouped, toggleReaction } = useReactions('message', messageIds);

  // Mark messages as read
  useEffect(() => {
    if (!user) return;
    const unread = messages.filter(m => m.receiver_id === user.id && !m.read);
    if (unread.length > 0) {
      supabase
        .from('messages')
        .update({ read: true })
        .in('id', unread.map(m => m.id))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        });
    }
  }, [messages, user, queryClient]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${partner.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (
          (msg.sender_id === user?.id && msg.receiver_id === partner.user_id) ||
          (msg.sender_id === partner.user_id && msg.receiver_id === user?.id)
        ) {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', partner.user_id] });
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partner.user_id, user?.id, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('messages').insert({
        sender_id: user!.id,
        receiver_id: partner.user_id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', partner.user_id] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
    setMessage('');
  };

  return (
    <div className="fixed bottom-0 right-0 w-full sm:bottom-4 sm:right-4 sm:w-96 h-[100dvh] sm:h-[28rem] bg-card border border-border sm:rounded-2xl shadow-elevated flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-secondary/30">
        <Avatar className="h-8 w-8">
          {partner.avatar_url ? <AvatarImage src={partner.avatar_url} /> : null}
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
            {partner.full_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-sm flex-1 truncate">{partner.full_name}</p>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-xs text-center py-8">No messages yet. Say hello! 👋</p>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === user?.id;
          const grouped = getGrouped(msg.id);
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%] group relative">
                <div
                  className={`px-3 py-2 rounded-2xl text-sm ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                </div>
                {/* Reaction picker on hover */}
                <div className={`absolute -bottom-1 ${isMine ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <ReactionPicker onReact={(emoji) => toggleReaction.mutate({ targetId: msg.id, emoji })} />
                </div>
                {/* Reaction display */}
                <ReactionDisplay
                  reactions={grouped}
                  onToggle={(emoji) => toggleReaction.mutate({ targetId: msg.id, emoji })}
                  className={`mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border flex items-center gap-1">
        <Input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 h-9 text-sm"
        />
        <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} />
        <Button type="submit" size="icon" className="h-9 w-9 gradient-primary border-0 shrink-0" disabled={sendMutation.isPending}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
};

export default ChatWindow;
