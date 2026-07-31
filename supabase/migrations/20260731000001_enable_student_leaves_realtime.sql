-- Enable Realtime for student_leaves so admin-parent chat messages appear instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_leaves;
