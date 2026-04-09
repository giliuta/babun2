-- =============================================
-- Babun CRM — Initial Database Schema
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. TEAMS
-- =============================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  region TEXT,
  lead_id UUID,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 2. PROFILES (extends Supabase Auth)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'dispatcher', 'team_lead', 'technician')) DEFAULT 'technician',
  phone TEXT,
  avatar_url TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK for teams.lead_id now that profiles exists
ALTER TABLE teams ADD CONSTRAINT fk_teams_lead FOREIGN KEY (lead_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- =============================================
-- 3. CLIENTS
-- =============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone2 TEXT,
  sms_name TEXT,
  email TEXT,
  address TEXT,
  address_lat NUMERIC(10, 7),
  address_lng NUMERIC(10, 7),
  comment TEXT,
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(5, 2) NOT NULL DEFAULT 0,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_full_name ON clients(full_name);

-- =============================================
-- 4. CLIENT GROUPS
-- =============================================
CREATE TABLE client_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT
);

CREATE TABLE client_group_memberships (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES client_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, group_id)
);

-- =============================================
-- 5. SERVICES
-- =============================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('cleaning', 'installation', 'repair', 'maintenance', 'consultation', 'other')),
  duration_minutes INT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 6. APPOINTMENTS
-- =============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  address TEXT NOT NULL,
  address_lat NUMERIC(10, 7),
  address_lng NUMERIC(10, 7),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'en_route', 'in_progress', 'completed', 'cancelled', 'no_show')) DEFAULT 'scheduled',
  notes TEXT,
  client_notes TEXT,
  price NUMERIC(10, 2),
  discount NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'partial')) DEFAULT 'pending',
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')),
  color TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_team_date ON appointments(team_id, date);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_status ON appointments(status);

-- =============================================
-- 7. TRANSACTIONS
-- =============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  description TEXT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);

-- =============================================
-- 8. MESSAGES
-- =============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'telegram', 'messenger', 'sms', 'phone', 'manual')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  media_url TEXT,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'delivered',
  sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_client ON messages(client_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- =============================================
-- 9. CONVERSATIONS
-- =============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'telegram', 'messenger', 'sms', 'phone', 'manual')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unread_count INT NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'closed')),
  UNIQUE (client_id, channel)
);

CREATE INDEX idx_conversations_last_msg ON conversations(last_message_at DESC);

-- =============================================
-- 10. SMS TEMPLATES
-- =============================================
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================
-- 11. CALL LOGS
-- =============================================
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  duration_seconds INT,
  recording_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 12. TEAM LOCATIONS (Realtime GPS)
-- =============================================
CREATE TABLE team_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- AUTO-UPDATE updated_at TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'technician')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_locations ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user team_id
CREATE OR REPLACE FUNCTION get_user_team_id()
RETURNS UUID AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL USING (get_user_role() = 'admin');

-- TEAMS policies
CREATE POLICY "teams_select" ON teams FOR SELECT USING (TRUE);
CREATE POLICY "teams_admin" ON teams FOR ALL USING (get_user_role() = 'admin');

-- CLIENTS policies
CREATE POLICY "clients_select" ON clients FOR SELECT USING (
  get_user_role() IN ('admin', 'dispatcher', 'team_lead', 'technician')
);
CREATE POLICY "clients_modify" ON clients FOR ALL USING (
  get_user_role() IN ('admin', 'dispatcher')
);

-- SERVICES policies
CREATE POLICY "services_select" ON services FOR SELECT USING (TRUE);
CREATE POLICY "services_admin" ON services FOR ALL USING (get_user_role() = 'admin');

-- APPOINTMENTS policies
CREATE POLICY "appointments_select_admin_dispatcher" ON appointments FOR SELECT USING (
  get_user_role() IN ('admin', 'dispatcher')
);
CREATE POLICY "appointments_select_team" ON appointments FOR SELECT USING (
  get_user_role() IN ('team_lead', 'technician') AND team_id = get_user_team_id()
);
CREATE POLICY "appointments_modify" ON appointments FOR ALL USING (
  get_user_role() IN ('admin', 'dispatcher')
);
CREATE POLICY "appointments_update_status" ON appointments FOR UPDATE USING (
  get_user_role() IN ('team_lead', 'technician') AND team_id = get_user_team_id()
) WITH CHECK (
  get_user_role() IN ('team_lead', 'technician') AND team_id = get_user_team_id()
);

-- TRANSACTIONS policies
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (
  get_user_role() IN ('admin', 'dispatcher')
  OR (get_user_role() IN ('team_lead') AND team_id = get_user_team_id())
);
CREATE POLICY "transactions_modify" ON transactions FOR ALL USING (
  get_user_role() IN ('admin', 'dispatcher', 'team_lead')
);

-- MESSAGES policies
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  get_user_role() IN ('admin', 'dispatcher')
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'dispatcher')
);

-- CONVERSATIONS policies
CREATE POLICY "conversations_select" ON conversations FOR SELECT USING (
  get_user_role() IN ('admin', 'dispatcher')
);
CREATE POLICY "conversations_modify" ON conversations FOR ALL USING (
  get_user_role() IN ('admin', 'dispatcher')
);

-- SMS TEMPLATES policies
CREATE POLICY "sms_templates_select" ON sms_templates FOR SELECT USING (TRUE);
CREATE POLICY "sms_templates_admin" ON sms_templates FOR ALL USING (get_user_role() = 'admin');

-- CALL LOGS policies
CREATE POLICY "call_logs_select" ON call_logs FOR SELECT USING (
  get_user_role() IN ('admin', 'dispatcher') OR profile_id = auth.uid()
);
CREATE POLICY "call_logs_insert" ON call_logs FOR INSERT WITH CHECK (TRUE);

-- TEAM LOCATIONS policies
CREATE POLICY "team_locations_select" ON team_locations FOR SELECT USING (
  get_user_role() IN ('admin', 'dispatcher')
  OR profile_id = auth.uid()
);
CREATE POLICY "team_locations_upsert" ON team_locations FOR ALL USING (
  profile_id = auth.uid()
);

-- CLIENT GROUPS policies
CREATE POLICY "client_groups_select" ON client_groups FOR SELECT USING (TRUE);
CREATE POLICY "client_groups_admin" ON client_groups FOR ALL USING (get_user_role() IN ('admin', 'dispatcher'));

CREATE POLICY "client_group_memberships_select" ON client_group_memberships FOR SELECT USING (TRUE);
CREATE POLICY "client_group_memberships_modify" ON client_group_memberships FOR ALL USING (get_user_role() IN ('admin', 'dispatcher'));

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE team_locations;
