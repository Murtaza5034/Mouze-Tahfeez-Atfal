-- Chat Messaging System for Mauze Tahfeez
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT,
  sender_role TEXT, -- 'admin', 'teacher', 'parents'
  recipient_id UUID REFERENCES auth.users(id), -- Specific user or NULL for role-based
  recipient_role TEXT, -- 'admin', 'teacher', 'parents'
  student_id UUID REFERENCES public.child_profiles(student_id), -- Context
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 1. Users can see messages where they are the sender or recipient
CREATE POLICY "Users can view their own messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id 
  OR auth.uid() = recipient_id 
  OR (recipient_role = 'admin' AND EXISTS (
    SELECT 1 FROM public.user_portal_access 
    WHERE user_id = auth.uid() AND portal_role = 'admin'
  ))
);

-- 2. Users can insert messages
CREATE POLICY "Users can send messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- 3. Recipients can update (e.g. mark as read)
CREATE POLICY "Recipients can mark messages as read"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id OR (recipient_role = 'admin' AND EXISTS (
    SELECT 1 FROM public.user_portal_access 
    WHERE user_id = auth.uid() AND portal_role = 'admin'
  )))
WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
