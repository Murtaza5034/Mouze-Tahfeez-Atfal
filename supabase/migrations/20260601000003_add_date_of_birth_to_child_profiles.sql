-- Add date_of_birth column to child_profiles
ALTER TABLE public.child_profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;
