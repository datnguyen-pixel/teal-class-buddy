CREATE POLICY "All authenticated can view blocked users"
ON public.blocked_users
FOR SELECT
TO authenticated
USING (true);