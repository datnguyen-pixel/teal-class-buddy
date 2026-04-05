
CREATE TABLE public.spelling_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spelling_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spelling games viewable by authenticated" ON public.spelling_games FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can create spelling games" ON public.spelling_games FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Teachers can update spelling games" ON public.spelling_games FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Teachers can delete spelling games" ON public.spelling_games FOR DELETE TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));

CREATE TRIGGER update_spelling_games_updated_at BEFORE UPDATE ON public.spelling_games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.spelling_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.spelling_games(id) ON DELETE CASCADE,
  vietnamese_text TEXT NOT NULL,
  english_word TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spelling_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spelling items viewable by authenticated" ON public.spelling_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can create spelling items" ON public.spelling_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Teachers can update spelling items" ON public.spelling_items FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Teachers can delete spelling items" ON public.spelling_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'teacher'::app_role));
