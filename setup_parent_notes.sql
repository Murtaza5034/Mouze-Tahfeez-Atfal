CREATE TABLE IF NOT EXISTS public.parent_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security
ALTER TABLE public.parent_notes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to insert notes
CREATE POLICY "Allow authenticated to insert parent_notes" ON public.parent_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to select notes
CREATE POLICY "Allow authenticated to read parent_notes" ON public.parent_notes
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to update notes (if needed)
CREATE POLICY "Allow authenticated to update parent_notes" ON public.parent_notes
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow all authenticated users to delete notes
CREATE POLICY "Allow authenticated to delete parent_notes" ON public.parent_notes
  FOR DELETE
  TO authenticated
  USING (true);
