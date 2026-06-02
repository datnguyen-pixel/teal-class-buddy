import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { X, Send, Image as ImageIcon, Reply, Loader2 } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import EmojiPicker from '@/components/ui/emoji-picker';
import ReactionBar from '@/components/ui/reaction-bar';
import ReactionDisplay from '@/components/ui/reaction-display';
import { useReactions } from '@/hooks/useReactions';
import { toast } from '@/hooks/use-toast';
import {
  isSecretConversation,
  isSecretUnlocked,
  setSecretUnlocked,
  SECRET_PASSPHRASE,
} from '@/lib/secret-chat';

interface ChatPartner {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ChatWindowProps {
  partner: ChatPartner;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  image_url?: string | null;
  reply_to_id?: string | null;
}

const CHAT_PAGE_SIZE = 50;

// Compress image client-side to max 1280px and ~0.8 jpeg quality
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas error'));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('blob error'))),
        'image/jpeg',
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load error'));
    };
    img.src = url;
  });
};

const ChatWindow = ({ partner, onClose }: ChatWindowProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [pendingImage, setPendingImage] = useState<{ file: Blob; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const isSecret = isSecretConversation(user?.id, partner.user_id);
  const [unlocked, setUnlocked] = useState<boolean>(() =>
    isSecret && user ? isSecretUnlocked(user.id, partner.user_id) : !isSecret
  );
  const [ghostMessages, setGhostMessages] = useState<ChatMessage[]>([]);
  const locked = isSecret && !unlocked;
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousScrollHeight = useRef<number | null>(null);
  const lastMessageId = useRef<string | null>(null);

  const {
    data: messagePages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['chat-messages', user?.id, partner.user_id],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${partner.user_id}),and(sender_id.eq.${partner.user_id},receiver_id.eq.${user!.id})`
        )
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE_SIZE);

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Failed to load chat messages:', error);
        return [];
      }
      return ((data as ChatMessage[]) || []).slice().reverse();
    },
    getNextPageParam: (lastPage) =>
      lastPage.length >= CHAT_PAGE_SIZE ? lastPage[0]?.created_at ?? null : null,
    enabled: !!user,
  });

  const realMessages = useMemo(() => {
    const all = (messagePages?.pages || []).flat();
    const unique = new Map<string, ChatMessage>();
    all.forEach(m => unique.set(m.id, m));
    return Array.from(unique.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messagePages]);

  const messages = useMemo(() => {
    if (locked) return ghostMessages;
    return realMessages;
  }, [locked, ghostMessages, realMessages]);

  const addMessageToCache = useCallback((incoming: ChatMessage) => {
    queryClient.setQueryData<InfiniteData<ChatMessage[], string | null>>(
      ['chat-messages', user?.id, partner.user_id],
      (current) => {
        if (!current || current.pages.some(page => page.some(m => m.id === incoming.id))) return current;
        return {
          ...current,
          pages: current.pages.map((page, index) => (
            index === 0
              ? [...page, incoming].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
              : page
          )),
        };
      }
    );
  }, [partner.user_id, queryClient, user?.id]);

  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach(m => map.set(m.id, m));
    return map;
  }, [messages]);

  const messageIds = useMemo(() => messages.map(m => m.id), [messages]);
  const { getGrouped, toggleReaction } = useReactions('message', messageIds);

  const unreadLoadedIds = useMemo(
    () => messages.filter(m => m.receiver_id === user?.id && !m.read).map(m => m.id).join(','),
    [messages, user?.id]
  );

  // Mark messages as read (skip while a secret conversation is still locked,
  // so unlocking later doesn't silently mark previously-unread messages).
  useEffect(() => {
    if (!user || locked) return;
    supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', partner.user_id)
      .eq('read', false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['unread-chat-total'] });
        queryClient.invalidateQueries({ queryKey: ['unread-per-sender'] });
      });
  }, [unreadLoadedIds, partner.user_id, user, queryClient, locked]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-${user.id}-${partner.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (
          (msg.sender_id === user?.id && msg.receiver_id === partner.user_id) ||
          (msg.sender_id === partner.user_id && msg.receiver_id === user?.id)
        ) {
          addMessageToCache(msg as ChatMessage);
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [addMessageToCache, partner.user_id, user, queryClient]);

  const loadOlderMessages = useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    previousScrollHeight.current = scrollRef.current.scrollHeight;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleMessagesScroll = useCallback(() => {
    if (!scrollRef.current) return;
    if (scrollRef.current.scrollTop <= 80) {
      loadOlderMessages();
    }
  }, [loadOlderMessages]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const latestMessage = messages[messages.length - 1];
    const latestId = latestMessage?.id ?? null;

    if (previousScrollHeight.current !== null) {
      const heightDifference = container.scrollHeight - previousScrollHeight.current;
      container.scrollTop = heightDifference;
      previousScrollHeight.current = null;
    } else if (!lastMessageId.current) {
      container.scrollTo({ top: container.scrollHeight });
    } else if (latestId && latestId !== lastMessageId.current) {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const shouldFollow = distanceFromBottom < 160 || latestMessage.sender_id === user?.id;
      if (shouldFollow) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }

    lastMessageId.current = latestId;
  }, [messages, user?.id]);

  const sendMutation = useMutation({
    mutationFn: async (payload: { content: string; image_url?: string | null; reply_to_id?: string | null }) => {
      const { data, error } = await supabase.from('messages').insert({
        sender_id: user!.id,
        receiver_id: partner.user_id,
        content: payload.content,
        image_url: payload.image_url ?? null,
        reply_to_id: payload.reply_to_id ?? null,
      } as any).select('*').single();
      if (error) throw error;
      return data as ChatMessage;
    },
    onSuccess: (sentMessage) => {
      addMessageToCache(sentMessage);
    },
  });

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image', variant: 'destructive' });
      return;
    }
    try {
      const compressed = await compressImage(file);
      const preview = URL.createObjectURL(compressed);
      setPendingImage({ file: compressed, preview });
    } catch {
      toast({ title: 'Could not process image', variant: 'destructive' });
    }
  };

  const uploadImage = async (blob: Blob): Promise<string> => {
    const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('chat-images').upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });
    if (error) throw error;
    const { data } = supabase.storage.from('chat-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed && !pendingImage) return;

    // Hidden private conversation: intercept before touching the server.
    if (locked && user) {
      if (trimmed === SECRET_PASSPHRASE && !pendingImage) {
        setSecretUnlocked(user.id, partner.user_id);
        setUnlocked(true);
        setGhostMessages([]);
        setMessage('');
        setReplyTo(null);
        return;
      }
      // Treat as throwaway local-only message; never persisted, no notification.
      const localPreview = pendingImage ? pendingImage.preview : null;
      setGhostMessages(prev => [
        ...prev,
        {
          id: `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sender_id: user.id,
          receiver_id: partner.user_id,
          content: trimmed,
          read: true,
          created_at: new Date().toISOString(),
          image_url: localPreview,
          reply_to_id: null,
        },
      ]);
      setMessage('');
      setPendingImage(null);
      setReplyTo(null);
      return;
    }

    try {
      let image_url: string | null = null;
      if (pendingImage) {
        setUploading(true);
        image_url = await uploadImage(pendingImage.file);
        URL.revokeObjectURL(pendingImage.preview);
      }
      await sendMutation.mutateAsync({
        content: trimmed,
        image_url,
        reply_to_id: replyTo?.id ?? null,
      });
      setMessage('');
      setPendingImage(null);
      setReplyTo(null);
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const cancelPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const startLongPress = (msgId: string) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setActiveReactionMsgId(msgId);
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Close active reaction bar (mobile) when tapping elsewhere
  useEffect(() => {
    if (!activeReactionMsgId) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-reaction-zone]')) setActiveReactionMsgId(null);
    };
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [activeReactionMsgId]);

  const renderReplySnippet = (m: ChatMessage) => {
    if (!m.reply_to_id) return null;
    const original = messagesById.get(m.reply_to_id);
    const senderName =
      original?.sender_id === user?.id ? 'You' : partner.full_name;
    const snippet = original
      ? original.image_url && !original.content
        ? '📷 Photo'
        : (original.content || '').slice(0, 80)
      : 'Original message';
    return (
      <div className="mb-1 px-2 py-1 rounded-md bg-background/40 border-l-2 border-primary/60 text-[11px] opacity-80">
        <p className="font-semibold truncate">{senderName}</p>
        <p className="truncate">{snippet}</p>
      </div>
    );
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
      <div ref={scrollRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-xs text-center py-8">No messages yet. Say hello! 👋</p>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === user?.id;
          const grouped = getGrouped(msg.id);
          const showBar = activeReactionMsgId === msg.id;
          return (
            <MessageRow
              key={msg.id}
              msg={msg}
              isMine={isMine}
              grouped={grouped}
              showBar={showBar}
              boundaryRef={scrollRef}
              onActivate={() => setActiveReactionMsgId(msg.id)}
              onDeactivate={() => setActiveReactionMsgId(prev => (prev === msg.id ? null : prev))}
              onReply={() => setReplyTo(msg)}
              onTouchStart={() => startLongPress(msg.id)}
              onTouchEnd={cancelLongPress}
              onReact={(emoji) => {
                toggleReaction.mutate({ targetId: msg.id, emoji });
                setActiveReactionMsgId(null);
              }}
              onToggleReaction={(emoji) => toggleReaction.mutate({ targetId: msg.id, emoji })}
              renderReplySnippet={renderReplySnippet}
            />
          );
        })}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-3 pt-2 pb-1 border-t border-border bg-secondary/20 flex items-start gap-2">
          <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
            <p className="text-[11px] font-semibold text-muted-foreground">
              Replying to {replyTo.sender_id === user?.id ? 'yourself' : partner.full_name}
            </p>
            <p className="text-xs truncate text-muted-foreground">
              {replyTo.image_url && !replyTo.content ? '📷 Photo' : replyTo.content}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setReplyTo(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-3 pt-2 pb-1 border-t border-border bg-secondary/20 flex items-center gap-2">
          <div className="relative">
            <img src={pendingImage.preview} alt="preview" className="h-16 w-16 object-cover rounded-md" />
            <button
              type="button"
              onClick={cancelPendingImage}
              className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5"
              aria-label="Remove image"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Image ready to send</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border flex items-end gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          onClick={handlePickImage}
          disabled={uploading}
          aria-label="Send image"
        >
          <ImageIcon className="w-4 h-4" />
        </Button>
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => {
            const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch) {
              e.preventDefault();
              handleSend(e as unknown as React.FormEvent);
            }
          }}
          placeholder=""
          rows={1}
          className="flex-1 min-h-9 max-h-32 text-sm resize-none py-2"
        />
        <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 gradient-primary border-0 shrink-0"
          disabled={sendMutation.isPending || uploading}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
};

