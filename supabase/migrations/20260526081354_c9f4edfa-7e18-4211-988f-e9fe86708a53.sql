
-- 1. Drop overly permissive policies
DROP POLICY IF EXISTS "All authenticated can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "All authenticated can view blocked users" ON public.blocked_users;

-- 2. Drop duplicate unrestricted submissions upload policy
DROP POLICY IF EXISTS "Students can upload to submissions" ON storage.objects;

-- 3. Move has_role to a private schema so it's not exposed via PostgREST
CREATE SCHEMA IF NOT EXISTS private;

-- Recreate function in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Update RLS policies to use private.has_role, then drop the public one
-- user_roles
DROP POLICY IF EXISTS "Teachers can manage roles" ON public.user_roles;
CREATE POLICY "Teachers can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- assignments
DROP POLICY IF EXISTS "Teachers can create assignments" ON public.assignments;
CREATE POLICY "Teachers can create assignments" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can update assignments" ON public.assignments;
CREATE POLICY "Teachers can update assignments" ON public.assignments
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can delete assignments" ON public.assignments;
CREATE POLICY "Teachers can delete assignments" ON public.assignments
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- submissions
DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
CREATE POLICY "Students can view own submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING ((auth.uid() = student_id) OR private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Students can submit" ON public.submissions;
CREATE POLICY "Students can submit" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = student_id) AND private.has_role(auth.uid(), 'student'::public.app_role));
DROP POLICY IF EXISTS "Teachers can grade" ON public.submissions;
CREATE POLICY "Teachers can grade" ON public.submissions
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- lessons
DROP POLICY IF EXISTS "Teachers can update lessons" ON public.lessons;
CREATE POLICY "Teachers can update lessons" ON public.lessons
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- vocab_games
DROP POLICY IF EXISTS "Teachers can create vocab games" ON public.vocab_games;
CREATE POLICY "Teachers can create vocab games" ON public.vocab_games
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can update vocab games" ON public.vocab_games;
CREATE POLICY "Teachers can update vocab games" ON public.vocab_games
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can delete vocab games" ON public.vocab_games;
CREATE POLICY "Teachers can delete vocab games" ON public.vocab_games
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- vocab_items
DROP POLICY IF EXISTS "Teachers can create vocab items" ON public.vocab_items;
CREATE POLICY "Teachers can create vocab items" ON public.vocab_items
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can update vocab items" ON public.vocab_items;
CREATE POLICY "Teachers can update vocab items" ON public.vocab_items
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can delete vocab items" ON public.vocab_items;
CREATE POLICY "Teachers can delete vocab items" ON public.vocab_items
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- blocked_users
DROP POLICY IF EXISTS "Teachers can manage blocked users" ON public.blocked_users;
CREATE POLICY "Teachers can manage blocked users" ON public.blocked_users
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- lesson_comments
DROP POLICY IF EXISTS "Teachers can delete any comment" ON public.lesson_comments;
CREATE POLICY "Teachers can delete any comment" ON public.lesson_comments
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- spelling_games
DROP POLICY IF EXISTS "Teachers can create spelling games" ON public.spelling_games;
CREATE POLICY "Teachers can create spelling games" ON public.spelling_games
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can update spelling games" ON public.spelling_games;
CREATE POLICY "Teachers can update spelling games" ON public.spelling_games
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can delete spelling games" ON public.spelling_games;
CREATE POLICY "Teachers can delete spelling games" ON public.spelling_games
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- spelling_items
DROP POLICY IF EXISTS "Teachers can create spelling items" ON public.spelling_items;
CREATE POLICY "Teachers can create spelling items" ON public.spelling_items
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can update spelling items" ON public.spelling_items;
CREATE POLICY "Teachers can update spelling items" ON public.spelling_items
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can delete spelling items" ON public.spelling_items;
CREATE POLICY "Teachers can delete spelling items" ON public.spelling_items
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'teacher'::public.app_role));

-- storage policies that use has_role
DROP POLICY IF EXISTS "Teachers can delete lesson files" ON storage.objects;
CREATE POLICY "Teachers can delete lesson files" ON storage.objects
  FOR DELETE TO authenticated
  USING ((bucket_id = 'lesson-files'::text) AND private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can delete vocab images" ON storage.objects;
CREATE POLICY "Teachers can delete vocab images" ON storage.objects
  FOR DELETE TO authenticated
  USING ((bucket_id = 'vocab-images'::text) AND private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can update lesson files" ON storage.objects;
CREATE POLICY "Teachers can update lesson files" ON storage.objects
  FOR UPDATE TO authenticated
  USING ((bucket_id = 'lesson-files'::text) AND private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Teachers can upload lesson files" ON storage.objects;
CREATE POLICY "Teachers can upload lesson files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'lesson-files'::text) AND private.has_role(auth.uid(), 'teacher'::public.app_role));
DROP POLICY IF EXISTS "Users can view submissions files" ON storage.objects;
CREATE POLICY "Users can view submissions files" ON storage.objects
  FOR SELECT TO authenticated
  USING ((bucket_id = 'submissions'::text) AND (((auth.uid())::text = (storage.foldername(name))[1]) OR private.has_role(auth.uid(), 'teacher'::public.app_role)));

-- Now drop the public has_role
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 4. Restrict correct_answer column access: revoke column SELECT for non-teachers
-- Replace broad SELECT policy with two policies: teachers see all columns, others see all rows but without correct_answer (enforced via column privileges)
REVOKE SELECT ON public.assignments FROM authenticated, anon;
GRANT SELECT (id, title, description, type, options, due_date, due_time, created_at, updated_at, created_by) ON public.assignments TO authenticated;
GRANT SELECT ON public.assignments TO service_role;
-- Teachers need correct_answer too — grant via separate column grant only to a teacher-only path: use a SECURITY DEFINER view? Simpler: keep correct_answer ungrantable to authenticated. Teachers will get correct_answer via a dedicated RPC.

-- RPC for teachers to fetch correct answer when editing
CREATE OR REPLACE FUNCTION public.get_assignment_correct_answer(_assignment_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_answer text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT correct_answer INTO v_answer FROM public.assignments WHERE id = _assignment_id;
  RETURN v_answer;
END;
$$;
REVOKE ALL ON FUNCTION public.get_assignment_correct_answer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assignment_correct_answer(uuid) TO authenticated;

-- 5. RPC for grading MC submissions server-side
CREATE OR REPLACE FUNCTION public.grade_mc_submission(_assignment_id uuid, _answer text)
RETURNS public.submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_correct text;
  v_is_correct boolean;
  v_row public.submissions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT private.has_role(auth.uid(), 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Only students can submit';
  END IF;
  SELECT correct_answer INTO v_correct FROM public.assignments WHERE id = _assignment_id;
  v_is_correct := (_answer = v_correct);
  INSERT INTO public.submissions (assignment_id, student_id, content, grade, feedback, graded_at)
  VALUES (
    _assignment_id,
    auth.uid(),
    _answer,
    CASE WHEN v_is_correct THEN 100 ELSE 0 END,
    CASE WHEN v_is_correct THEN 'Correct!' ELSE 'Incorrect.' END,
    now()
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.grade_mc_submission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_mc_submission(uuid, text) TO authenticated;
