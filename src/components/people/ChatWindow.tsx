import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { X, Send, Image as ImageIcon, Reply, Loader2, Smile, Plus, ArrowDown } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import EmojiPicker from '@/components/ui/emoji-picker';
import ReactionPicker from '@/components/ui/reaction-picker';
import { useReactions } from '@/hooks/useReactions';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
const GROUP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const TIME_DIVIDER_MS = 30 * 60 * 1000; // 30 minutes

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas error'));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob error')), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load error')); };
    img.src = url;
  });
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDivider = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  if (sameDay) return `Today, ${formatTime(iso)}`;
  if (isYest) return `Yesterday, ${formatTime(iso)}`;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ChatWindow = ({ partner, onClose }: ChatWindowProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [pendingImage, setPendingImage] = useState<{ file: Blob; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousScrollHeight = useRef<number | null>(null);
  const lastMessageId = useRef<string | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data: messagePages, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['chat-messages', partner.user_id],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${partner.user_id}),and(sender_id.eq.${partner.user_id},receiver_id.eq.${user!.id})`)
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE_SIZE);
      if (pageParam) query = query.lt('created_at', pageParam);
      const { data, error } = await query;
      if (error) { console.error(error); return []; }
      return ((data as ChatMessage[]) || []).slice().reverse();
    },
    getNextPageParam: (lastPage) => lastPage.length >= CHAT_PAGE_SIZE ? lastPage[0]?.created_at ?? null : null,
  });

  const messages = useMemo(() => {
    const all = (messagePages?.pages || []).flat();
    const unique = new Map<string, ChatMessage>();
    all.forEach(m => unique.set(m.id, m));
    return Array.from(unique.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messagePages]);

  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach(m => map.set(m.id, m));
    return map;
  }, [messages]);

  const messageIds = useMemo(() => messages.map(m => m.id), [messages]);
  const { getGrouped, toggleReaction } = useReactions('message', messageIds);

  const addMessageToCache = useCallback((incoming: ChatMessage) => {
    queryClient.setQueryData<InfiniteData<ChatMessage[], string | null>>(
      ['chat-messages', partner.user_id],
      (current) => {
        if (!current || current.pages.some(p => p.some(m => m.id === incoming.id))) return current;
        return {
          ...current,
          pages: current.pages.map((page, idx) =>
            idx === 0
              ? [...page, incoming].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              : page
          ),
        };
      }
    );
  }, [partner.user_id, queryClient]);

  const unreadLoadedIds = useMemo(
    () => messages.filter(m => m.receiver_id === user?.id && !m.read).map(m => m.id).join(','),
    [messages, user?.id]
  );

  useEffect(() => {
    if (!user) return;
    supabase.from('messages').update({ read: true })
      .eq('receiver_id', user.id).eq('sender_id', partner.user_id).eq('read', false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['unread-per-sender'] });
        queryClient.invalidateQueries({ queryKey: ['chat-previews'] });
      });
  }, [unreadLoadedIds, partner.user_id, user, queryClient]);

  useEffect(() => {
    const channel = supabase.channel(`chat-${partner.user_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any;
        if ((msg.sender_id === user?.id && msg.receiver_id === partner.user_id) ||
            (msg.sender_id === partner.user_id && msg.receiver_id === user?.id)) {
          addMessageToCache(msg as ChatMessage);
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['chat-previews'] });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reactions', 'message'] });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reactions', 'message'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [addMessageToCache, partner.user_id, user?.id, queryClient]);

  const loadOlderMessages = useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    previousScrollHeight.current = scrollRef.current.scrollHeight;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop <= 80) loadOlderMessages();
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJump(distanceFromBottom > 240);
  }, [loadOlderMessages]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const latest = messages[messages.length - 1];
    const latestId = latest?.id ?? null;

    if (previousScrollHeight.current !== null) {
      container.scrollTop = container.scrollHeight - previousScrollHeight.current;
      previousScrollHeight.current = null;
    } else if (!lastMessageId.current) {
      container.scrollTo({ top: container.scrollHeight });
    } else if (latestId && latestId !== lastMessageId.current) {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const shouldFollow = distanceFromBottom < 200 || latest.sender_id === user?.id;
      if (shouldFollow) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
    lastMessageId.current = latestId;
  }, [messages, user?.id]);

  const sendMutation = useMutation({
    mutationFn: async (payload: { content: string; image_url?: string | null; reply_to_id?: string | null }) => {
      const { data, error } = await supabase.from('messages').insert({
        sender_id: user!.id, receiver_id: partner.user_id,
        content: payload.content, image_url: payload.image_url ?? null,
        reply_to_id: payload.reply_to_id ?? null,
      } as any).select('*').single();
      if (error) throw error;
      return data as ChatMessage;
    },
    onSuccess: (sent) => {
      addMessageToCache(sent);
      queryClient.invalidateQueries({ queryKey: ['chat-previews'] });
    },
  });

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image', variant: 'destructive' }); return;
    }
    try {
      const compressed = await compressImage(file);
      setPendingImage({ file: compressed, preview: URL.createObjectURL(compressed) });
    } catch {
      toast({ title: 'Could not process image', variant: 'destructive' });
    }
  };

  const uploadImage = async (blob: Blob): Promise<string> => {
    const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('chat-images').upload(path, blob, {
      contentType: 'image/jpeg', cacheControl: '3600',
    });
    if (error) throw error;
    return supabase.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = message.trim();
    if (!trimmed && !pendingImage) return;
    try {
      let image_url: string | null = null;
      if (pendingImage) {
        setUploading(true);
        image_url = await uploadImage(pendingImage.file);
        URL.revokeObjectURL(pendingImage.preview);
      }
      await sendMutation.mutateAsync({ content: trimmed, image_url, reply_to_id: replyTo?.id ?? null });
      setMessage(''); setPendingImage(null); setReplyTo(null);
      // reset textarea height
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err?.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const cancelPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const startLongPress = (msg: ChatMessage) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setActiveMsgId(msg.id);
      if ('vibrate' in navigator) navigator.vibrate?.(15);
    }, 380);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 1600);
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  };

  // Build render items: time dividers + grouped messages
  type RenderItem =
    | { kind: 'divider'; id: string; label: string }
    | { kind: 'msg'; msg: ChatMessage; isMine: boolean; isFirstInGroup: boolean; isLastInGroup: boolean; showAvatar: boolean };

  const items: RenderItem[] = useMemo(() => {
    const out: RenderItem[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const t = new Date(m.created_at).getTime();
      const showDivider = !prev || (t - new Date(prev.created_at).getTime() > TIME_DIVIDER_MS);
      if (showDivider) out.push({ kind: 'divider', id: `d-${m.id}`, label: formatDivider(m.created_at) });
      const isMine = m.sender_id === user?.id;
      const sameSenderPrev = prev && prev.sender_id === m.sender_id && (t - new Date(prev.created_at).getTime() <= GROUP_THRESHOLD_MS) && !showDivider;
      const sameSenderNext = next && next.sender_id === m.sender_id && (new Date(next.created_at).getTime() - t <= GROUP_THRESHOLD_MS) && !(new Date(next.created_at).getTime() - t > TIME_DIVIDER_MS);
      const isFirstInGroup = !sameSenderPrev;
      const isLastInGroup = !sameSenderNext;
      out.push({ kind: 'msg', msg: m, isMine, isFirstInGroup, isLastInGroup, showAvatar: !isMine && isLastInGroup });
    }
    return out;
  }, [messages, user?.id]);

  const renderReplySnippet = (m: ChatMessage, isMine: boolean) => {
    if (!m.reply_to_id) return null;
    const original = messagesById.get(m.reply_to_id);
    const senderName = original?.sender_id === user?.id ? 'You' : partner.full_name;
    const snippet = original
      ? (original.image_url && !original.content ? '📷 Photo' : (original.content || '').slice(0, 100))
      : 'Original message';
    return (
      <button
        type="button"
        onClick={() => original && scrollToMessage(original.id)}
        className={cn(
          'block w-full text-left mb-1 px-2.5 py-1.5 rounded-lg border-l-2 text-[11px] transition-opacity hover:opacity-80',
          isMine ? 'bg-primary-foreground/15 border-primary-foreground/60' : 'bg-foreground/5 border-primary/60'
        )}
      >
        <p className="font-semibold truncate opacity-90">{senderName}</p>
        <p className="truncate opacity-70">{snippet}</p>
      </button>
    );
  };

  return (
    <>
      <div className="fixed inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[26rem] sm:h-[34rem] bg-card border-0 sm:border sm:border-border sm:rounded-2xl shadow-elevated flex flex-col z-50 overflow-hidden"
           style={{ height: '100dvh' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            {partner.avatar_url ? <AvatarImage src={partner.avatar_url} /> : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
              {partner.full_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">{partner.full_name}</p>
            <p className="text-[11px] text-muted-foreground">Active now</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8 rounded-full" aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleMessagesScroll}
          onClick={() => setActiveMsgId(null)}
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1 bg-gradient-to-b from-background/50 to-background scrollbar-thin"
          style={{ overscrollBehavior: 'contain' }}
        >
          {isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {messages.length === 0 && !isFetchingNextPage && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
              <Avatar className="h-16 w-16">
                {partner.avatar_url ? <AvatarImage src={partner.avatar_url} /> : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                  {partner.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{partner.full_name}</p>
                <p className="text-xs text-muted-foreground mt-1">Say hello 👋</p>
              </div>
            </div>
          )}

          {items.map(item => {
            if (item.kind === 'divider') {
              return (
                <div key={item.id} className="flex justify-center py-2">
                  <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted/40">
                    {item.label}
                  </span>
                </div>
              );
            }
            const { msg, isMine, isFirstInGroup, isLastInGroup, showAvatar } = item;
            const grouped = getGrouped(msg.id);
            const isActive = activeMsgId === msg.id;
            const isHighlight = highlightId === msg.id;
            const hasReactions = grouped.length > 0;

            return (
              <div
                key={msg.id}
                ref={(el) => { if (el) messageRefs.current.set(msg.id, el); else messageRefs.current.delete(msg.id); }}
                className={cn(
                  'flex items-end gap-2 animate-message-in',
                  isMine ? 'justify-end' : 'justify-start',
                  isFirstInGroup ? 'mt-2' : 'mt-0.5',
                  hasReactions && 'mb-3'
                )}
              >
                {/* Avatar slot (left side) */}
                {!isMine && (
                  <div className="w-7 shrink-0">
                    {showAvatar ? (
                      <Avatar className="h-7 w-7">
                        {partner.avatar_url ? <AvatarImage src={partner.avatar_url} /> : null}
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-bold">
                          {partner.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                )}

                <div className={cn('group relative max-w-[78%] sm:max-w-[70%]', isMine ? 'items-end' : 'items-start', 'flex flex-col')}>
                  {/* Bubble */}
                  <div
                    onContextMenu={(e) => { e.preventDefault(); setActiveMsgId(msg.id); }}
                    onTouchStart={() => startLongPress(msg)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'relative px-3 py-2 text-sm select-none transition-all',
                      isHighlight && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                      isMine
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                      // Bubble rounding based on group position (Messenger-style tails)
                      isMine
                        ? cn(
                            'rounded-2xl',
                            isFirstInGroup && 'rounded-tr-2xl',
                            !isFirstInGroup && 'rounded-tr-md',
                            !isLastInGroup && 'rounded-br-md',
                            isLastInGroup && 'rounded-br-sm'
                          )
                        : cn(
                            'rounded-2xl',
                            isFirstInGroup && 'rounded-tl-2xl',
                            !isFirstInGroup && 'rounded-tl-md',
                            !isLastInGroup && 'rounded-bl-md',
                            isLastInGroup && 'rounded-bl-sm'
                          ),
                      msg.image_url && !msg.content && 'p-1 bg-transparent'
                    )}
                  >
                    {renderReplySnippet(msg, isMine)}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="sent"
                        onClick={(e) => { e.stopPropagation(); setLightbox(msg.image_url!); }}
                        className={cn(
                          'rounded-xl max-h-72 w-auto object-cover cursor-zoom-in hover:opacity-95 transition-opacity',
                          msg.content && 'mb-1.5'
                        )}
                        loading="lazy"
                      />
                    )}
                    {msg.content && (
                      <span className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</span>
                    )}
                  </div>

                  {/* Timestamp on last in group */}
                  {isLastInGroup && (
                    <span className={cn('text-[10px] text-muted-foreground mt-0.5 px-1', isMine ? 'self-end' : 'self-start')}>
                      {formatTime(msg.created_at)}
                    </span>
                  )}

                  {/* Reactions overlapping bubble (Messenger style) */}
                  {hasReactions && (
                    <div className={cn(
                      'absolute -bottom-3 flex items-center gap-0.5 bg-card border border-border shadow-sm rounded-full px-1.5 py-0.5 animate-reaction-pop',
                      isMine ? 'right-1' : 'left-1'
                    )}>
                      {grouped.slice(0, 3).map(r => (
                        <button
                          key={r.emoji}
                          onClick={(e) => { e.stopPropagation(); toggleReaction.mutate({ targetId: msg.id, emoji: r.emoji }); }}
                          className={cn('text-xs leading-none transition-transform hover:scale-110', r.hasReacted && 'opacity-100')}
                        >
                          {r.emoji}
                        </button>
                      ))}
                      {grouped.reduce((s, r) => s + r.count, 0) > 1 && (
                        <span className="text-[10px] font-medium text-muted-foreground ml-0.5">
                          {grouped.reduce((s, r) => s + r.count, 0)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Hover/active actions toolbar */}
                  <div
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity',
                      isMine ? 'right-full mr-1.5' : 'left-full ml-1.5',
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                      'pointer-events-auto'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ReactionPicker onReact={(emoji) => { toggleReaction.mutate({ targetId: msg.id, emoji }); setActiveMsgId(null); }} />
                    <button
                      type="button"
                      onClick={() => { setReplyTo(msg); setActiveMsgId(null); textareaRef.current?.focus(); }}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-background border border-border shadow-sm hover:bg-muted transition-colors"
                      aria-label="Reply"
                    >
                      <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Jump-to-bottom */}
        {showJump && (
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
            className="absolute bottom-28 sm:bottom-24 right-4 z-10 h-9 w-9 rounded-full bg-card border border-border shadow-elevated flex items-center justify-center hover:bg-muted transition-colors animate-message-in"
            aria-label="Scroll to latest"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div className="px-3 pt-2 pb-1.5 border-t border-border bg-muted/30 flex items-start gap-2 animate-message-in">
            <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
              <p className="text-[11px] font-semibold text-primary">
                Replying to {replyTo.sender_id === user?.id ? 'yourself' : partner.full_name}
              </p>
              <p className="text-xs truncate text-muted-foreground">
                {replyTo.image_url && !replyTo.content ? '📷 Photo' : replyTo.content}
              </p>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 rounded-full" onClick={() => setReplyTo(null)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Pending image */}
        {pendingImage && (
          <div className="px-3 pt-2 pb-1 border-t border-border bg-muted/30 flex items-center gap-2 animate-message-in">
            <div className="relative">
              <img src={pendingImage.preview} alt="preview" className="h-16 w-16 object-cover rounded-lg" />
              <button
                type="button"
                onClick={cancelPendingImage}
                className="absolute -top-1.5 -right-1.5 bg-card border border-border rounded-full p-0.5 shadow-sm hover:bg-muted"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Image attached</p>
          </div>
        )}

        {/* Composer */}
        <form onSubmit={handleSend} className="p-2.5 border-t border-border bg-card flex items-end gap-1.5">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-full text-primary"
            onClick={handlePickImage}
            disabled={uploading}
            aria-label="Attach image"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>

          <div className="flex-1 flex items-end bg-muted rounded-3xl px-3 py-1 min-h-9">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={e => {
                const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Aa"
              rows={1}
              className="flex-1 min-h-7 max-h-32 text-sm resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-1.5 shadow-none"
            />
            <div className="shrink-0">
              <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} />
            </div>
          </div>

          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 shrink-0"
            disabled={sendMutation.isPending || uploading || (!message.trim() && !pendingImage)}
            aria-label="Send"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-message-in"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={lightbox} alt="preview" className="max-h-full max-w-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
};

export default ChatWindow;
