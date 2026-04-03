import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${partner.user_id}),and(sender_id.eq.${partner.user_id},receiver_id.eq.${user!.id})`
        )
        .order('created_at', { ascending: true });
      return data || [];
    },
    refetchInterval: 3000,
  });

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
    <div className="fixed bottom-4 right-4 w-80 sm:w-96 h-[28rem] bg-card border border-border rounded-2xl shadow-elevated flex flex-col z-50 overflow-hidden">
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
      <ChatMessages messages={messages} userId={user?.id} scrollRef={scrollRef} />


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
