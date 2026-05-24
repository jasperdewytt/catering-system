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
      [_ in never]: never;
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
