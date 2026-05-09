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
          // STORY-039 — owner_user_id column dropped. Ownership now
          // lives in public.tenant_members(role='owner').
          city: string | null;
          onboarded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          vertical?: string | null;
          city?: string | null;
          onboarded_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: [];
      };
      // STORY-039 — N-to-N membership replacing tenants.owner_user_id.
      // Three roles via CHECK: 'owner' | 'dispatcher' | 'master'.
      tenant_members: {
        Row: {
          tenant_id: string;
          user_id: string;
          role: string;
          invited_by_user_id: string | null;
          joined_at: string;
          metadata: Json;
        };
        Insert: {
          tenant_id: string;
          user_id: string;
          role: string;
          invited_by_user_id?: string | null;
          joined_at?: string;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["tenant_members"]["Insert"]>;
        Relationships: [];
      };
      // STORY-039 — email-based invitations with 7-day TTL,
      // one-time-use semantics enforced by accept_invitation() RPC.
      invitations: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: string;
          invited_by_user_id: string | null;
          token: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          role: string;
          invited_by_user_id?: string | null;
          token: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
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
      // STORY-042 — appointments table; mirrors the local TS Appointment
      // shape from @babun/shared/local/appointments. Nested arrays/objects
      // are jsonb (decision A1). master_id / team_id stay as text until
      // those tables migrate (decision A8).
      appointments: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string | null;
          team_id: string | null;
          master_id: string | null;
          location_id: string | null;
          date: string;
          time_start: string;
          time_end: string;
          kind: string;
          status: string;
          total_amount: number;
          custom_total: boolean;
          discount_amount: number;
          prepaid_amount: number;
          comment: string;
          address: string;
          address_note: string;
          address_lat: number | null;
          address_lng: number | null;
          cancel_reason: string | null;
          source: string | null;
          is_online_booking: boolean;
          consent_given: boolean;
          color_override: string | null;
          reminder_enabled: boolean;
          reminder_offsets: Json;
          reminder_template: string;
          service_ids: Json;
          services: Json;
          service_price_overrides: Json;
          expenses: Json;
          payments: Json;
          payment: Json | null;
          // STORY-049 — `photos` jsonb column dropped; photos now live
          // in public.appointment_photos with blobs in Supabase Storage.
          global_discount: Json | null;
          total_duration: number;
          // STORY-055 — author of the row, fk → auth.users(id). The
          // BEFORE INSERT trigger fills it from auth.uid() so client
          // code never needs to send it. Drives RLS for personal
          // events (kind='event'/'personal').
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id?: string | null;
          team_id?: string | null;
          master_id?: string | null;
          location_id?: string | null;
          date: string;
          time_start: string;
          time_end: string;
          kind?: string;
          status?: string;
          total_amount?: number;
          custom_total?: boolean;
          discount_amount?: number;
          prepaid_amount?: number;
          comment?: string;
          address?: string;
          address_note?: string;
          address_lat?: number | null;
          address_lng?: number | null;
          cancel_reason?: string | null;
          source?: string | null;
          is_online_booking?: boolean;
          consent_given?: boolean;
          color_override?: string | null;
          reminder_enabled?: boolean;
          reminder_offsets?: Json;
          reminder_template?: string;
          service_ids?: Json;
          services?: Json;
          service_price_overrides?: Json;
          expenses?: Json;
          payments?: Json;
          payment?: Json | null;
          global_discount?: Json | null;
          total_duration?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [];
      };
      // STORY-049 — separate table for appointment photos (blobs go to
      // Supabase Storage; the table stores metadata + storage_path).
      appointment_photos: {
        Row: {
          id: string;
          appointment_id: string;
          tenant_id: string;
          storage_path: string;
          kind: string;
          caption: string;
          location_id: string | null;
          taken_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          tenant_id: string;
          storage_path: string;
          kind?: string;
          caption?: string;
          location_id?: string | null;
          taken_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointment_photos"]["Insert"]>;
        Relationships: [];
      };
      // STORY-044 — schedule + calendar settings + day-cities + day-extras.
      // Closes the localStorage state that affects calendar rendering.
      // team_schedules: jsonb-heavy, one row per (tenant, team).
      team_schedules: {
        Row: {
          id: string;
          tenant_id: string;
          team_id: string;
          schedule: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          team_id: string;
          schedule?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_schedules"]["Insert"]>;
        Relationships: [];
      };
      // calendar_settings: singleton per tenant (PRIMARY KEY = tenant_id).
      calendar_settings: {
        Row: {
          tenant_id: string;
          start_hour: number;
          end_hour: number;
          grid_step: number;
          week_start: string;
          timezone: string;
          buffer_minutes: number;
          hide_cancelled: boolean;
          allow_overtime: boolean;
          // v449 — added by 20260507_001_calendar_settings_work_hours.
          // Nullable in TS so older clients reading rows from a DB
          // that has not run the migration still typecheck.
          work_start_hour: number | null;
          work_end_hour: number | null;
          scroll_open_hour: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          start_hour?: number;
          end_hour?: number;
          grid_step?: number;
          week_start?: string;
          timezone?: string;
          buffer_minutes?: number;
          hide_cancelled?: boolean;
          allow_overtime?: boolean;
          work_start_hour?: number | null;
          work_end_hour?: number | null;
          scroll_open_hour?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_settings"]["Insert"]>;
        Relationships: [];
      };
      // day_cities: PK = (tenant, team, date). Composite, no synthetic id.
      day_cities: {
        Row: {
          tenant_id: string;
          team_id: string;
          date: string;
          city: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          team_id: string;
          date: string;
          city: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["day_cities"]["Insert"]>;
        Relationships: [];
      };
      // day_extras: one row per line item (id is its own PK).
      day_extras: {
        Row: {
          id: string;
          tenant_id: string;
          team_id: string;
          date: string;
          name: string;
          amount: number;
          kind: string;
          category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          team_id: string;
          date: string;
          name: string;
          amount: number;
          kind: string;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["day_extras"]["Insert"]>;
        Relationships: [];
      };
      // STORY-056 — custom event presets for the unified EventSheet.
      // Per-user privacy via RLS on `created_by = auth.uid()`. The
      // BEFORE INSERT trigger fills `created_by` from auth.uid(); TS
      // never sends it explicitly.
      event_templates: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          emoji: string | null;
          color: string;
          duration_min: number;
          push_offset_min: number | null;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          emoji?: string | null;
          color: string;
          duration_min: number;
          push_offset_min?: number | null;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_templates"]["Insert"]>;
        Relationships: [];
      };
      // STORY-050 — recurring HVAC follow-up reminders ("call back in
      // 6 months for next seasonal cleaning"). Lift-and-shift of the
      // localStorage RecurringReminder model; not an RRULE engine.
      recurring_reminders: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string | null;
          client_name: string;
          phone: string;
          team_id: string | null;
          service_ids: Json;
          service_summary: string;
          last_date: string;
          next_due_date: string;
          interval_months: number;
          status: string;
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id?: string | null;
          client_name: string;
          phone?: string;
          team_id?: string | null;
          service_ids?: Json;
          service_summary?: string;
          last_date: string;
          next_due_date: string;
          interval_months: number;
          status?: string;
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recurring_reminders"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    // STORY-044 — public.import_schedule RPC. Atomic per-tenant import
    // of all four schedule entities; SECURITY INVOKER + RLS-scoped.
    Functions: {
      import_schedule: {
        Args: {
          p_schedules?: Json;
          p_calendar_settings?: Json | null;
          p_day_cities?: Json;
          p_day_extras?: Json;
        };
        Returns: void;
      };
      // STORY-039 — SECURITY DEFINER entry point for the
      // /invite/[token] accept flow. Returns the tenant_id joined.
      accept_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      current_tenant_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
