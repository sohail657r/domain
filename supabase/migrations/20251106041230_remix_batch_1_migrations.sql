
-- Migration: 20251106033055

-- Migration: 20251104180218

-- Migration: 20251104172918

-- Migration: 20251104163707

-- Migration: 20251102082747
-- Create admins table (only one admin allowed)
CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Create posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  video_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admins table
-- Only authenticated admins can read their own data
CREATE POLICY "Admins can read own data"
  ON public.admins
  FOR SELECT
  USING (auth.uid() = id);

-- RLS Policies for posts table
-- Everyone can view posts
CREATE POLICY "Anyone can view posts"
  ON public.posts
  FOR SELECT
  USING (true);

-- Only authenticated admins can insert posts
CREATE POLICY "Admins can insert posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

-- Only authenticated admins can update posts
CREATE POLICY "Admins can update posts"
  ON public.posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

-- Only authenticated admins can delete posts
CREATE POLICY "Admins can delete posts"
  ON public.posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

-- Function to check if admin already exists
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admins LIMIT 1);
END;
$$;

-- Function to create admin profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create admin if none exists
  IF NOT EXISTS (SELECT 1 FROM public.admins LIMIT 1) THEN
    INSERT INTO public.admins (id, email, username)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to create admin profile after user signup
CREATE TRIGGER on_auth_admin_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_admin();

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_slug(title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  slug TEXT;
  counter INT := 0;
  temp_slug TEXT;
BEGIN
  -- Convert title to lowercase, replace spaces with hyphens
  slug := LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g'));
  slug := TRIM(BOTH '-' FROM slug);
  
  -- Check if slug exists, if yes, append number
  temp_slug := slug;
  WHILE EXISTS (SELECT 1 FROM public.posts WHERE posts.slug = temp_slug) LOOP
    counter := counter + 1;
    temp_slug := slug || '-' || counter;
  END LOOP;
  
  RETURN temp_slug;
END;
$$;

-- Trigger to auto-generate slug before insert
CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_slug_before_insert
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_post_slug();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Migration: 20251102083553
-- Create storage bucket for post thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-thumbnails', 'post-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for post-thumbnails bucket
-- Anyone can view thumbnails (public bucket)
CREATE POLICY "Anyone can view thumbnails"
ON storage.objects
FOR SELECT
USING (bucket_id = 'post-thumbnails');

-- Only admins can upload thumbnails
CREATE POLICY "Admins can upload thumbnails"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'post-thumbnails' AND
  EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  )
);

-- Only admins can update thumbnails
CREATE POLICY "Admins can update thumbnails"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'post-thumbnails' AND
  EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  )
);

-- Only admins can delete thumbnails
CREATE POLICY "Admins can delete thumbnails"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'post-thumbnails' AND
  EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  )
);

-- Migration: 20251102083655
-- Fix search_path for all functions to prevent security issues

-- Update generate_slug function
CREATE OR REPLACE FUNCTION public.generate_slug(title text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slug TEXT;
  counter INT := 0;
  temp_slug TEXT;
BEGIN
  slug := LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g'));
  slug := TRIM(BOTH '-' FROM slug);
  
  temp_slug := slug;
  WHILE EXISTS (SELECT 1 FROM public.posts WHERE posts.slug = temp_slug) LOOP
    counter := counter + 1;
    temp_slug := slug || '-' || counter;
  END LOOP;
  
  RETURN temp_slug;
END;
$$;

-- Update set_post_slug function
CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

-- Update update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- Migration: 20251104164407
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'subadmin');

-- Create user_roles table (separate from users for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'subadmin' THEN 2
  END
  LIMIT 1
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create sub-admins"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  AND role IN ('admin', 'subadmin')
);

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update posts RLS policies to use role-based access
DROP POLICY IF EXISTS "Admins can delete posts" ON public.posts;
DROP POLICY IF EXISTS "Admins can insert posts" ON public.posts;
DROP POLICY IF EXISTS "Admins can update posts" ON public.posts;

CREATE POLICY "Admins can delete posts"
ON public.posts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins and sub-admins can create posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'subadmin')
);

CREATE POLICY "Admins and sub-admins can update posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'subadmin')
);

-- Trigger to create admin role for first user
CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If no roles exist yet, make this user an admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_first_admin();

-- Migration: 20251104164434
-- Fix search_path for existing functions to address security linter warning

-- Fix generate_slug function
CREATE OR REPLACE FUNCTION public.generate_slug(title text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  slug TEXT;
  counter INT := 0;
  temp_slug TEXT;
BEGIN
  slug := LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g'));
  slug := TRIM(BOTH '-' FROM slug);
  
  temp_slug := slug;
  WHILE EXISTS (SELECT 1 FROM public.posts WHERE posts.slug = temp_slug) LOOP
    counter := counter + 1;
    temp_slug := slug || '-' || counter;
  END LOOP;
  
  RETURN temp_slug;
END;
$$;

-- Fix set_post_slug function
CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

-- Fix update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix admin_exists function
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admins LIMIT 1);
END;
$$;

-- Fix handle_new_admin function
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create admin if none exists
  IF NOT EXISTS (SELECT 1 FROM public.admins LIMIT 1) THEN
    INSERT INTO public.admins (id, email, username)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))
    );
  END IF;
  RETURN NEW;
END;
$$;


-- Migration: 20251104173635
-- Add additional_images column to posts table
ALTER TABLE public.posts 
ADD COLUMN additional_images jsonb DEFAULT '[]'::jsonb;

-- Migration: 20251104174849
-- Drop existing storage policies for post-thumbnails
DROP POLICY IF EXISTS "Admins can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete thumbnails" ON storage.objects;

-- Create new storage policies that allow both admins and sub-admins
CREATE POLICY "Admins and sub-admins can upload thumbnails"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'post-thumbnails' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'subadmin'::app_role)
  )
);

CREATE POLICY "Admins and sub-admins can update thumbnails"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'post-thumbnails' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'subadmin'::app_role)
  )
);

CREATE POLICY "Admins can delete thumbnails"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'post-thumbnails' 
  AND has_role(auth.uid(), 'admin'::app_role)
);


-- Migration: 20251104181109
-- Trigger types regeneration after remix
-- This ensures TypeScript types are in sync with the database schema

-- Refresh the existing tables to regenerate types
COMMENT ON TABLE public.posts IS 'User posts with videos and images';
COMMENT ON TABLE public.user_roles IS 'User role assignments for access control';
COMMENT ON TABLE public.admins IS 'Admin users table';

-- Migration: 20251104181153
-- Force types regeneration by updating table structure
-- Add a helpful index that will also trigger type regeneration

-- Add index for better query performance on posts
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- Add index for user_roles lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Ensure RLS is enabled (should already be enabled)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Migration: 20251105173435
-- Create social_links table for managing social media banners
CREATE TABLE public.social_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

-- Anyone can view active social links
CREATE POLICY "Anyone can view active social links"
ON public.social_links
FOR SELECT
USING (is_active = true);

-- Admins and sub-admins can create social links
CREATE POLICY "Admins and sub-admins can create social links"
ON public.social_links
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'subadmin'::app_role));

-- Admins and sub-admins can update social links
CREATE POLICY "Admins and sub-admins can update social links"
ON public.social_links
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'subadmin'::app_role));

-- Admins can delete social links
CREATE POLICY "Admins can delete social links"
ON public.social_links
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_social_links_updated_at
BEFORE UPDATE ON public.social_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

