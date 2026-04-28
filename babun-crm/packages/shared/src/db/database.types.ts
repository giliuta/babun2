// Database types for STORY-036.
//
// Hand-validated to match the SQL in
//   apps/web/supabase/migrations/20260427_001_init_clients.sql
//
// To regenerate from the live project (requires a Supabase Personal
// Access Token at https://supabase.com/dashboard/account/tokens, set
// as $SUPABASE_ACCESS_TOKEN), run from apps/web:
//   npm run db:types
//
// Project ref: rdtokosbqvgemicqeqwz
// URL: https://rdtokosbqvgemicqeqwz.supabase.co

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          vertical: string | null;
          owner_user_id: string | null;
          city: string | null;
          onboarded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          vertical?: string | null;
          owner_user_id?: string | null;
          city?: string | null;
          onboarded_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: [];
      };
      client_tags: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          color: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          color: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_tags"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          phone: string;
          whatsapp_phone: string;
          email: string;
          sms_name: string;
          telegram_username: string;
          instagram_username: string;
          balance: number;
          discount: number;
          comment: string;
          acquisition_source: string;
          referred_by_client_id: string | null;
          first_contact_date: string | null;
          address: string;
          city: string;
          property_type: string;
          language: string | null;
          birthday: string;
          blacklisted: boolean;
          pinned_at: string | null;
          reminder_at: string | null;
          phones: Json;
          locations: Json;
          notes: Json;
          equipment: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          full_name: string;
          phone?: string;
          whatsapp_phone?: string;
          email?: string;
          sms_name?: string;
          telegram_username?: string;
          instagram_username?: string;
          balance?: number;
          discount?: number;
          comment?: string;
          acquisition_source?: string;
          referred_by_client_id?: string | null;
          first_contact_date?: string | null;
          address?: string;
          city?: string;
          property_type?: string;
          language?: string | null;
          birthday?: string;
          blacklisted?: boolean;
          pinned_at?: string | null;
          reminder_at?: string | null;
          phones?: Json;
          locations?: Json;
          notes?: Json;
          equipment?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      client_tag_assignments: {
        Row: {
          client_id: string;
          tag_id: string;
          tenant_id: string;
        };
        Insert: {
          client_id: string;
          tag_id: string;
          tenant_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["client_tag_assignments"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
