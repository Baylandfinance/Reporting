// Hand-written to match supabase/migrations/0001_init.sql, 0002_rls_policies.sql
// and 0003_seed_reference_data.sql. Once the real Supabase project exists,
// regenerate with:
//   npx supabase gen types typescript --project-id <ref> > lib/types/database.ts
// and re-check this file against the output — don't let the two drift silently.
//
// `Relationships: []` on every table is required by @supabase/postgrest-js's
// GenericTable constraint, not because these tables have no foreign keys —
// this file doesn't populate it (queries that embed related rows, e.g.
// loans(...lenders(name)), are cast with `as unknown as` in lib/reports/queries.ts
// rather than relying on Supabase's relationship-aware embedding types).

export type UserRole = "admin" | "broker" | "assistant";
export type ClientType = "owner_occupier" | "investor" | "commercial";
export type PipelineStageCategory = "lead" | "active" | "on_hold" | "settled" | "lost";
export type AuState = "vic" | "nsw" | "qld" | "sa" | "wa" | "tas" | "nt" | "act";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: UserRole;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      brokerages: {
        Row: { id: string; name: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["brokerages"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["brokerages"]["Row"]>;
        Relationships: [];
      };
      lenders: {
        Row: { id: string; name: string; is_active: boolean; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["lenders"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["lenders"]["Row"]>;
        Relationships: [];
      };
      lead_sources: {
        Row: { id: string; name: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["lead_sources"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["lead_sources"]["Row"]>;
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          id: string;
          name: string;
          category: PipelineStageCategory;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pipeline_stages"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["pipeline_stages"]["Row"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          full_name: string;
          client_type: ClientType | null;
          lead_source_id: string | null;
          referrer_name: string | null;
          owner_broker_id: string | null;
          broker_name_raw: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clients"]["Row"]> & {
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
        Relationships: [];
      };
      loans: {
        Row: {
          id: string;
          client_id: string;
          lender_id: string | null;
          brokerage_id: string | null;
          owner_broker_id: string | null;
          broker_name_raw: string | null;
          pipeline_stage_id: string | null;
          transaction_type_raw: string | null;
          property_state: AuState | null;
          loan_amount: number | null;
          interest_rate: number | null;
          loan_administrator_name: string | null;
          parabroker_name: string | null;
          processor_name: string | null;
          enquiry_date: string | null;
          quote_date: string | null;
          application_date: string | null;
          submission_date: string | null;
          conditional_approval_date: string | null;
          unconditional_approval_date: string | null;
          settlement_booked_date: string | null;
          settlement_date: string | null;
          comment: string | null;
          source_row_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["loans"]["Row"]> & {
          client_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["loans"]["Row"]>;
        Relationships: [];
      };
      loan_commissions: {
        Row: {
          id: string;
          loan_id: string;
          commission_received_date: string | null;
          upfront_commission: number | null;
          trail_commission: number | null;
          referral_upfront_split_pct: number | null;
          referral_trail_split_pct: number | null;
          broker_upfront_commission: number | null;
          broker_trail_commission: number | null;
          referral_upfront_commission: number | null;
          referral_trail_commission: number | null;
          commission_payment_date: string | null;
          referral_commission_payment_date: string | null;
          clawback_amount: number | null;
          clawback_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["loan_commissions"]["Row"]> & {
          loan_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["loan_commissions"]["Row"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Record<string, unknown>;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_log"]["Row"]> & {
          action: string;
          resource_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Row"]>;
        Relationships: [];
      };
      graph_connections: {
        Row: {
          id: string;
          connected_by: string;
          tenant_id: string;
          drive_id: string | null;
          drive_item_id: string | null;
          file_name: string | null;
          worksheet_names: string[];
          encrypted_refresh_token: string;
          token_iv: string;
          token_auth_tag: string;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["graph_connections"]["Row"]> & {
          connected_by: string;
          tenant_id: string;
          encrypted_refresh_token: string;
          token_iv: string;
          token_auth_tag: string;
        };
        Update: Partial<Database["public"]["Tables"]["graph_connections"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
