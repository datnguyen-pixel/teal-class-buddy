
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'essay';
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS options jsonb DEFAULT NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS correct_answer text DEFAULT NULL;

-- Storage policies for voice recordings in submissions bucket
DROP POLICY IF EXISTS "Students can upload to submissions" ON storage.objects;
CREATE POLICY "Students can upload to submissions" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions');

DROP POLICY IF EXISTS "Authenticated can view submissions files" ON storage.objects;
CREATE POLICY "Authenticated can view submissions files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'submissions');
