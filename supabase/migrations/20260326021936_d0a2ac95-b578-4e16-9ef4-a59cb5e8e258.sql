-- Add thumbnail and attachments columns to lessons
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Create lesson-files storage bucket (public for easy access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-files', 'lesson-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read lesson files
CREATE POLICY "Authenticated can view lesson files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-files');

-- Teachers can upload lesson files
CREATE POLICY "Teachers can upload lesson files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lesson-files' AND public.has_role(auth.uid(), 'teacher'::app_role));

-- Teachers can delete lesson files
CREATE POLICY "Teachers can delete lesson files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lesson-files' AND public.has_role(auth.uid(), 'teacher'::app_role));

-- Teachers can update lesson files
CREATE POLICY "Teachers can update lesson files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lesson-files' AND public.has_role(auth.uid(), 'teacher'::app_role));