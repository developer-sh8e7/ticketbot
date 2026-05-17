-- ====================================================================
-- OPUS SYSTEM BOT - INITIAL DATABASE SCHEMA
-- Execute this file in your Supabase SQL Editor
-- ====================================================================

-- 1. Create Guilds Table (Core settings)
CREATE TABLE IF NOT EXISTS public.guilds (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    prefix TEXT DEFAULT '!',
    language TEXT DEFAULT 'en',
    embed_color TEXT DEFAULT '5865F2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Channels Table (System channels)
CREATE TABLE IF NOT EXISTS public.guild_channels (
    guild_id TEXT PRIMARY KEY REFERENCES public.guilds(id) ON DELETE CASCADE,
    welcome_channel TEXT,
    leave_channel TEXT,
    logs_channel TEXT,
    message_logs_channel TEXT,
    voice_logs_channel TEXT,
    join_leave_logs_channel TEXT,
    ticket_category TEXT,
    ticket_logs_channel TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Roles Table (System roles)
CREATE TABLE IF NOT EXISTS public.guild_roles (
    guild_id TEXT PRIMARY KEY REFERENCES public.guilds(id) ON DELETE CASCADE,
    auto_role TEXT,
    mute_role TEXT,
    mod_role TEXT,
    admin_role TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Modules Table (Toggles for features)
CREATE TABLE IF NOT EXISTS public.guild_modules (
    guild_id TEXT PRIMARY KEY REFERENCES public.guilds(id) ON DELETE CASCADE,
    welcome_enabled BOOLEAN DEFAULT true,
    leave_enabled BOOLEAN DEFAULT true,
    logging_enabled BOOLEAN DEFAULT true,
    antiraid_enabled BOOLEAN DEFAULT false,
    automod_enabled BOOLEAN DEFAULT false,
    antilinks_enabled BOOLEAN DEFAULT false,
    antispam_enabled BOOLEAN DEFAULT false,
    antibots_enabled BOOLEAN DEFAULT false,
    antiswear_enabled BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Users Table (Global user data)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT,
    credits BIGINT DEFAULT 0,
    global_xp BIGINT DEFAULT 0,
    rep INTEGER DEFAULT 0,
    last_daily TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Members Table (Server-specific user data)
CREATE TABLE IF NOT EXISTS public.members (
    guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    xp BIGINT DEFAULT 0,
    level INTEGER DEFAULT 1,
    warnings INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
);

-- 7. Create Moderation Logs Table (Punishment history)
CREATE TABLE IF NOT EXISTS public.mod_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'ban', 'kick', 'mute', 'warn', 'unban'
    reason TEXT,
    duration TEXT, -- Only for mutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- TRIGGERS FOR AUTO-UPDATING `updated_at`
-- ====================================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_guilds_modtime ON public.guilds;
CREATE TRIGGER update_guilds_modtime BEFORE UPDATE ON public.guilds FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_guild_channels_modtime ON public.guild_channels;
CREATE TRIGGER update_guild_channels_modtime BEFORE UPDATE ON public.guild_channels FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_guild_roles_modtime ON public.guild_roles;
CREATE TRIGGER update_guild_roles_modtime BEFORE UPDATE ON public.guild_roles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_guild_modules_modtime ON public.guild_modules;
CREATE TRIGGER update_guild_modules_modtime BEFORE UPDATE ON public.guild_modules FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ====================================================================
-- RLS (Row Level Security) - Optional but good for direct API access
-- ====================================================================
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mod_logs ENABLE ROW LEVEL SECURITY;

-- Allow read/write for all (Since the Discord bot uses the service key or anon key from a trusted environment)
DROP POLICY IF EXISTS "Allow all access" ON public.guilds;
CREATE POLICY "Allow all access" ON public.guilds FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON public.guild_channels;
CREATE POLICY "Allow all access" ON public.guild_channels FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON public.guild_roles;
CREATE POLICY "Allow all access" ON public.guild_roles FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON public.guild_modules;
CREATE POLICY "Allow all access" ON public.guild_modules FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON public.users;
CREATE POLICY "Allow all access" ON public.users FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON public.members;
CREATE POLICY "Allow all access" ON public.members FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON public.mod_logs;
CREATE POLICY "Allow all access" ON public.mod_logs FOR ALL USING (true);

-- ====================================================================
-- INITIAL DATA INSERT (YOUR MAIN SERVER)
-- ====================================================================
-- Replace 'YOUR_GUILD_ID' with the actual server ID when you run this
-- or let the bot auto-create the row when it joins the server.
