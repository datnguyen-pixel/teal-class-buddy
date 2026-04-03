import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Trash2, Reply, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReactionPicker from '@/components/ui/reaction-picker';
import ReactionDisplay from '@/components/ui/reaction-display';
import { useReactions } from '@/hooks/useReactions';

interface LessonCommentsProps {
  lessonId: number;
  lessonTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Comment {
  id: string;
  lesson_id: number;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profile?: { full_name: string; avatar_url: string | null };
}

const LessonComments = ({ lessonId, lessonTitle, open, onOpenChange }: LessonCommentsProps) => {
  const { user, isTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ['lesson-comments', lessonId],
    queryFn: async () => {
      const { data: commentsData, error } = await supabase
        .from('lesson_comments')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set((commentsData || []).map(c => c.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      return (commentsData || []).map(c => ({
        ...c,
        profile: profileMap.get(c.user_id) || { full_name: 'Unknown', avatar_url: null },
      })) as Comment[];
    },
    enabled: open,
  });

  const commentIds = useMemo(() => comments.map(c => c.id), [comments]);
  const { getGrouped: getCommentReactions, toggleReaction: toggleCommentReaction } = useReactions('comment', commentIds);

  const topLevel = comments.filter(c => !c.parent_id);
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newComment.trim()) return;

      const { data: comment, error } = await supabase.from('lesson_comments').insert({
        lesson_id: lessonId,
        user_id: user.id,
        content: newComment.trim(),
        parent_id: replyTo?.id || null,
      }).select().single();
      if (error) throw error;

      // Create notifications
      if (replyTo && !isTeacher) {
        // Teacher replying → notify the student who wrote the parent comment (handled below)
        // Student replying to someone → notify teachers
      }

      if (isTeacher && replyTo) {
        // Teacher replies → notify the student who wrote the parent comment
        if (replyTo.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: replyTo.user_id,
            triggered_by: user.id,
            type: 'reply',
            lesson_id: lessonId,
            comment_id: comment.id,
            content_preview: newComment.trim().slice(0, 100),
          });
        }
      } else {
        // Student comments → notify ALL teachers
        const { data: teacherRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'teacher');

        const teacherIds = (teacherRoles || [])
          .map(r => r.user_id)
          .filter(id => id !== user.id);

        if (teacherIds.length > 0) {
          await supabase.from('notifications').insert(
            teacherIds.map(tid => ({
              user_id: tid,
              triggered_by: user.id,
              type: replyTo ? 'reply' : 'comment',
              lesson_id: lessonId,
              comment_id: comment.id,
              content_preview: newComment.trim().slice(0, 100),
            }))
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-comments', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['comment-counts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setNewComment('');
      setReplyTo(null);
      toast.success('Đã gửi bình luận!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('lesson_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-comments', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['comment-counts'] });
      toast.success('Đã xoá bình luận');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canDelete = (comment: Comment) => isTeacher || comment.user_id === user?.id;

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const grouped = getCommentReactions(comment.id);
    return (
      <div className={`flex gap-2 ${isReply ? 'ml-8' : ''} group`}>
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {comment.profile?.avatar_url ? (
            <img src={comment.profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            comment.profile?.full_name?.charAt(0) || '?'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-muted/50 rounded-lg px-3 py-2 relative">
            <p className="text-xs font-semibold">{comment.profile?.full_name}</p>
            <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
            {/* Reaction picker on hover */}
            <div className="absolute -bottom-3 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ReactionPicker onReact={(emoji) => toggleCommentReaction.mutate({ targetId: comment.id, emoji })} />
            </div>
          </div>
          {/* Reaction display */}
          <ReactionDisplay
            reactions={grouped}
            onToggle={(emoji) => toggleCommentReaction.mutate({ targetId: comment.id, emoji })}
            className="mt-1 px-1"
          />
          <div className="flex items-center gap-3 mt-0.5 px-1">
            <span className="text-[10px] text-muted-foreground">{format(new Date(comment.created_at), 'dd/MM HH:mm')}</span>
            {!isReply && (
              <button onClick={() => setReplyTo(comment)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                <Reply className="w-3 h-3" /> Trả lời
              </button>
            )}
            {canDelete(comment) && (
              <button onClick={() => deleteCommentMutation.mutate(comment.id)} className="text-[10px] text-destructive hover:underline flex items-center gap-0.5">
                <Trash2 className="w-3 h-3" /> Xoá
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-4 h-4" /> Bình luận — {lessonTitle}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[50vh] pr-2">
          <div className="space-y-4 py-2">
            {topLevel.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Chưa có bình luận nào.</p>
            )}
            {topLevel.map(c => (
              <div key={c.id} className="space-y-2">
                <CommentItem comment={c} />
                {replies(c.id).map(r => (
                  <CommentItem key={r.id} comment={r} isReply />
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Reply indicator */}
        {replyTo && (
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded text-xs">
            <Reply className="w-3 h-3" />
            <span>Trả lời <strong>{replyTo.profile?.full_name}</strong></span>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 items-end pt-2 border-t">
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Viết bình luận..."
            rows={2}
            className="min-h-[60px] text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (newComment.trim()) addCommentMutation.mutate();
              }
            }}
          />
          <Button
            size="icon"
            className="shrink-0"
            disabled={!newComment.trim() || addCommentMutation.isPending}
            onClick={() => addCommentMutation.mutate()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LessonComments;
