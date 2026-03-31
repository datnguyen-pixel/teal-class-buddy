ALTER TABLE public.vocab_items ADD COLUMN question_text text DEFAULT NULL;
ALTER TABLE public.vocab_items ALTER COLUMN image_url DROP NOT NULL;