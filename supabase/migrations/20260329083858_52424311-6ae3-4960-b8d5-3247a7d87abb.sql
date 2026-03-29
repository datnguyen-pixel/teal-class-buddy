
-- Messages table for private chat
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can see messages they sent or received
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (mark as read)
CREATE POLICY "Users can mark received messages read" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Blocked users table
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blocked_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Teachers can manage blocked users
CREATE POLICY "Teachers can manage blocked users" ON public.blocked_users
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

-- All authenticated can check if they are blocked
CREATE POLICY "Users can check own block status" ON public.blocked_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
