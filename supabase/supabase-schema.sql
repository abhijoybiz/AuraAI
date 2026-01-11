-- ============================================
-- MEMRY APP - SUPABASE PRODUCTION SCHEMA
-- ============================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- This creates all necessary tables, policies, and functions
-- ============================================

-- ============================================
-- USERS TABLE (Whitelist + Profile)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    is_whitelisted BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.users IS 'User profiles with whitelist status for access control';
COMMENT ON COLUMN public.users.is_whitelisted IS 'If TRUE, user has full access to app features';
COMMENT ON COLUMN public.users.is_active IS 'If FALSE, user is disabled regardless of whitelist status';

-- ============================================
-- LECTURES TABLE (Cloud Storage for Lectures)
-- ============================================
CREATE TABLE IF NOT EXISTS public.lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    duration TEXT,
    category TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    transcript TEXT,
    segments JSONB,
    summary TEXT,
    flashcards JSONB,
    quiz JSONB,
    notes JSONB,
    journey_map JSONB,
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.lectures IS 'User lectures with transcripts and AI-generated materials';

-- ============================================
-- AI USAGE TRACKING (for future paywalls)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'transcribe', 'summary', 'flashcards', 'quiz', 'notes', 'chat'
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.ai_usage IS 'Tracks AI feature usage for billing and analytics';

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_whitelisted ON public.users(is_whitelisted) WHERE is_whitelisted = TRUE;
CREATE INDEX IF NOT EXISTS idx_lectures_user_id ON public.lectures(user_id);
CREATE INDEX IF NOT EXISTS idx_lectures_created_at ON public.lectures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lectures_category ON public.lectures(category);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON public.ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_action_type ON public.ai_usage(action_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own lectures" ON public.lectures;
DROP POLICY IF EXISTS "Whitelisted users can insert lectures" ON public.lectures;
DROP POLICY IF EXISTS "Users can update own lectures" ON public.lectures;
DROP POLICY IF EXISTS "Users can delete own lectures" ON public.lectures;
DROP POLICY IF EXISTS "Users can read own usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Whitelisted users can log usage" ON public.ai_usage;

-- USERS POLICIES
CREATE POLICY "Users can read own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- LECTURES POLICIES
CREATE POLICY "Users can read own lectures"
    ON public.lectures FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Whitelisted users can insert lectures"
    ON public.lectures FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_whitelisted = TRUE AND is_active = TRUE
        )
    );

CREATE POLICY "Users can update own lectures"
    ON public.lectures FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lectures"
    ON public.lectures FOR DELETE
    USING (auth.uid() = user_id);

-- AI USAGE POLICIES
CREATE POLICY "Users can read own usage"
    ON public.ai_usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Whitelisted users can log usage"
    ON public.ai_usage FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_whitelisted = TRUE AND is_active = TRUE
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if current user is whitelisted
CREATE OR REPLACE FUNCTION public.is_user_whitelisted()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND is_whitelisted = TRUE AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_user_whitelisted IS 'Returns TRUE if the current user is whitelisted and active';

-- Function to get user's AI usage stats
CREATE OR REPLACE FUNCTION public.get_user_usage_stats(time_period INTERVAL DEFAULT '30 days')
RETURNS TABLE (
    action_type TEXT,
    total_calls BIGINT,
    total_tokens BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.action_type,
        COUNT(*)::BIGINT as total_calls,
        COALESCE(SUM(u.tokens_used), 0)::BIGINT as total_tokens
    FROM public.ai_usage u
    WHERE u.user_id = auth.uid()
      AND u.created_at > NOW() - time_period
    GROUP BY u.action_type
    ORDER BY total_calls DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_usage_stats IS 'Returns AI usage statistics for the current user';

-- ============================================
-- TRIGGER: Auto-create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_lectures_updated_at ON public.lectures;
CREATE TRIGGER update_lectures_updated_at
    BEFORE UPDATE ON public.lectures
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ADMIN VIEWS (for dashboard/analytics)
-- ============================================

-- View: User statistics (for admins)
CREATE OR REPLACE VIEW public.admin_user_stats AS
SELECT 
    u.id,
    u.email,
    u.display_name,
    u.is_whitelisted,
    u.is_active,
    u.created_at,
    COUNT(DISTINCT l.id) as lecture_count,
    COUNT(DISTINCT a.id) as ai_usage_count,
    MAX(l.created_at) as last_lecture_at
FROM public.users u
LEFT JOIN public.lectures l ON u.id = l.user_id
LEFT JOIN public.ai_usage a ON u.id = a.user_id
GROUP BY u.id, u.email, u.display_name, u.is_whitelisted, u.is_active, u.created_at;

-- Note: This view should only be accessible to service role, not anon key

-- ============================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- ============================================
-- Uncomment below to add sample data for testing

-- INSERT INTO public.users (id, email, display_name, is_whitelisted)
-- VALUES 
--     ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'Test User', TRUE)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the setup was successful:

-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('users', 'lectures', 'ai_usage');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('users', 'lectures', 'ai_usage');

-- Check policies exist
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
