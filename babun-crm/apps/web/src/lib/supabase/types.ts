// Hand-written Database type. When the Supabase project is live,
// replace this file with the output of:
//
//   npx supabase gen types typescript --linked --schema=public
//
// Keeping a hand-written copy here lets the rest of the codebase
// compile before the project exists and documents the intended shape
// of each table in one place.

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
          slug: string;
          plan: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
      };

      users: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string | null;
          role: "owner" | "admin" | "dispatcher" | "lead" | "helper";
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          email: string;
          full_name?: string | null;
          role?: "owner" | "admin" | "dispatcher" | "lead" | "helper";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };

      masters: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          team_id: string | null;
          role: "admin" | "dispatcher" | "lead" | "helper";
          is_active: boolean;
          permissions: Json;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["masters"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["masters"]["Insert"]>;
      };

      teams: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          region: string | null;
          color: string;
          default_city: string | null;
          lead_id: string | null;
          helper_ids: string[];
          payout_percentage: number;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["teams"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
      };

      team_schedules: {
        Row: {
          id: string;
          tenant_id: string;
          team_id: string;
          schedule: Json;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["team_schedules"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["team_schedules"]["Insert"]>;
      };

      clients: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          phone: string | null;
          phones: Json;
          whatsapp_phone: string | null;
          email: string | null;
          sms_name: string | null;
          telegram_username: string | null;
          instagram_username: string | null;
          balance: number;
          discount: number;
          comment: string | null;
          tag_ids: string[];
          acquisition_source: string;
          referred_by_client_id: string | null;
          first_contact_date: string | null;
          address: string | null;
          city: string | null;
          property_type: string | null;
          equipment: Json;
          locations: Json;
          notes: Json;
          birthday: string | null;
          blacklisted: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["clients"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
      };

      client_tags: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["client_tags"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["client_tags"]["Insert"]>;
      };

      service_categories: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          color: string | null;
          sort: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["service_categories"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["service_categories"]["Insert"]>;
      };

      services: {
        Row: {
          id: string;
          tenant_id: string;
          category_id: string | null;
          name: string;
          duration_minutes: number;
          price: number;
          color: string | null;
          available_weekdays: number[];
          online_enabled: boolean;
          material_costs: Json;
          is_active: boolean;
          bulk_threshold: number;
          bulk_price: number;
          cost_per_unit: number;
          is_countable: boolean;
          brigade_ids: string[];
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["services"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
      };

      appointments: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string | null;
          location_id: string | null;
          team_id: string | null;
          service_ids: string[];
          date: string;
          time_start: string;
          time_end: string;
          total_amount: number;
          custom_total: boolean;
          discount_amount: number;
          prepaid_amount: number;
          services: Json;
          global_discount: Json | null;
          service_price_overrides: Json;
          expenses: Json;
          payments: Json;
          payment: Json | null;
          total_duration: number;
          color_override: string | null;
          comment: string | null;
          address: string | null;
          address_note: string | null;
          address_lat: number | null;
          address_lng: number | null;
          source: string | null;
          is_online_booking: boolean;
          kind: "work" | "event" | "personal";
          status: "scheduled" | "in_progress" | "completed" | "cancelled";
          photos: Json;
          consent_given: boolean;
          reminder_enabled: boolean;
          reminder_offsets: number[];
          reminder_template: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["appointments"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
      };

      sms_templates: {
        Row: {
          id: string;
          tenant_id: string;
          kind: string;
          name: string;
          body: string;
          enabled: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["sms_templates"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["sms_templates"]["Insert"]>;
      };

      expense_categories: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          icon: string | null;
          color: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["expense_categories"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["expense_categories"]["Insert"]>;
      };

      ledger_entries: {
        Row: {
          id: string;
          tenant_id: string;
          kind: "expense" | "payment" | "payout" | "day_extra" | "day_city";
          team_id: string | null;
          date: string;
          amount: number;
          payload: Json;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["ledger_entries"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["ledger_entries"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      tenant_id: { Args: Record<string, never>; Returns: string };
      is_tenant_owner: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
}
