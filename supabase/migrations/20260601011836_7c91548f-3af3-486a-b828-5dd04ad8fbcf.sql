
-- 1. Remove duplicate broad SELECT policy on submissions bucket
DROP POLICY IF EXISTS "Authenticated can view submissions files" ON storage.objects;

-- 2. Allow students to update/delete their own submission files
CREATE POLICY "Users can update own submission files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own submission files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Restrict vocab-images uploads to teachers
DROP POLICY IF EXISTS "Authenticated can upload vocab images" ON storage.objects;
CREATE POLICY "Teachers can upload vocab images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vocab-images' AND private.has_role(auth.uid(), 'teacher'::public.app_role));

-- 4. Notifications: validate the referenced comment/lesson belongs to inserter
DROP POLICY IF EXISTS "Authenticated can create notifications" ON public.notifications;
CREATE POLICY "Users can create valid notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = triggered_by
  AND (
    -- comment-based: comment must exist and be authored by the inserter
    (comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.lesson_comments c
      WHERE c.id = notifications.comment_id
        AND c.user_id = auth.uid()
        AND c.lesson_id = notifications.lesson_id
    ))
    OR
    -- non-comment notifications: only teachers (e.g. new lesson announcements)
    (comment_id IS NULL AND private.has_role(auth.uid(), 'teacher'::public.app_role))
  )
);

-- 5. Revoke public/anon execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.grade_mc_submission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_assignment_correct_answer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_mc_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_correct_answer(uuid) TO authenticated;
