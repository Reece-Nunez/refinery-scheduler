-- Expand users table with useful fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, phone, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name'),
    NEW.phone,
    'OPER',  -- Default role for new users
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    phone = COALESCE(EXCLUDED.phone, users.phone),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create user record on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to sync updates from auth.users
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users SET
    email = NEW.email,
    phone = NEW.phone,
    display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', users.display_name),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Backfill existing auth users into users table
INSERT INTO public.users (id, email, phone, role, created_at)
SELECT
  au.id,
  au.email,
  au.phone,
  COALESCE(u.role, 'OPER'),
  au.created_at
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

-- Update existing users with email from auth
UPDATE public.users u
SET
  email = au.email,
  phone = au.phone,
  updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id AND u.email IS NULL;
