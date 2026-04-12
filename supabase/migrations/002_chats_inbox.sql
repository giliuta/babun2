-- Babun CRM — Chats / Unified Inbox schema
-- This migration is saved for future use when we migrate from
-- localStorage to Supabase. NOT applied yet — requires tenants
-- and clients tables to exist first (see STORY-001).

-- Connected messaging channels per tenant
CREATE TABLE IF NOT EXISTS channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'telegram', 'sms', 'webchat')),
  channel_name TEXT,
  credentials JSONB NOT NULL DEFAULT '{}',
  webhook_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel)
);

ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON channel_connections
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Conversations (one per contact per channel)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'telegram', 'sms', 'webchat')),
  contact_name TEXT,
  contact_avatar_url TEXT,
  contact_channel_id TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'waiting', 'closed', 'archived')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  unread_count INT NOT NULL DEFAULT 0,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel, contact_channel_id)
);

CREATE INDEX idx_conversations_tenant_last_msg ON conversations (tenant_id, last_message_at DESC);
CREATE INDEX idx_conversations_client ON conversations (client_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON conversations
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'audio', 'video', 'location', 'sticker', 'system')),
  content_text TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  channel_message_id TEXT,
  reply_to_message_id UUID REFERENCES messages(id),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_details TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, sent_at);
CREATE INDEX idx_messages_tenant ON messages (tenant_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON messages
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
