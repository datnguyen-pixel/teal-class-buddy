
-- Vocabulary games table
CREATE TABLE public.vocab_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  time_per_question integer NOT NULL DEFAULT 10,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vocab_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vocab games viewable by authenticated" ON public.vocab_games
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers can create vocab games" ON public.vocab_games
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can update vocab games" ON public.vocab_games
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can delete vocab games" ON public.vocab_games
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));

-- Vocabulary items table
CREATE TABLE public.vocab_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.vocab_games(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  main_answer text NOT NULL,
  alt_answer text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vocab_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vocab items viewable by authenticated" ON public.vocab_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers can create vocab items" ON public.vocab_items
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can update vocab items" ON public.vocab_items
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can delete vocab items" ON public.vocab_items
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));

-- Storage bucket for vocab images
INSERT INTO storage.buckets (id, name, public) VALUES ('vocab-images', 'vocab-images', true);

CREATE POLICY "Authenticated can upload vocab images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vocab-images');

CREATE POLICY "Anyone can view vocab images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'vocab-images');

CREATE POLICY "Teachers can delete vocab images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'vocab-images' AND has_role(auth.uid(), 'teacher'::app_role));