export default ChatWindow;

interface MessageRowProps {
  msg: ChatMessage;
  isMine: boolean;
  grouped: { emoji: string; count: number; hasReacted: boolean }[];
  showBar: boolean;
  boundaryRef?: React.RefObject<HTMLElement>;
  onActivate: () => void;
  onDeactivate: () => void;
  onReply: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onReact: (emoji: string) => void;
  onToggleReaction: (emoji: string) => void;
  renderReplySnippet: (m: ChatMessage) => React.ReactNode;
}

const MessageRow = ({
  msg, isMine, grouped, showBar, boundaryRef, onActivate, onDeactivate, onReply,
  onTouchStart, onTouchEnd, onReact, onToggleReaction, renderReplySnippet,
}: MessageRowProps) => {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyVisible, setReplyVisible] = useState(false);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      onDeactivate();
    }, 1500);
  };

  const cancelReplyHide = () => {
    if (replyTimer.current) {
      clearTimeout(replyTimer.current);
      replyTimer.current = null;
    }
  };

  const showReply = () => {
    cancelReplyHide();
    setReplyVisible(true);
  };

  const scheduleReplyHide = () => {
    cancelReplyHide();
    replyTimer.current = setTimeout(() => {
      setReplyVisible(false);
    }, 1000);
  };

  useEffect(() => () => {
    cancelClose();
    cancelReplyHide();
  }, []);

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[75%] group relative"
        data-reaction-zone
        onMouseEnter={() => { cancelClose(); showReply(); }}
        onMouseLeave={() => { scheduleClose(); scheduleReplyHide(); }}
      >
        <div
          ref={bubbleRef}
          onMouseEnter={() => { cancelClose(); onActivate(); }}
          onContextMenu={(e) => { e.preventDefault(); onActivate(); }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchEnd}
          onTouchCancel={onTouchEnd}
          className={`px-3 py-2 rounded-2xl text-sm ${
            isMine
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          }`}
        >
          {renderReplySnippet(msg)}
          {msg.image_url && (
            <a href={msg.image_url} target="_blank" rel="noreferrer" className="block">
              <img
                src={msg.image_url}
                alt="sent"
                className="rounded-lg max-h-60 w-auto object-cover mb-1"
                loading="lazy"
              />
            </a>
          )}
          {msg.content && (
            <span className="whitespace-pre-wrap break-words select-text">{msg.content}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onReply}
          onMouseEnter={() => { cancelClose(); showReply(); }}
          onMouseLeave={scheduleReplyHide}
          className={`absolute top-1/2 -translate-y-1/2 ${isMine ? '-left-7' : '-right-7'} flex items-center justify-center bg-background border border-border rounded-full p-1 shadow-sm hover:bg-accent transition-opacity duration-200 ${replyVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          aria-label="Reply"
        >
          <Reply className="w-3 h-3" />
        </button>
        {showBar && (
          <ReactionBar
            anchorRef={bubbleRef}
            boundaryRef={boundaryRef}
            align={isMine ? 'right' : 'left'}
            onReact={onReact}
            onClose={onDeactivate}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          />
        )}
        <ReactionDisplay
          reactions={grouped}
          onToggle={onToggleReaction}
          className={`mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}
        />
      </div>
    </div>
  );
};
