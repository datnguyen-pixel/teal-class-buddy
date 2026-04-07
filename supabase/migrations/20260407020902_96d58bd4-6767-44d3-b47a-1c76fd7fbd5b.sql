
ALTER TABLE public.vocab_games ADD COLUMN random_order boolean NOT NULL DEFAULT false;
ALTER TABLE public.spelling_games ADD COLUMN random_order boolean NOT NULL DEFAULT false;
