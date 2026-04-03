
CREATE TABLE public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT reaction_target CHECK (
    (message_id IS NOT NULL AND comment_id IS NULL) OR
    (message_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT unique_user_emoji_message UNIQUE (user_id, emoji, message_id),
  CONSTRAINT unique_user_emoji_comment UNIQUE (user_id, emoji, comment_id)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions viewable by authenticated"
  ON public.reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can add reactions"
  ON public.reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_reactions_message ON public.reactions(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_reactions_comment ON public.reactions(comment_id) WHERE comment_id IS NOT NULL;
