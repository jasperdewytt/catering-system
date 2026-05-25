export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          session_id: string;
          source_file: string | null;
          source_row: Json | null;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          session_id: string;
          source_file?: string | null;
          source_row?: Json | null;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          session_id?: string;
          source_file?: string | null;
          source_row?: Json | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "absences_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "absences_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "absences_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "absences_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absences_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "absences_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "absences_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "absences_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_name: string;
          after_state: Json;
          before_state: Json;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          order_run_id: string | null;
          reason: string;
        };
        Insert: {
          action: string;
          actor_name: string;
          after_state?: Json;
          before_state?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          order_run_id?: string | null;
          reason: string;
        };
        Update: {
          action?: string;
          actor_name?: string;
          after_state?: Json;
          before_state?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          order_run_id?: string | null;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      caterer_contacts: {
        Row: {
          caterer_id: string;
          cc_preference: Database["public"]["Enums"]["cc_preference"];
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          is_verified: boolean;
          role: Database["public"]["Enums"]["contact_role"];
          role_note: string | null;
          source_file: string | null;
          source_row: Json | null;
          updated_at: string;
        };
        Insert: {
          caterer_id: string;
          cc_preference?: Database["public"]["Enums"]["cc_preference"];
          created_at?: string;
          display_name: string;
          email?: string | null;
          id?: string;
          is_verified?: boolean;
          role: Database["public"]["Enums"]["contact_role"];
          role_note?: string | null;
          source_file?: string | null;
          source_row?: Json | null;
          updated_at?: string;
        };
        Update: {
          caterer_id?: string;
          cc_preference?: Database["public"]["Enums"]["cc_preference"];
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id?: string;
          is_verified?: boolean;
          role?: Database["public"]["Enums"]["contact_role"];
          role_note?: string | null;
          source_file?: string | null;
          source_row?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "caterers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterer_detail";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["caterer_id"];
          },
        ];
      };
      caterer_weekly_minimums: {
        Row: {
          caterer_id: string;
          created_at: string;
          menu_item_count: number;
          minimum_meals: number;
          updated_at: string;
        };
        Insert: {
          caterer_id: string;
          created_at?: string;
          menu_item_count: number;
          minimum_meals: number;
          updated_at?: string;
        };
        Update: {
          caterer_id?: string;
          created_at?: string;
          menu_item_count?: number;
          minimum_meals?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "caterers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterer_detail";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["caterer_id"];
          },
        ];
      };
      caterers: {
        Row: {
          created_at: string;
          delivery_fee_cents: number;
          delivery_notes: string | null;
          delivery_scope: string;
          gst_inclusive: boolean;
          gst_rate_bps: number;
          id: string;
          name: string;
          per_item_price_cents: number;
          region: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          delivery_fee_cents?: number;
          delivery_notes?: string | null;
          delivery_scope: string;
          gst_inclusive: boolean;
          gst_rate_bps?: number;
          id?: string;
          name: string;
          per_item_price_cents: number;
          region?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          delivery_fee_cents?: number;
          delivery_notes?: string | null;
          delivery_scope?: string;
          gst_inclusive?: boolean;
          gst_rate_bps?: number;
          id?: string;
          name?: string;
          per_item_price_cents?: number;
          region?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      dietary_tags: {
        Row: {
          code: string;
          created_at: string;
          description: string;
          kind: Database["public"]["Enums"]["dietary_tag_kind"];
        };
        Insert: {
          code: string;
          created_at?: string;
          description: string;
          kind: Database["public"]["Enums"]["dietary_tag_kind"];
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string;
          kind?: Database["public"]["Enums"]["dietary_tag_kind"];
        };
        Relationships: [];
      };
      dish_variants: {
        Row: {
          contains_beef: boolean;
          contains_fish: boolean;
          contains_pork: boolean;
          contains_red_meat: boolean;
          contains_shellfish: boolean;
          created_at: string;
          dish_id: string;
          has_no_declared_tags: boolean;
          id: string;
          ingredient_flags_source: string;
          ingredient_notes: string | null;
          is_available: boolean;
          is_dairy_free: boolean;
          is_default: boolean;
          is_gluten_free: boolean;
          is_halal_inferred: boolean;
          is_nut_free: boolean;
          is_vegetarian_option: boolean;
          name: string;
          tags_review_reason: string | null;
          tags_reviewed_at: string | null;
          tags_reviewed_by: string | null;
          updated_at: string;
        };
        Insert: {
          contains_beef?: boolean;
          contains_fish?: boolean;
          contains_pork?: boolean;
          contains_red_meat?: boolean;
          contains_shellfish?: boolean;
          created_at?: string;
          dish_id: string;
          has_no_declared_tags?: boolean;
          id?: string;
          ingredient_flags_source?: string;
          ingredient_notes?: string | null;
          is_available?: boolean;
          is_dairy_free?: boolean;
          is_default?: boolean;
          is_gluten_free?: boolean;
          is_halal_inferred?: boolean;
          is_nut_free?: boolean;
          is_vegetarian_option?: boolean;
          name: string;
          tags_review_reason?: string | null;
          tags_reviewed_at?: string | null;
          tags_reviewed_by?: string | null;
          updated_at?: string;
        };
        Update: {
          contains_beef?: boolean;
          contains_fish?: boolean;
          contains_pork?: boolean;
          contains_red_meat?: boolean;
          contains_shellfish?: boolean;
          created_at?: string;
          dish_id?: string;
          has_no_declared_tags?: boolean;
          id?: string;
          ingredient_flags_source?: string;
          ingredient_notes?: string | null;
          is_available?: boolean;
          is_dairy_free?: boolean;
          is_default?: boolean;
          is_gluten_free?: boolean;
          is_halal_inferred?: boolean;
          is_nut_free?: boolean;
          is_vegetarian_option?: boolean;
          name?: string;
          tags_review_reason?: string | null;
          tags_reviewed_at?: string | null;
          tags_reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dish_variants_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dish_variants_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["dish_id"];
          },
        ];
      };
      dishes: {
        Row: {
          caterer_id: string;
          contains_beef: boolean;
          contains_fish: boolean;
          contains_pork: boolean;
          contains_red_meat: boolean;
          contains_shellfish: boolean;
          created_at: string;
          halal_inference_note: string | null;
          has_no_declared_tags: boolean;
          id: string;
          ingredient_flags_source: string;
          ingredient_notes: string | null;
          is_dairy_free: boolean;
          is_gluten_free: boolean;
          is_halal_inferred: boolean;
          is_nut_free: boolean;
          is_vegetarian_option: boolean;
          name: string;
          name_raw: string;
          source_file: string | null;
          source_row: Json | null;
          tags_review_reason: string | null;
          tags_reviewed_at: string | null;
          tags_reviewed_by: string | null;
          updated_at: string;
        };
        Insert: {
          caterer_id: string;
          contains_beef?: boolean;
          contains_fish?: boolean;
          contains_pork?: boolean;
          contains_red_meat?: boolean;
          contains_shellfish?: boolean;
          created_at?: string;
          halal_inference_note?: string | null;
          has_no_declared_tags?: boolean;
          id?: string;
          ingredient_flags_source?: string;
          ingredient_notes?: string | null;
          is_dairy_free?: boolean;
          is_gluten_free?: boolean;
          is_halal_inferred: boolean;
          is_nut_free?: boolean;
          is_vegetarian_option?: boolean;
          name: string;
          name_raw: string;
          source_file?: string | null;
          source_row?: Json | null;
          tags_review_reason?: string | null;
          tags_reviewed_at?: string | null;
          tags_reviewed_by?: string | null;
          updated_at?: string;
        };
        Update: {
          caterer_id?: string;
          contains_beef?: boolean;
          contains_fish?: boolean;
          contains_pork?: boolean;
          contains_red_meat?: boolean;
          contains_shellfish?: boolean;
          created_at?: string;
          halal_inference_note?: string | null;
          has_no_declared_tags?: boolean;
          id?: string;
          ingredient_flags_source?: string;
          ingredient_notes?: string | null;
          is_dairy_free?: boolean;
          is_gluten_free?: boolean;
          is_halal_inferred?: boolean;
          is_nut_free?: boolean;
          is_vegetarian_option?: boolean;
          name?: string;
          name_raw?: string;
          source_file?: string | null;
          source_row?: Json | null;
          tags_review_reason?: string | null;
          tags_reviewed_at?: string | null;
          tags_reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dishes_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "caterers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterer_detail";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["caterer_id"];
          },
        ];
      };
      exclusions: {
        Row: {
          created_at: string;
          excluded_year_levels: number[];
          id: string;
          reason: string | null;
          session_id: string;
          source_file: string | null;
          source_row: Json | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          excluded_year_levels: number[];
          id?: string;
          reason?: string | null;
          session_id: string;
          source_file?: string | null;
          source_row?: Json | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          excluded_year_levels?: number[];
          id?: string;
          reason?: string | null;
          session_id?: string;
          source_file?: string | null;
          source_row?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exclusions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "exclusions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "exclusions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "exclusions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      manual_overrides: {
        Row: {
          actor_name: string;
          after_state: Json;
          before_state: Json;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          order_run_id: string;
          override_type: string;
          reason: string;
        };
        Insert: {
          actor_name: string;
          after_state?: Json;
          before_state?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          order_run_id: string;
          override_type: string;
          reason: string;
        };
        Update: {
          actor_name?: string;
          after_state?: Json;
          before_state?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          order_run_id?: string;
          override_type?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_offers: {
        Row: {
          created_at: string;
          dish_id: string;
          dish_variant_id: string;
          id: string;
          notes: string | null;
          selected_at: string;
          selected_by: string | null;
          service_week_start: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dish_id: string;
          dish_variant_id: string;
          id?: string;
          notes?: string | null;
          selected_at?: string;
          selected_by?: string | null;
          service_week_start: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dish_id?: string;
          dish_variant_id?: string;
          id?: string;
          notes?: string | null;
          selected_at?: string;
          selected_by?: string | null;
          service_week_start?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_offers_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_offers_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["dish_id"];
          },
          {
            foreignKeyName: "menu_offers_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "dish_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_offers_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "menu_offers_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "menu_offers_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["dish_variant_id"];
          },
        ];
      };
      operators: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_allocation_issues: {
        Row: {
          code: string;
          created_at: string;
          details: Json;
          dish_id: string | null;
          dish_variant_id: string | null;
          id: string;
          message: string;
          order_run_id: string;
          session_id: string | null;
          severity: string;
          student_id: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          details?: Json;
          dish_id?: string | null;
          dish_variant_id?: string | null;
          id?: string;
          message: string;
          order_run_id: string;
          session_id?: string | null;
          severity: string;
          student_id?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          details?: Json;
          dish_id?: string | null;
          dish_variant_id?: string | null;
          id?: string;
          message?: string;
          order_run_id?: string;
          session_id?: string | null;
          severity?: string;
          student_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_allocation_issues_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocation_issues_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["dish_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "dish_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      order_allocations: {
        Row: {
          created_at: string;
          dietary_tag_codes: string[];
          dish_id: string | null;
          dish_variant_id: string | null;
          id: string;
          order_run_id: string;
          reason_codes: string[];
          session_id: string;
          status: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dietary_tag_codes?: string[];
          dish_id?: string | null;
          dish_variant_id?: string | null;
          id?: string;
          order_run_id: string;
          reason_codes?: string[];
          session_id: string;
          status: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dietary_tag_codes?: string[];
          dish_id?: string | null;
          dish_variant_id?: string | null;
          id?: string;
          order_run_id?: string;
          reason_codes?: string[];
          session_id?: string;
          status?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_allocations_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocations_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["dish_id"];
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "dish_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      order_communication_events: {
        Row: {
          actor_name: string;
          communication_id: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          reason: string;
        };
        Insert: {
          actor_name: string;
          communication_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          reason: string;
        };
        Update: {
          actor_name?: string;
          communication_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_communication_events_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_communication_id"];
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_communication_recipients";
            referencedColumns: ["communication_id"];
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["communication_id"];
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "order_communications";
            referencedColumns: ["id"];
          },
        ];
      };
      order_communication_recipients: {
        Row: {
          caterer_contact_id: string | null;
          cc_preference: string | null;
          communication_id: string;
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          recipient_type: string;
          role: string | null;
        };
        Insert: {
          caterer_contact_id?: string | null;
          cc_preference?: string | null;
          communication_id: string;
          created_at?: string;
          display_name?: string | null;
          email: string;
          id?: string;
          recipient_type: string;
          role?: string | null;
        };
        Update: {
          caterer_contact_id?: string | null;
          cc_preference?: string | null;
          communication_id?: string;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          recipient_type?: string;
          role?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_communication_recipients_caterer_contact_id_fkey";
            columns: ["caterer_contact_id"];
            isOneToOne: false;
            referencedRelation: "caterer_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_communication_recipients_caterer_contact_id_fkey";
            columns: ["caterer_contact_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["contact_id"];
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_communication_id"];
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_communication_recipients";
            referencedColumns: ["communication_id"];
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["communication_id"];
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "order_communications";
            referencedColumns: ["id"];
          },
        ];
      };
      order_communications: {
        Row: {
          body: string;
          caterer_id: string;
          created_at: string;
          created_by: string;
          delivery_note_text: string;
          exported_at: string;
          exported_by: string;
          id: string;
          order_run_id: string;
          rendered_text: string;
          status: string;
          subject: string;
          template_version: string;
        };
        Insert: {
          body: string;
          caterer_id: string;
          created_at?: string;
          created_by: string;
          delivery_note_text: string;
          exported_at?: string;
          exported_by: string;
          id?: string;
          order_run_id: string;
          rendered_text: string;
          status?: string;
          subject: string;
          template_version: string;
        };
        Update: {
          body?: string;
          caterer_id?: string;
          created_at?: string;
          created_by?: string;
          delivery_note_text?: string;
          exported_at?: string;
          exported_by?: string;
          id?: string;
          order_run_id?: string;
          rendered_text?: string;
          status?: string;
          subject?: string;
          template_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "caterers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterer_detail";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      order_lines: {
        Row: {
          created_at: string;
          dish_id: string;
          dish_variant_id: string;
          gst_inclusive: boolean;
          id: string;
          line_total_cents: number;
          order_run_id: string;
          quantity: number;
          session_id: string;
          unit_price_cents: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dish_id: string;
          dish_variant_id: string;
          gst_inclusive: boolean;
          id?: string;
          line_total_cents: number;
          order_run_id: string;
          quantity: number;
          session_id: string;
          unit_price_cents: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dish_id?: string;
          dish_variant_id?: string;
          gst_inclusive?: boolean;
          id?: string;
          line_total_cents?: number;
          order_run_id?: string;
          quantity?: number;
          session_id?: string;
          unit_price_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_lines_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["dish_id"];
          },
          {
            foreignKeyName: "order_lines_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "dish_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "order_lines_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "order_lines_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_lines_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_lines_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_lines_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      order_runs: {
        Row: {
          algorithm_version: string;
          approval_note: string | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          generated_at: string;
          generated_by: string | null;
          id: string;
          input_snapshot: Json;
          issue_count: number;
          service_week_end: string;
          service_week_start: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          algorithm_version?: string;
          approval_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          input_snapshot?: Json;
          issue_count?: number;
          service_week_end: string;
          service_week_start: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          algorithm_version?: string;
          approval_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          input_snapshot?: Json;
          issue_count?: number;
          service_week_end?: string;
          service_week_start?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_aliases: {
        Row: {
          alias: string;
          created_at: string;
          id: string;
          school_id: string;
          source: string | null;
        };
        Insert: {
          alias: string;
          created_at?: string;
          id?: string;
          school_id: string;
          source?: string | null;
        };
        Update: {
          alias?: string;
          created_at?: string;
          id?: string;
          school_id?: string;
          source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_aliases_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "school_aliases_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          canonical_name: string;
          created_at: string;
          id: string;
          region: string | null;
          short_code: string;
          updated_at: string;
        };
        Insert: {
          canonical_name: string;
          created_at?: string;
          id?: string;
          region?: string | null;
          short_code: string;
          updated_at?: string;
        };
        Update: {
          canonical_name?: string;
          created_at?: string;
          id?: string;
          region?: string | null;
          short_code?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_enrolments: {
        Row: {
          created_at: string;
          session_id: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          session_id: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          session_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_enrolments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "session_enrolments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "session_enrolments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "session_enrolments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_enrolments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "session_enrolments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "session_enrolments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "session_enrolments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          building: string | null;
          caterer_id: string;
          created_at: string;
          dinner_time: string | null;
          dinner_time_raw: string | null;
          end_time: string | null;
          end_time_raw: string | null;
          id: string;
          manager_mobile: string | null;
          manager_name: string | null;
          room: string | null;
          school_id: string;
          session_date: string;
          start_time: string | null;
          start_time_raw: string | null;
          updated_at: string;
          year_levels: number[];
        };
        Insert: {
          building?: string | null;
          caterer_id: string;
          created_at?: string;
          dinner_time?: string | null;
          dinner_time_raw?: string | null;
          end_time?: string | null;
          end_time_raw?: string | null;
          id?: string;
          manager_mobile?: string | null;
          manager_name?: string | null;
          room?: string | null;
          school_id: string;
          session_date: string;
          start_time?: string | null;
          start_time_raw?: string | null;
          updated_at?: string;
          year_levels: number[];
        };
        Update: {
          building?: string | null;
          caterer_id?: string;
          created_at?: string;
          dinner_time?: string | null;
          dinner_time_raw?: string | null;
          end_time?: string | null;
          end_time_raw?: string | null;
          id?: string;
          manager_mobile?: string | null;
          manager_name?: string | null;
          room?: string | null;
          school_id?: string;
          session_date?: string;
          start_time?: string | null;
          start_time_raw?: string | null;
          updated_at?: string;
          year_levels?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "sessions_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "caterers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterer_detail";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "sessions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "sessions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      student_dietary_tags: {
        Row: {
          created_at: string;
          student_id: string;
          tag_code: string;
        };
        Insert: {
          created_at?: string;
          student_id: string;
          tag_code: string;
        };
        Update: {
          created_at?: string;
          student_id?: string;
          tag_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_dietary_tags_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_dietary_tags_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_dietary_tags_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_dietary_tags_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_dietary_tags_tag_code_fkey";
            columns: ["tag_code"];
            isOneToOne: false;
            referencedRelation: "dietary_tags";
            referencedColumns: ["code"];
          },
        ];
      };
      student_dietary_warnings: {
        Row: {
          created_at: string;
          id: string;
          raw_value: string;
          resolved_at: string | null;
          resolved_note: string | null;
          resolved_tag_codes: string[] | null;
          status: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          raw_value: string;
          resolved_at?: string | null;
          resolved_note?: string | null;
          resolved_tag_codes?: string[] | null;
          status?: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          raw_value?: string;
          resolved_at?: string | null;
          resolved_note?: string | null;
          resolved_tag_codes?: string[] | null;
          status?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_dietary_warnings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_dietary_warnings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_dietary_warnings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_dietary_warnings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          created_at: string;
          dietary_raw: string | null;
          full_name: string;
          id: string;
          opted_out: boolean;
          parent_email: string | null;
          parent_mobile: string | null;
          parent_name: string | null;
          school_id: string;
          source_file: string | null;
          source_row: Json | null;
          student_email: string | null;
          subjects_raw: string | null;
          updated_at: string;
          year_level: number;
        };
        Insert: {
          created_at?: string;
          dietary_raw?: string | null;
          full_name: string;
          id?: string;
          opted_out?: boolean;
          parent_email?: string | null;
          parent_mobile?: string | null;
          parent_name?: string | null;
          school_id: string;
          source_file?: string | null;
          source_row?: Json | null;
          student_email?: string | null;
          subjects_raw?: string | null;
          updated_at?: string;
          year_level: number;
        };
        Update: {
          created_at?: string;
          dietary_raw?: string | null;
          full_name?: string;
          id?: string;
          opted_out?: boolean;
          parent_email?: string | null;
          parent_mobile?: string | null;
          parent_name?: string | null;
          school_id?: string;
          source_file?: string | null;
          source_row?: Json | null;
          student_email?: string | null;
          subjects_raw?: string | null;
          updated_at?: string;
          year_level?: number;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      operator_audit_events: {
        Row: {
          action: string | null;
          actor_name: string | null;
          after_state: Json | null;
          audit_id: string | null;
          before_state: Json | null;
          created_at: string | null;
          display_action: string | null;
          entity_id: string | null;
          entity_type: string | null;
          order_run_id: string | null;
          reason: string | null;
        };
        Insert: {
          action?: string | null;
          actor_name?: string | null;
          after_state?: Json | null;
          audit_id?: string | null;
          before_state?: Json | null;
          created_at?: string | null;
          display_action?: never;
          entity_id?: string | null;
          entity_type?: string | null;
          order_run_id?: string | null;
          reason?: string | null;
        };
        Update: {
          action?: string | null;
          actor_name?: string | null;
          after_state?: Json | null;
          audit_id?: string | null;
          before_state?: Json | null;
          created_at?: string | null;
          display_action?: never;
          entity_id?: string | null;
          entity_type?: string | null;
          order_run_id?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_caterer_detail: {
        Row: {
          assigned_school_count: number | null;
          assigned_schools: Json | null;
          available_variant_count: number | null;
          caterer_id: string | null;
          caterer_name: string | null;
          contact_count: number | null;
          contacts: Json | null;
          delivery_fee: number | null;
          delivery_notes: string | null;
          delivery_scope: string | null;
          dish_count: number | null;
          gst_inclusive: boolean | null;
          gst_rate_percent: number | null;
          latest_communication: Json | null;
          latest_order_lines: Json | null;
          latest_order_totals: Json | null;
          menu_summary: Json | null;
          per_item_price: number | null;
          region: string | null;
          reviewed_variant_count: number | null;
          unreviewed_variant_count: number | null;
          variant_count: number | null;
          weekly_minimums: Json | null;
        };
        Relationships: [];
      };
      operator_caterers: {
        Row: {
          assigned_school_count: number | null;
          assigned_school_names: string[] | null;
          available_variant_count: number | null;
          caterer_id: string | null;
          caterer_name: string | null;
          communication_event_count: number | null;
          contact_count: number | null;
          delivery_fee: number | null;
          delivery_notes: string | null;
          delivery_scope: string | null;
          dish_count: number | null;
          email_state: string | null;
          exported_at: string | null;
          exported_by: string | null;
          gst_inclusive: boolean | null;
          gst_rate_percent: number | null;
          latest_communication_event_at: string | null;
          latest_communication_id: string | null;
          latest_order_line_count: number | null;
          latest_order_quantity: number | null;
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
          latest_order_total: number | null;
          latest_order_week_start: string | null;
          per_item_price: number | null;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          primary_contact_role: string | null;
          region: string | null;
          reviewed_variant_count: number | null;
          unreviewed_variant_count: number | null;
          valid_offer_counts: number[] | null;
          variant_count: number | null;
          weekly_minimum_tiers: Json | null;
        };
        Relationships: [];
      };
      operator_communication_events: {
        Row: {
          actor_name: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
          communication_id: string | null;
          created_at: string | null;
          event_id: string | null;
          event_type: string | null;
          metadata: Json | null;
          order_run_id: string | null;
          reason: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_communication_events_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_communication_id"];
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_communication_recipients";
            referencedColumns: ["communication_id"];
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["communication_id"];
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey";
            columns: ["communication_id"];
            isOneToOne: false;
            referencedRelation: "order_communications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "caterers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterer_detail";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_communication_recipients: {
        Row: {
          caterer_contact_id: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
          cc_preference: string | null;
          communication_id: string | null;
          created_at: string | null;
          display_name: string | null;
          email: string | null;
          order_run_id: string | null;
          recipient_id: string | null;
          recipient_type: string | null;
          role: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_communication_recipients_caterer_contact_id_fkey";
            columns: ["caterer_contact_id"];
            isOneToOne: false;
            referencedRelation: "caterer_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_communication_recipients_caterer_contact_id_fkey";
            columns: ["caterer_contact_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["contact_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "caterers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterer_detail";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_contacts";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey";
            columns: ["caterer_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["caterer_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_communications: {
        Row: {
          body: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
          communication_id: string | null;
          delivery_note_text: string | null;
          email_state: string | null;
          event_count: number | null;
          exported_at: string | null;
          exported_by: string | null;
          issue_count: number | null;
          latest_event_at: string | null;
          line_count: number | null;
          order_run_id: string | null;
          order_run_status: string | null;
          rendered_text: string | null;
          subject: string | null;
          template_version: string | null;
          total_quantity: number | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      operator_current_week: {
        Row: {
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
          session_count: number | null;
          week_end: string | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      operator_manual_overrides: {
        Row: {
          actor_name: string | null;
          after_state: Json | null;
          before_state: Json | null;
          created_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          manual_override_id: string | null;
          order_run_id: string | null;
          override_type: string | null;
          reason: string | null;
        };
        Insert: {
          actor_name?: string | null;
          after_state?: Json | null;
          before_state?: Json | null;
          created_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          manual_override_id?: string | null;
          order_run_id?: string | null;
          override_type?: string | null;
          reason?: string | null;
        };
        Update: {
          actor_name?: string | null;
          after_state?: Json | null;
          before_state?: Json | null;
          created_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          manual_override_id?: string | null;
          order_run_id?: string | null;
          override_type?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_menu_setup: {
        Row: {
          caterer_id: string | null;
          caterer_name: string | null;
          contains_beef: boolean | null;
          contains_fish: boolean | null;
          contains_pork: boolean | null;
          contains_red_meat: boolean | null;
          contains_shellfish: boolean | null;
          current_selected_count: number | null;
          dish_id: string | null;
          dish_name: string | null;
          dish_name_raw: string | null;
          display_name: string | null;
          has_no_declared_tags: boolean | null;
          ingredient_flags_source: string | null;
          ingredient_notes: string | null;
          is_available: boolean | null;
          is_dairy_free: boolean | null;
          is_default: boolean | null;
          is_gluten_free: boolean | null;
          is_halal_inferred: boolean | null;
          is_nut_free: boolean | null;
          is_offered: boolean | null;
          is_vegetarian_option: boolean | null;
          menu_offer_id: string | null;
          offer_notes: string | null;
          operator_reviewed: boolean | null;
          selected_at: string | null;
          selected_by: string | null;
          selected_minimum_meals: number | null;
          tags_review_reason: string | null;
          tags_reviewed_at: string | null;
          tags_reviewed_by: string | null;
          valid_offer_counts: number[] | null;
          variant_id: string | null;
          variant_name: string | null;
          week_end: string | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      operator_order_run_allocations: {
        Row: {
          allocation_id: string | null;
          allocation_status: string | null;
          dietary_tags: string[] | null;
          dish_variant_id: string | null;
          display_name: string | null;
          issue_count: number | null;
          order_run_id: string | null;
          school_name: string | null;
          session_date: string | null;
          session_id: string | null;
          student_id: string | null;
          student_name: string | null;
          year_level: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_order_run_contacts: {
        Row: {
          caterer_id: string | null;
          caterer_name: string | null;
          contact_id: string | null;
          contact_name: string | null;
          contact_role: string | null;
          delivery_notes: string | null;
          email: string | null;
          order_run_id: string | null;
          recipient_kind: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_order_run_issues: {
        Row: {
          category: string | null;
          dish_variant_id: string | null;
          issue_id: string | null;
          message: string | null;
          order_run_id: string | null;
          session_id: string | null;
          severity: string | null;
          student_id: string | null;
        };
        Insert: {
          category?: string | null;
          dish_variant_id?: string | null;
          issue_id?: string | null;
          message?: string | null;
          order_run_id?: string | null;
          session_id?: string | null;
          severity?: string | null;
          student_id?: string | null;
        };
        Update: {
          category?: string | null;
          dish_variant_id?: string | null;
          issue_id?: string | null;
          message?: string | null;
          order_run_id?: string | null;
          session_id?: string | null;
          severity?: string | null;
          student_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "dish_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_menu_setup";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey";
            columns: ["dish_variant_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["dish_variant_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_lines";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_run_allocations";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_order_run_lines: {
        Row: {
          caterer_id: string | null;
          caterer_name: string | null;
          dish_variant_id: string | null;
          display_name: string | null;
          line_total: number | null;
          order_line_id: string | null;
          order_run_id: string | null;
          quantity: number | null;
          school_name: string | null;
          session_date: string | null;
          session_id: string | null;
          unit_price: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_caterers";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_communications";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_current_week";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_order_runs";
            referencedColumns: ["order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_student_detail";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_students";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_status";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "operator_weeks";
            referencedColumns: ["latest_order_run_id"];
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey";
            columns: ["order_run_id"];
            isOneToOne: false;
            referencedRelation: "order_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_order_runs: {
        Row: {
          allocation_count: number | null;
          approval_note: string | null;
          approved_at: string | null;
          approved_by: string | null;
          exported_caterer_count: number | null;
          generated_at: string | null;
          generated_by: string | null;
          is_latest: boolean | null;
          issue_count: number | null;
          line_count: number | null;
          order_run_id: string | null;
          status: string | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      operator_student_detail: {
        Row: {
          absence_count: number | null;
          absences: Json | null;
          audit_events: Json | null;
          dietary_raw: string | null;
          dietary_tag_details: Json | null;
          dietary_tags: string[] | null;
          dietary_warnings: Json | null;
          enrolment_count: number | null;
          enrolments: Json | null;
          first_session_date: string | null;
          last_session_date: string | null;
          latest_allocated_count: number | null;
          latest_allocation_count: number | null;
          latest_allocation_statuses: string[] | null;
          latest_allocations: Json | null;
          latest_not_allocated_count: number | null;
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
          latest_order_week_start: string | null;
          manual_overrides: Json | null;
          opted_out: boolean | null;
          parent_email: string | null;
          parent_mobile: string | null;
          parent_name: string | null;
          pending_warning_count: number | null;
          school_id: string | null;
          school_name: string | null;
          source_file: string | null;
          student_email: string | null;
          student_id: string | null;
          student_name: string | null;
          subjects: string | null;
          warning_count: number | null;
          year_level: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_students: {
        Row: {
          absence_count: number | null;
          dietary_raw: string | null;
          dietary_tag_details: Json | null;
          dietary_tags: string[] | null;
          enrolment_count: number | null;
          first_session_date: string | null;
          last_session_date: string | null;
          latest_allocated_count: number | null;
          latest_allocation_count: number | null;
          latest_allocation_statuses: string[] | null;
          latest_not_allocated_count: number | null;
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
          latest_order_week_start: string | null;
          opted_out: boolean | null;
          parent_email: string | null;
          parent_mobile: string | null;
          parent_name: string | null;
          pending_warning_count: number | null;
          school_id: string | null;
          school_name: string | null;
          source_file: string | null;
          student_email: string | null;
          student_id: string | null;
          student_name: string | null;
          subjects: string | null;
          warning_count: number | null;
          year_level: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "operator_week_sessions";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_validation_summary: {
        Row: {
          category: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
          finding_count: number | null;
          severity: string | null;
          summary: string | null;
          target_route: string | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      operator_week_sessions: {
        Row: {
          building: string | null;
          cancelled_count: number | null;
          caterer_id: string | null;
          caterer_name: string | null;
          enrolled_count: number | null;
          export_state: string | null;
          latest_order_line_count: number | null;
          manager_mobile: string | null;
          manager_name: string | null;
          orderable_student_count: number | null;
          school_id: string | null;
          school_name: string | null;
          session_date: string | null;
          session_id: string | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      operator_week_status: {
        Row: {
          approval_state: string | null;
          blocking_issue_count: number | null;
          export_state: string | null;
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
          menu_offers_ready: boolean | null;
          missing_offer_caterer_count: number | null;
          source_data_ready: boolean | null;
          unreviewed_variant_count: number | null;
          validation_state: string | null;
          variant_review_ready: boolean | null;
          warning_count: number | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      operator_weeks: {
        Row: {
          allocation_issue_count: number | null;
          approved_at: string | null;
          caterer_count: number | null;
          exported_caterer_count: number | null;
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
          session_count: number | null;
          student_count: number | null;
          week_end: string | null;
          week_start: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      operator_approve_order_run: {
        Args: { p_order_run_id: string; p_reason: string };
        Returns: string;
      };
      operator_create_dish_variant: {
        Args: {
          p_contains_beef: boolean;
          p_contains_fish: boolean;
          p_contains_pork: boolean;
          p_contains_red_meat: boolean;
          p_contains_shellfish: boolean;
          p_dish_id: string;
          p_ingredient_notes: string;
          p_is_dairy_free: boolean;
          p_is_gluten_free: boolean;
          p_is_halal_inferred: boolean;
          p_is_nut_free: boolean;
          p_is_vegetarian_option: boolean;
          p_reason: string;
          p_variant_name: string;
        };
        Returns: string;
      };
      operator_record_caterer_email_preparation: {
        Args: { p_communication_id: string; p_reason: string };
        Returns: string;
      };
      operator_record_manual_override: {
        Args: {
          p_entity_id: string;
          p_entity_type: string;
          p_order_run_id: string;
          p_override_type: string;
          p_reason: string;
        };
        Returns: string;
      };
      operator_reopen_order_run: {
        Args: { p_order_run_id: string; p_reason: string };
        Returns: string;
      };
      operator_review_dish_variant: {
        Args: {
          p_contains_beef: boolean;
          p_contains_fish: boolean;
          p_contains_pork: boolean;
          p_contains_red_meat: boolean;
          p_contains_shellfish: boolean;
          p_dish_variant_id: string;
          p_ingredient_notes: string;
          p_is_dairy_free: boolean;
          p_is_gluten_free: boolean;
          p_is_halal_inferred: boolean;
          p_is_nut_free: boolean;
          p_is_vegetarian_option: boolean;
          p_reason: string;
        };
        Returns: string;
      };
      operator_save_menu_offers: {
        Args: {
          p_caterer_id: string;
          p_dish_variant_ids: string[];
          p_reason: string;
          p_week_start: string;
        };
        Returns: number;
      };
      operator_update_dish_variant_availability: {
        Args: {
          p_dish_variant_id: string;
          p_is_available: boolean;
          p_reason: string;
        };
        Returns: string;
      };
    };
    Enums: {
      cc_preference: "cc" | "do_not_cc" | "unspecified";
      contact_role: "primary" | "secondary" | "chef" | "manager";
      dietary_tag_kind: "allergen" | "religious" | "preference";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      cc_preference: ["cc", "do_not_cc", "unspecified"],
      contact_role: ["primary", "secondary", "chef", "manager"],
      dietary_tag_kind: ["allergen", "religious", "preference"],
    },
  },
} as const;
