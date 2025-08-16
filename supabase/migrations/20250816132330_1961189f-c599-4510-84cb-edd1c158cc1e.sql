-- Add admin delete policy for trios table
CREATE POLICY "Admins can delete trios" ON public.trios
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));