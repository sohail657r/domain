-- Force complete types regeneration by creating and dropping a temporary table
CREATE TABLE IF NOT EXISTS public._temp_types_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Drop it immediately
DROP TABLE IF EXISTS public._temp_types_sync;

-- Add helpful comments to all tables
COMMENT ON TABLE public.admins IS 'Administrator users';
COMMENT ON TABLE public.user_roles IS 'User role assignments';
COMMENT ON TABLE public.social_links IS 'Social media links';
COMMENT ON TABLE public.posts IS 'Video posts with thumbnails';