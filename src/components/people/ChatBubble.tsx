import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChatWindow from './ChatWindow';
import { secretPartnerOf } from '@/lib/secret-chat';

interface UnreadSender {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  count: number;
}

const ChatBubble = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSender, setActiveSender] = useState<UnreadSender | null>(null);
  const [position, setPosition] = useState({ x: 24, y: window.innerHeight - 100 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const { data: unreadSenders = [] } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      if (!user) return [];
      const hiddenPartner = secretPartnerOf(user.id);
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', user.id)
        .eq('read', false);

      const filtered = (unreadMessages || []).filter(
        m => !hiddenPartner || m.sender_id !== hiddenPartner
      );
      if (filtered.length === 0) return [];

      const senderIds = [...new Set(filtered.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', senderIds);

      if (!profiles) return [];

      return profiles.map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        count: filtered.filter(m => m.sender_id === p.user_id).length,
      })) as UnreadSender[];
    },
    refetchInterval: 5000,
  });

  // Realtime for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-bubble-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.receiver_id === user.id) {
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.current.y)),
      });
    };
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [position]);

  if (unreadSenders.length === 0 && !activeSender) return null;

  // Show the most recent unread sender as a bubble
  const topSender = unreadSenders[0];

  return (
    <>
      {!activeSender && topSender && (
        <div
          className="fixed z-50 cursor-grab active:cursor-grabbing"
          style={{ left: position.x, top: position.y }}
          onMouseDown={handleMouseDown}
          onClick={() => {
            if (!isDragging.current) {
              setActiveSender(topSender);
            }
          }}
        >
          <div className="relative">
            <Avatar className="h-14 w-14 ring-4 ring-primary/30 shadow-elevated">
              {topSender.avatar_url ? <AvatarImage src={topSender.avatar_url} /> : null}
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                {topSender.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {topSender.count}
            </span>
          </div>
        </div>
      )}

      {activeSender && (
        <ChatWindow
          partner={{
            user_id: activeSender.user_id,
            full_name: activeSender.full_name,
            avatar_url: activeSender.avatar_url,
          }}
          onClose={() => setActiveSender(null)}
        />
      )}
    </>
  );
};

export default ChatBubble;
