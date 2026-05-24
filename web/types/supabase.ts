export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      operators: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      operator_audit_events: {
        Row: {
          audit_id: string | null;
          created_at: string | null;
          actor_name: string | null;
          action: string | null;
          display_action: string | null;
          entity_type: string | null;
          entity_id: string | null;
          order_run_id: string | null;
          reason: string | null;
          before_state: Json | null;
          after_state: Json | null;
        };
        Relationships: [];
      };
      operator_current_week: {
        Row: {
          week_start: string | null;
          week_end: string | null;
          session_count: number | null;
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
        };
        Relationships: [];
      };
      operator_menu_setup: {
        Row: {
          week_start: string | null;
          week_end: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
          dish_id: string | null;
          dish_name: string | null;
          dish_name_raw: string | null;
          variant_id: string | null;
          variant_name: string | null;
          display_name: string | null;
          is_default: boolean | null;
          is_available: boolean | null;
          is_offered: boolean | null;
          menu_offer_id: string | null;
          selected_by: string | null;
          selected_at: string | null;
          offer_notes: string | null;
          is_gluten_free: boolean | null;
          is_dairy_free: boolean | null;
          is_nut_free: boolean | null;
          is_vegetarian_option: boolean | null;
          is_halal_inferred: boolean | null;
          has_no_declared_tags: boolean | null;
          contains_beef: boolean | null;
          contains_pork: boolean | null;
          contains_red_meat: boolean | null;
          contains_fish: boolean | null;
          contains_shellfish: boolean | null;
          ingredient_notes: string | null;
          ingredient_flags_source: string | null;
          operator_reviewed: boolean | null;
          tags_reviewed_at: string | null;
          tags_reviewed_by: string | null;
          tags_review_reason: string | null;
          valid_offer_counts: number[] | null;
          current_selected_count: number | null;
          selected_minimum_meals: number | null;
        };
        Relationships: [];
      };
      operator_manual_overrides: {
        Row: {
          manual_override_id: string | null;
          order_run_id: string | null;
          actor_name: string | null;
          override_type: string | null;
          entity_type: string | null;
          entity_id: string | null;
          reason: string | null;
          before_state: Json | null;
          after_state: Json | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      operator_order_run_allocations: {
        Row: {
          order_run_id: string | null;
          allocation_id: string | null;
          student_id: string | null;
          student_name: string | null;
          school_name: string | null;
          year_level: number | null;
          session_id: string | null;
          session_date: string | null;
          dish_variant_id: string | null;
          display_name: string | null;
          dietary_tags: string[] | null;
          allocation_status: string | null;
          issue_count: number | null;
        };
        Relationships: [];
      };
      operator_order_run_contacts: {
        Row: {
          order_run_id: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
          contact_id: string | null;
          contact_name: string | null;
          contact_role: string | null;
          email: string | null;
          recipient_kind: string | null;
          delivery_notes: string | null;
        };
        Relationships: [];
      };
      operator_order_run_issues: {
        Row: {
          issue_id: string | null;
          order_run_id: string | null;
          severity: string | null;
          category: string | null;
          message: string | null;
          student_id: string | null;
          session_id: string | null;
          dish_variant_id: string | null;
        };
        Relationships: [];
      };
      operator_order_run_lines: {
        Row: {
          order_run_id: string | null;
          order_line_id: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
          session_id: string | null;
          school_name: string | null;
          session_date: string | null;
          dish_variant_id: string | null;
          display_name: string | null;
          quantity: number | null;
          unit_price: number | null;
          line_total: number | null;
        };
        Relationships: [];
      };
      operator_order_runs: {
        Row: {
          order_run_id: string | null;
          week_start: string | null;
          status: string | null;
          generated_at: string | null;
          generated_by: string | null;
          approved_at: string | null;
          approved_by: string | null;
          approval_note: string | null;
          allocation_count: number | null;
          line_count: number | null;
          issue_count: number | null;
          exported_caterer_count: number | null;
          is_latest: boolean | null;
        };
        Relationships: [];
      };
      operator_validation_summary: {
        Row: {
          week_start: string | null;
          severity: string | null;
          category: string | null;
          finding_count: number | null;
          summary: string | null;
          target_route: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
        };
        Relationships: [];
      };
      operator_week_sessions: {
        Row: {
          week_start: string | null;
          session_id: string | null;
          session_date: string | null;
          school_id: string | null;
          school_name: string | null;
          caterer_id: string | null;
          caterer_name: string | null;
          manager_name: string | null;
          manager_mobile: string | null;
          building: string | null;
          enrolled_count: number | null;
          orderable_student_count: number | null;
          cancelled_count: number | null;
          latest_order_line_count: number | null;
          export_state: string | null;
        };
        Relationships: [];
      };
      operator_week_status: {
        Row: {
          week_start: string | null;
          source_data_ready: boolean | null;
          menu_offers_ready: boolean | null;
          variant_review_ready: boolean | null;
          validation_state: string | null;
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
          approval_state: string | null;
          export_state: string | null;
          blocking_issue_count: number | null;
          warning_count: number | null;
          unreviewed_variant_count: number | null;
          missing_offer_caterer_count: number | null;
        };
        Relationships: [];
      };
      operator_weeks: {
        Row: {
          week_start: string | null;
          week_end: string | null;
          session_count: number | null;
          student_count: number | null;
          caterer_count: number | null;
          latest_order_run_id: string | null;
          latest_order_run_status: string | null;
          approved_at: string | null;
          exported_caterer_count: number | null;
          allocation_issue_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      operator_approve_order_run: {
        Args: {
          p_order_run_id: string;
          p_reason: string;
        };
        Returns: string;
      };
      operator_create_dish_variant: {
        Args: {
          p_dish_id: string;
          p_variant_name: string;
          p_is_gluten_free: boolean;
          p_is_dairy_free: boolean;
          p_is_nut_free: boolean;
          p_is_vegetarian_option: boolean;
          p_is_halal_inferred: boolean;
          p_contains_beef: boolean;
          p_contains_pork: boolean;
          p_contains_red_meat: boolean;
          p_contains_fish: boolean;
          p_contains_shellfish: boolean;
          p_ingredient_notes: string;
          p_reason: string;
        };
        Returns: string;
      };
      operator_record_manual_override: {
        Args: {
          p_order_run_id: string;
          p_override_type: string;
          p_entity_type: string;
          p_entity_id: string | null;
          p_reason: string;
        };
        Returns: string;
      };
      operator_reopen_order_run: {
        Args: {
          p_order_run_id: string;
          p_reason: string;
        };
        Returns: string;
      };
      operator_review_dish_variant: {
        Args: {
          p_dish_variant_id: string;
          p_is_gluten_free: boolean;
          p_is_dairy_free: boolean;
          p_is_nut_free: boolean;
          p_is_vegetarian_option: boolean;
          p_is_halal_inferred: boolean;
          p_contains_beef: boolean;
          p_contains_pork: boolean;
          p_contains_red_meat: boolean;
          p_contains_fish: boolean;
          p_contains_shellfish: boolean;
          p_ingredient_notes: string;
          p_reason: string;
        };
        Returns: string;
      };
      operator_update_dish_variant_availability: {
        Args: {
          p_dish_variant_id: string;
          p_is_available: boolean;
          p_reason: string;
        };
        Returns: string;
      };
      operator_save_menu_offers: {
        Args: {
          p_week_start: string;
          p_caterer_id: string;
          p_dish_variant_ids: string[];
          p_reason: string;
        };
        Returns: number;
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
