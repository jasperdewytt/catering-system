export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string
          id: string
          note: string | null
          session_id: string
          source_file: string | null
          source_row: Json | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          session_id: string
          source_file?: string | null
          source_row?: Json | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          session_id?: string
          source_file?: string | null
          source_row?: Json | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "absences_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "absences_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "absences_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interpretations: {
        Row: {
          autopilot_exception_id: string | null
          caterer_reply_id: string | null
          confidence: number | null
          created_at: string
          id: string
          input_hash: string
          metadata: Json
          model: string
          needs_human_review: boolean
          parsed_output: Json
          prompt_version: string
          provider: string
          purpose: string
          raw_input: string | null
          raw_output: string
          schema_version: string
          session_catering_feedback_id: string | null
          student_meal_feedback_id: string | null
        }
        Insert: {
          autopilot_exception_id?: string | null
          caterer_reply_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          input_hash: string
          metadata?: Json
          model: string
          needs_human_review?: boolean
          parsed_output?: Json
          prompt_version: string
          provider: string
          purpose: string
          raw_input?: string | null
          raw_output: string
          schema_version: string
          session_catering_feedback_id?: string | null
          student_meal_feedback_id?: string | null
        }
        Update: {
          autopilot_exception_id?: string | null
          caterer_reply_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          input_hash?: string
          metadata?: Json
          model?: string
          needs_human_review?: boolean
          parsed_output?: Json
          prompt_version?: string
          provider?: string
          purpose?: string
          raw_input?: string | null
          raw_output?: string
          schema_version?: string
          session_catering_feedback_id?: string | null
          student_meal_feedback_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interpretations_autopilot_exception_id_fkey"
            columns: ["autopilot_exception_id"]
            isOneToOne: false
            referencedRelation: "autopilot_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interpretations_autopilot_exception_id_fkey"
            columns: ["autopilot_exception_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["exception_id"]
          },
          {
            foreignKeyName: "ai_interpretations_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "caterer_reply_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interpretations_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["caterer_reply_id"]
          },
          {
            foreignKeyName: "ai_interpretations_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["reply_id"]
          },
          {
            foreignKeyName: "ai_interpretations_session_catering_feedback_id_fkey"
            columns: ["session_catering_feedback_id"]
            isOneToOne: false
            referencedRelation: "session_catering_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interpretations_student_meal_feedback_id_fkey"
            columns: ["student_meal_feedback_id"]
            isOneToOne: false
            referencedRelation: "student_meal_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_name: string
          after_state: Json
          before_state: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          order_run_id: string | null
          reason: string
        }
        Insert: {
          action: string
          actor_name: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          order_run_id?: string | null
          reason: string
        }
        Update: {
          action?: string
          actor_name?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          order_run_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_job_events: {
        Row: {
          automation_job_id: string
          counters: Json
          created_at: string
          detail: string | null
          event_type: string
          id: string
          metadata: Json
          progress_percent: number | null
          stage_code: string | null
          stage_label: string | null
        }
        Insert: {
          automation_job_id: string
          counters?: Json
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          metadata?: Json
          progress_percent?: number | null
          stage_code?: string | null
          stage_label?: string | null
        }
        Update: {
          automation_job_id?: string
          counters?: Json
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          progress_percent?: number | null
          stage_code?: string | null
          stage_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_job_events_automation_job_id_fkey"
            columns: ["automation_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_job_events_automation_job_id_fkey"
            columns: ["automation_job_id"]
            isOneToOne: false
            referencedRelation: "operator_automation_jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          actor_id: string | null
          actor_name: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          counters: Json
          created_at: string
          current_stage: string
          error_detail: string | null
          id: string
          idempotency_key: string
          job_type: string
          lease_expires_at: string | null
          lease_owner: string | null
          linked_autopilot_run_id: string | null
          max_attempts: number
          payload: Json
          progress_percent: number
          result: Json
          stage_label: string
          started_at: string | null
          status: string
          trigger_source: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          actor_name: string
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          counters?: Json
          created_at?: string
          current_stage?: string
          error_detail?: string | null
          id?: string
          idempotency_key: string
          job_type: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          linked_autopilot_run_id?: string | null
          max_attempts?: number
          payload?: Json
          progress_percent?: number
          result?: Json
          stage_label?: string
          started_at?: string | null
          status?: string
          trigger_source: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          counters?: Json
          created_at?: string
          current_stage?: string
          error_detail?: string | null
          id?: string
          idempotency_key?: string
          job_type?: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          linked_autopilot_run_id?: string | null
          max_attempts?: number
          payload?: Json
          progress_percent?: number
          result?: Json
          stage_label?: string
          started_at?: string | null
          status?: string
          trigger_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_linked_autopilot_run_id_fkey"
            columns: ["linked_autopilot_run_id"]
            isOneToOne: false
            referencedRelation: "autopilot_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_linked_autopilot_run_id_fkey"
            columns: ["linked_autopilot_run_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_status"
            referencedColumns: ["autopilot_run_id"]
          },
        ]
      }
      automation_schedules: {
        Row: {
          created_at: string
          daytime_end: string
          daytime_interval_seconds: number
          daytime_start: string
          enabled: boolean
          last_checked_at: string | null
          last_error: string | null
          last_job_id: string | null
          last_result: Json
          last_success_at: string | null
          next_check_at: string
          overnight_interval_seconds: number
          schedule_key: string
          timezone: string
          updated_at: string
          worker_heartbeat_at: string | null
        }
        Insert: {
          created_at?: string
          daytime_end?: string
          daytime_interval_seconds?: number
          daytime_start?: string
          enabled?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_job_id?: string | null
          last_result?: Json
          last_success_at?: string | null
          next_check_at?: string
          overnight_interval_seconds?: number
          schedule_key: string
          timezone?: string
          updated_at?: string
          worker_heartbeat_at?: string | null
        }
        Update: {
          created_at?: string
          daytime_end?: string
          daytime_interval_seconds?: number
          daytime_start?: string
          enabled?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_job_id?: string | null
          last_result?: Json
          last_success_at?: string | null
          next_check_at?: string
          overnight_interval_seconds?: number
          schedule_key?: string
          timezone?: string
          updated_at?: string
          worker_heartbeat_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_schedules_last_job_id_fkey"
            columns: ["last_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_schedules_last_job_id_fkey"
            columns: ["last_job_id"]
            isOneToOne: false
            referencedRelation: "operator_automation_jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      autopilot_exception_resolutions: {
        Row: {
          ai_interpretation_id: string | null
          applied_at: string | null
          applied_by: string | null
          applied_by_name: string | null
          caterer_reply_id: string
          created_at: string
          created_by: string
          created_by_name: string
          edited_action: Json
          exception_id: string
          failure_detail: string | null
          final_message_text: string
          id: string
          idempotency_key: string
          operator_instruction: string
          proposed_action: Json
          proposed_message_text: string
          resulting_communication_id: string | null
          resulting_order_run_id: string | null
          source_order_run_id: string
          status: string
          updated_at: string
          validation_report: Json
        }
        Insert: {
          ai_interpretation_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          applied_by_name?: string | null
          caterer_reply_id: string
          created_at?: string
          created_by: string
          created_by_name: string
          edited_action?: Json
          exception_id: string
          failure_detail?: string | null
          final_message_text?: string
          id?: string
          idempotency_key: string
          operator_instruction: string
          proposed_action?: Json
          proposed_message_text?: string
          resulting_communication_id?: string | null
          resulting_order_run_id?: string | null
          source_order_run_id: string
          status?: string
          updated_at?: string
          validation_report?: Json
        }
        Update: {
          ai_interpretation_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          applied_by_name?: string | null
          caterer_reply_id?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          edited_action?: Json
          exception_id?: string
          failure_detail?: string | null
          final_message_text?: string
          id?: string
          idempotency_key?: string
          operator_instruction?: string
          proposed_action?: Json
          proposed_message_text?: string
          resulting_communication_id?: string | null
          resulting_order_run_id?: string | null
          source_order_run_id?: string
          status?: string
          updated_at?: string
          validation_report?: Json
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_exception_resolutions_ai_interpretation_id_fkey"
            columns: ["ai_interpretation_id"]
            isOneToOne: false
            referencedRelation: "ai_interpretations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_ai_interpretation_id_fkey"
            columns: ["ai_interpretation_id"]
            isOneToOne: false
            referencedRelation: "operator_ai_interpretations"
            referencedColumns: ["ai_interpretation_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "caterer_reply_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["caterer_reply_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["reply_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "autopilot_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["exception_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["revised_communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communication_recipients"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "order_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_exceptions: {
        Row: {
          ai_confidence: number | null
          autopilot_run_id: string | null
          category: string
          caterer_id: string | null
          created_at: string
          detail: string
          dish_variant_id: string | null
          id: string
          metadata: Json
          order_run_id: string | null
          recommended_action: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_note: string | null
          service_week_start: string
          session_id: string | null
          severity: string
          status: string
          student_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          autopilot_run_id?: string | null
          category: string
          caterer_id?: string | null
          created_at?: string
          detail: string
          dish_variant_id?: string | null
          id?: string
          metadata?: Json
          order_run_id?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          service_week_start: string
          session_id?: string | null
          severity: string
          status?: string
          student_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          autopilot_run_id?: string | null
          category?: string
          caterer_id?: string | null
          created_at?: string
          detail?: string
          dish_variant_id?: string | null
          id?: string
          metadata?: Json
          order_run_id?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          service_week_start?: string
          session_id?: string | null
          severity?: string
          status?: string
          student_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_exceptions_autopilot_run_id_fkey"
            columns: ["autopilot_run_id"]
            isOneToOne: false
            referencedRelation: "autopilot_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_autopilot_run_id_fkey"
            columns: ["autopilot_run_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_status"
            referencedColumns: ["autopilot_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_runs: {
        Row: {
          ai_interpretation_count: number
          completed_at: string | null
          created_at: string
          emails_prepared_count: number
          emails_sent_count: number
          exception_count: number
          generated_order_run_id: string | null
          id: string
          idempotency_key: string
          metadata: Json
          service_week_start: string
          started_at: string
          status: string
          summary: string | null
          trigger_source: string
          updated_at: string
        }
        Insert: {
          ai_interpretation_count?: number
          completed_at?: string | null
          created_at?: string
          emails_prepared_count?: number
          emails_sent_count?: number
          exception_count?: number
          generated_order_run_id?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          service_week_start: string
          started_at?: string
          status: string
          summary?: string | null
          trigger_source: string
          updated_at?: string
        }
        Update: {
          ai_interpretation_count?: number
          completed_at?: string | null
          created_at?: string
          emails_prepared_count?: number
          emails_sent_count?: number
          exception_count?: number
          generated_order_run_id?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          service_week_start?: string
          started_at?: string
          status?: string
          summary?: string | null
          trigger_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      caterer_contacts: {
        Row: {
          caterer_id: string
          cc_preference: Database["public"]["Enums"]["cc_preference"]
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_verified: boolean
          role: Database["public"]["Enums"]["contact_role"]
          role_note: string | null
          source_file: string | null
          source_row: Json | null
          updated_at: string
        }
        Insert: {
          caterer_id: string
          cc_preference?: Database["public"]["Enums"]["cc_preference"]
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_verified?: boolean
          role: Database["public"]["Enums"]["contact_role"]
          role_note?: string | null
          source_file?: string | null
          source_row?: Json | null
          updated_at?: string
        }
        Update: {
          caterer_id?: string
          cc_preference?: Database["public"]["Enums"]["cc_preference"]
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_verified?: boolean
          role?: Database["public"]["Enums"]["contact_role"]
          role_note?: string | null
          source_file?: string | null
          source_row?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_contacts_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
        ]
      }
      caterer_quality_events: {
        Row: {
          caterer_id: string
          created_at: string
          event_key: string | null
          event_type: string
          id: string
          metadata: Json
          session_id: string | null
          severity: string
          source: string
          source_session_catering_feedback_id: string | null
          source_student_meal_feedback_id: string | null
          summary: string
        }
        Insert: {
          caterer_id: string
          created_at?: string
          event_key?: string | null
          event_type: string
          id?: string
          metadata?: Json
          session_id?: string | null
          severity: string
          source: string
          source_session_catering_feedback_id?: string | null
          source_student_meal_feedback_id?: string | null
          summary: string
        }
        Update: {
          caterer_id?: string
          created_at?: string
          event_key?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          session_id?: string | null
          severity?: string
          source?: string
          source_session_catering_feedback_id?: string | null
          source_student_meal_feedback_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "caterer_quality_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_quality_events_source_session_catering_feedback_id_fkey"
            columns: ["source_session_catering_feedback_id"]
            isOneToOne: false
            referencedRelation: "session_catering_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_quality_events_source_student_meal_feedback_id_fkey"
            columns: ["source_student_meal_feedback_id"]
            isOneToOne: false
            referencedRelation: "student_meal_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      caterer_reply_intake: {
        Row: {
          ai_interpretation_id: string | null
          caterer_id: string | null
          communication_id: string | null
          confidence: number | null
          created_at: string
          from_email: string | null
          handled_at: string | null
          handled_status: string
          handling_summary: string | null
          id: string
          in_reply_to_message_id: string | null
          metadata: Json
          order_run_id: string | null
          parsed_intent: string | null
          provider: string | null
          provider_message_id: string | null
          provider_thread_id: string | null
          raw_body: string
          received_at: string
          reference_message_ids: string[]
          subject: string | null
          updated_at: string
        }
        Insert: {
          ai_interpretation_id?: string | null
          caterer_id?: string | null
          communication_id?: string | null
          confidence?: number | null
          created_at?: string
          from_email?: string | null
          handled_at?: string | null
          handled_status?: string
          handling_summary?: string | null
          id?: string
          in_reply_to_message_id?: string | null
          metadata?: Json
          order_run_id?: string | null
          parsed_intent?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          raw_body: string
          received_at: string
          reference_message_ids?: string[]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          ai_interpretation_id?: string | null
          caterer_id?: string | null
          communication_id?: string | null
          confidence?: number | null
          created_at?: string
          from_email?: string | null
          handled_at?: string | null
          handled_status?: string
          handling_summary?: string | null
          id?: string
          in_reply_to_message_id?: string | null
          metadata?: Json
          order_run_id?: string | null
          parsed_intent?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          raw_body?: string
          received_at?: string
          reference_message_ids?: string[]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caterer_reply_intake_ai_interpretation_id_fkey"
            columns: ["ai_interpretation_id"]
            isOneToOne: false
            referencedRelation: "ai_interpretations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_ai_interpretation_id_fkey"
            columns: ["ai_interpretation_id"]
            isOneToOne: false
            referencedRelation: "operator_ai_interpretations"
            referencedColumns: ["ai_interpretation_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["revised_communication_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_communication_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communication_recipients"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "order_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      caterer_weekly_minimums: {
        Row: {
          caterer_id: string
          created_at: string
          menu_item_count: number
          minimum_meals: number
          updated_at: string
        }
        Insert: {
          caterer_id: string
          created_at?: string
          menu_item_count: number
          minimum_meals: number
          updated_at?: string
        }
        Update: {
          caterer_id?: string
          created_at?: string
          menu_item_count?: number
          minimum_meals?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_weekly_minimums_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
        ]
      }
      caterers: {
        Row: {
          created_at: string
          delivery_fee_cents: number
          delivery_notes: string | null
          delivery_scope: string
          gst_inclusive: boolean
          gst_rate_bps: number
          id: string
          name: string
          per_item_price_cents: number
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_fee_cents?: number
          delivery_notes?: string | null
          delivery_scope: string
          gst_inclusive: boolean
          gst_rate_bps?: number
          id?: string
          name: string
          per_item_price_cents: number
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_fee_cents?: number
          delivery_notes?: string | null
          delivery_scope?: string
          gst_inclusive?: boolean
          gst_rate_bps?: number
          id?: string
          name?: string
          per_item_price_cents?: number
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dietary_tags: {
        Row: {
          code: string
          created_at: string
          description: string
          kind: Database["public"]["Enums"]["dietary_tag_kind"]
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          kind: Database["public"]["Enums"]["dietary_tag_kind"]
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          kind?: Database["public"]["Enums"]["dietary_tag_kind"]
        }
        Relationships: []
      }
      dish_variant_tags: {
        Row: {
          confidence: number | null
          created_at: string
          dish_variant_id: string
          id: string
          notes: string | null
          tag_code: string
          tag_source: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          dish_variant_id: string
          id?: string
          notes?: string | null
          tag_code: string
          tag_source: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          dish_variant_id?: string
          id?: string
          notes?: string | null
          tag_code?: string
          tag_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_variant_tags_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_variant_tags_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "dish_variant_tags_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "dish_variant_tags_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "dish_variant_tags_tag_code_fkey"
            columns: ["tag_code"]
            isOneToOne: false
            referencedRelation: "preference_tags"
            referencedColumns: ["code"]
          },
        ]
      }
      dish_variants: {
        Row: {
          contains_beef: boolean
          contains_fish: boolean
          contains_pork: boolean
          contains_red_meat: boolean
          contains_shellfish: boolean
          created_at: string
          dish_id: string
          has_no_declared_tags: boolean
          id: string
          ingredient_flags_source: string
          ingredient_notes: string | null
          is_available: boolean
          is_dairy_free: boolean
          is_default: boolean
          is_gluten_free: boolean
          is_halal_inferred: boolean
          is_nut_free: boolean
          is_vegetarian_option: boolean
          name: string
          tags_review_reason: string | null
          tags_reviewed_at: string | null
          tags_reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          contains_beef?: boolean
          contains_fish?: boolean
          contains_pork?: boolean
          contains_red_meat?: boolean
          contains_shellfish?: boolean
          created_at?: string
          dish_id: string
          has_no_declared_tags?: boolean
          id?: string
          ingredient_flags_source?: string
          ingredient_notes?: string | null
          is_available?: boolean
          is_dairy_free?: boolean
          is_default?: boolean
          is_gluten_free?: boolean
          is_halal_inferred?: boolean
          is_nut_free?: boolean
          is_vegetarian_option?: boolean
          name: string
          tags_review_reason?: string | null
          tags_reviewed_at?: string | null
          tags_reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          contains_beef?: boolean
          contains_fish?: boolean
          contains_pork?: boolean
          contains_red_meat?: boolean
          contains_shellfish?: boolean
          created_at?: string
          dish_id?: string
          has_no_declared_tags?: boolean
          id?: string
          ingredient_flags_source?: string
          ingredient_notes?: string | null
          is_available?: boolean
          is_dairy_free?: boolean
          is_default?: boolean
          is_gluten_free?: boolean
          is_halal_inferred?: boolean
          is_nut_free?: boolean
          is_vegetarian_option?: boolean
          name?: string
          tags_review_reason?: string | null
          tags_reviewed_at?: string | null
          tags_reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_variants_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_variants_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["dish_id"]
          },
        ]
      }
      dishes: {
        Row: {
          caterer_id: string
          contains_beef: boolean
          contains_fish: boolean
          contains_pork: boolean
          contains_red_meat: boolean
          contains_shellfish: boolean
          created_at: string
          halal_inference_note: string | null
          has_no_declared_tags: boolean
          id: string
          ingredient_flags_source: string
          ingredient_notes: string | null
          is_dairy_free: boolean
          is_gluten_free: boolean
          is_halal_inferred: boolean
          is_nut_free: boolean
          is_vegetarian_option: boolean
          name: string
          name_raw: string
          source_file: string | null
          source_row: Json | null
          tags_review_reason: string | null
          tags_reviewed_at: string | null
          tags_reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          caterer_id: string
          contains_beef?: boolean
          contains_fish?: boolean
          contains_pork?: boolean
          contains_red_meat?: boolean
          contains_shellfish?: boolean
          created_at?: string
          halal_inference_note?: string | null
          has_no_declared_tags?: boolean
          id?: string
          ingredient_flags_source?: string
          ingredient_notes?: string | null
          is_dairy_free?: boolean
          is_gluten_free?: boolean
          is_halal_inferred: boolean
          is_nut_free?: boolean
          is_vegetarian_option?: boolean
          name: string
          name_raw: string
          source_file?: string | null
          source_row?: Json | null
          tags_review_reason?: string | null
          tags_reviewed_at?: string | null
          tags_reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          caterer_id?: string
          contains_beef?: boolean
          contains_fish?: boolean
          contains_pork?: boolean
          contains_red_meat?: boolean
          contains_shellfish?: boolean
          created_at?: string
          halal_inference_note?: string | null
          has_no_declared_tags?: boolean
          id?: string
          ingredient_flags_source?: string
          ingredient_notes?: string | null
          is_dairy_free?: boolean
          is_gluten_free?: boolean
          is_halal_inferred?: boolean
          is_nut_free?: boolean
          is_vegetarian_option?: boolean
          name?: string
          name_raw?: string
          source_file?: string | null
          source_row?: Json | null
          tags_review_reason?: string | null
          tags_reviewed_at?: string | null
          tags_reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "dishes_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
        ]
      }
      exclusions: {
        Row: {
          created_at: string
          excluded_year_levels: number[]
          id: string
          reason: string | null
          session_id: string
          source_file: string | null
          source_row: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          excluded_year_levels: number[]
          id?: string
          reason?: string | null
          session_id: string
          source_file?: string | null
          source_row?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          excluded_year_levels?: number[]
          id?: string
          reason?: string | null
          session_id?: string
          source_file?: string | null
          source_row?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "exclusions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "exclusions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "exclusions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_delivery_attempts: {
        Row: {
          actual_recipient: string | null
          channel: string
          created_at: string
          error_detail: string | null
          feedback_request_id: string
          id: string
          message_id: string | null
          metadata: Json
          provider: string | null
          requested_recipient: string | null
          status: string
        }
        Insert: {
          actual_recipient?: string | null
          channel: string
          created_at?: string
          error_detail?: string | null
          feedback_request_id: string
          id?: string
          message_id?: string | null
          metadata?: Json
          provider?: string | null
          requested_recipient?: string | null
          status: string
        }
        Update: {
          actual_recipient?: string | null
          channel?: string
          created_at?: string
          error_detail?: string | null
          feedback_request_id?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          provider?: string | null
          requested_recipient?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_delivery_attempts_feedback_request_id_fkey"
            columns: ["feedback_request_id"]
            isOneToOne: false
            referencedRelation: "feedback_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_delivery_attempts_feedback_request_id_fkey"
            columns: ["feedback_request_id"]
            isOneToOne: false
            referencedRelation: "operator_feedback_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      feedback_requests: {
        Row: {
          audience: string
          caterer_id: string | null
          created_at: string
          eligible_at: string
          email_to: string | null
          expires_at: string
          id: string
          last_error: string | null
          metadata: Json
          order_allocation_id: string | null
          order_run_id: string | null
          response_session_feedback_id: string | null
          response_student_feedback_id: string | null
          send_count: number
          sent_at: string | null
          session_id: string
          status: string
          student_id: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          audience: string
          caterer_id?: string | null
          created_at?: string
          eligible_at: string
          email_to?: string | null
          expires_at: string
          id?: string
          last_error?: string | null
          metadata?: Json
          order_allocation_id?: string | null
          order_run_id?: string | null
          response_session_feedback_id?: string | null
          response_student_feedback_id?: string | null
          send_count?: number
          sent_at?: string | null
          session_id: string
          status?: string
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          caterer_id?: string | null
          created_at?: string
          eligible_at?: string
          email_to?: string | null
          expires_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          order_allocation_id?: string | null
          order_run_id?: string | null
          response_session_feedback_id?: string | null
          response_student_feedback_id?: string | null
          send_count?: number
          sent_at?: string | null
          session_id?: string
          status?: string
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "operator_meal_fit_signals"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "order_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_response_session_feedback_id_fkey"
            columns: ["response_session_feedback_id"]
            isOneToOne: false
            referencedRelation: "session_catering_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_response_student_feedback_id_fkey"
            columns: ["response_student_feedback_id"]
            isOneToOne: false
            referencedRelation: "student_meal_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "feedback_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "feedback_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "feedback_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_overrides: {
        Row: {
          actor_name: string
          after_state: Json
          before_state: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          order_run_id: string
          override_type: string
          reason: string
        }
        Insert: {
          actor_name: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          order_run_id: string
          override_type: string
          reason: string
        }
        Update: {
          actor_name?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          order_run_id?: string
          override_type?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_fit_scoring_versions: {
        Row: {
          created_at: string
          decay_config: Json
          is_active: boolean
          version: string
          weights: Json
        }
        Insert: {
          created_at?: string
          decay_config: Json
          is_active?: boolean
          version: string
          weights: Json
        }
        Update: {
          created_at?: string
          decay_config?: Json
          is_active?: boolean
          version?: string
          weights?: Json
        }
        Relationships: []
      }
      menu_offers: {
        Row: {
          created_at: string
          dish_id: string
          dish_variant_id: string
          id: string
          notes: string | null
          selected_at: string
          selected_by: string | null
          service_week_start: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          dish_variant_id: string
          id?: string
          notes?: string | null
          selected_at?: string
          selected_by?: string | null
          service_week_start: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          dish_variant_id?: string
          id?: string
          notes?: string | null
          selected_at?: string
          selected_by?: string | null
          service_week_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_offers_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_offers_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "menu_offers_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_offers_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "menu_offers_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "menu_offers_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
        ]
      }
      operators: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_allocation_fit_explanations: {
        Row: {
          chosen_score: number | null
          constrained_by: string[]
          created_at: string
          explanation: string
          fit_debt_applied: number
          metadata: Json
          negative_factors: Json
          novelty_applied: number
          order_allocation_id: string
          positive_factors: Json
          scoring_version: string
          top_feasible_score: number | null
          top_feasible_variant_id: string | null
        }
        Insert: {
          chosen_score?: number | null
          constrained_by?: string[]
          created_at?: string
          explanation: string
          fit_debt_applied?: number
          metadata?: Json
          negative_factors?: Json
          novelty_applied?: number
          order_allocation_id: string
          positive_factors?: Json
          scoring_version: string
          top_feasible_score?: number | null
          top_feasible_variant_id?: string | null
        }
        Update: {
          chosen_score?: number | null
          constrained_by?: string[]
          created_at?: string
          explanation?: string
          fit_debt_applied?: number
          metadata?: Json
          negative_factors?: Json
          novelty_applied?: number
          order_allocation_id?: string
          positive_factors?: Json
          scoring_version?: string
          top_feasible_score?: number | null
          top_feasible_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_allocation_fit_explanations_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: true
            referencedRelation: "operator_meal_fit_signals"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: true
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: true
            referencedRelation: "order_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_scoring_version_fkey"
            columns: ["scoring_version"]
            isOneToOne: false
            referencedRelation: "meal_fit_scoring_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_top_feasible_variant_id_fkey"
            columns: ["top_feasible_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_top_feasible_variant_id_fkey"
            columns: ["top_feasible_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_top_feasible_variant_id_fkey"
            columns: ["top_feasible_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_top_feasible_variant_id_fkey"
            columns: ["top_feasible_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
        ]
      }
      order_allocation_issues: {
        Row: {
          code: string
          created_at: string
          details: Json
          dish_id: string | null
          dish_variant_id: string | null
          id: string
          message: string
          order_run_id: string
          session_id: string | null
          severity: string
          student_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          details?: Json
          dish_id?: string | null
          dish_variant_id?: string | null
          id?: string
          message: string
          order_run_id: string
          session_id?: string | null
          severity: string
          student_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          details?: Json
          dish_id?: string | null
          dish_variant_id?: string | null
          id?: string
          message?: string
          order_run_id?: string
          session_id?: string | null
          severity?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_allocation_issues_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_issues_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      order_allocations: {
        Row: {
          created_at: string
          dietary_tag_codes: string[]
          dish_id: string | null
          dish_variant_id: string | null
          id: string
          order_run_id: string
          reason_codes: string[]
          session_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dietary_tag_codes?: string[]
          dish_id?: string | null
          dish_variant_id?: string | null
          id?: string
          order_run_id: string
          reason_codes?: string[]
          session_id: string
          status: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dietary_tag_codes?: string[]
          dish_id?: string | null
          dish_variant_id?: string | null
          id?: string
          order_run_id?: string
          reason_codes?: string[]
          session_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_allocations_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      order_communication_events: {
        Row: {
          actor_name: string
          communication_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          reason: string
        }
        Insert: {
          actor_name: string
          communication_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          reason: string
        }
        Update: {
          actor_name?: string
          communication_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["revised_communication_id"]
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_communication_id"]
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communication_recipients"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "order_communications"
            referencedColumns: ["id"]
          },
        ]
      }
      order_communication_recipients: {
        Row: {
          caterer_contact_id: string | null
          cc_preference: string | null
          communication_id: string
          created_at: string
          display_name: string | null
          email: string
          id: string
          recipient_type: string
          role: string | null
        }
        Insert: {
          caterer_contact_id?: string | null
          cc_preference?: string | null
          communication_id: string
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          recipient_type: string
          role?: string | null
        }
        Update: {
          caterer_contact_id?: string | null
          cc_preference?: string | null
          communication_id?: string
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          recipient_type?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_communication_recipients_caterer_contact_id_fkey"
            columns: ["caterer_contact_id"]
            isOneToOne: false
            referencedRelation: "caterer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communication_recipients_caterer_contact_id_fkey"
            columns: ["caterer_contact_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["revised_communication_id"]
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_communication_id"]
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communication_recipients"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "order_communication_recipients_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "order_communications"
            referencedColumns: ["id"]
          },
        ]
      }
      order_communications: {
        Row: {
          body: string
          caterer_id: string
          communication_kind: string
          created_at: string
          created_by: string
          delivery_note_text: string
          exception_resolution_id: string | null
          exported_at: string
          exported_by: string
          id: string
          in_reply_to_message_id: string | null
          order_run_id: string
          outbound_message_id: string | null
          reference_message_ids: string[]
          rendered_text: string
          source_reply_id: string | null
          status: string
          subject: string
          template_version: string
        }
        Insert: {
          body: string
          caterer_id: string
          communication_kind?: string
          created_at?: string
          created_by: string
          delivery_note_text: string
          exception_resolution_id?: string | null
          exported_at?: string
          exported_by: string
          id?: string
          in_reply_to_message_id?: string | null
          order_run_id: string
          outbound_message_id?: string | null
          reference_message_ids?: string[]
          rendered_text: string
          source_reply_id?: string | null
          status?: string
          subject: string
          template_version: string
        }
        Update: {
          body?: string
          caterer_id?: string
          communication_kind?: string
          created_at?: string
          created_by?: string
          delivery_note_text?: string
          exception_resolution_id?: string | null
          exported_at?: string
          exported_by?: string
          id?: string
          in_reply_to_message_id?: string | null
          order_run_id?: string
          outbound_message_id?: string | null
          reference_message_ids?: string[]
          rendered_text?: string
          source_reply_id?: string | null
          status?: string
          subject?: string
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_exception_resolution_id_fkey"
            columns: ["exception_resolution_id"]
            isOneToOne: false
            referencedRelation: "autopilot_exception_resolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communications_exception_resolution_id_fkey"
            columns: ["exception_resolution_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["latest_resolution_id"]
          },
          {
            foreignKeyName: "order_communications_exception_resolution_id_fkey"
            columns: ["exception_resolution_id"]
            isOneToOne: false
            referencedRelation: "operator_exception_resolutions"
            referencedColumns: ["resolution_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communications_source_reply_id_fkey"
            columns: ["source_reply_id"]
            isOneToOne: false
            referencedRelation: "caterer_reply_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communications_source_reply_id_fkey"
            columns: ["source_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["caterer_reply_id"]
          },
          {
            foreignKeyName: "order_communications_source_reply_id_fkey"
            columns: ["source_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["reply_id"]
          },
        ]
      }
      order_lines: {
        Row: {
          created_at: string
          dish_id: string
          dish_variant_id: string
          gst_inclusive: boolean
          id: string
          line_total_cents: number
          order_run_id: string
          quantity: number
          session_id: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          dish_variant_id: string
          gst_inclusive: boolean
          id?: string
          line_total_cents: number
          order_run_id: string
          quantity: number
          session_id: string
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          dish_variant_id?: string
          gst_inclusive?: boolean
          id?: string
          line_total_cents?: number
          order_run_id?: string
          quantity?: number
          session_id?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_lines_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_lines_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_lines_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_runs: {
        Row: {
          algorithm_version: string
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          input_snapshot: Json
          issue_count: number
          service_week_end: string
          service_week_start: string
          status: string
          updated_at: string
        }
        Insert: {
          algorithm_version?: string
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          input_snapshot?: Json
          issue_count?: number
          service_week_end: string
          service_week_start: string
          status: string
          updated_at?: string
        }
        Update: {
          algorithm_version?: string
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          input_snapshot?: Json
          issue_count?: number
          service_week_end?: string
          service_week_start?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      preference_tags: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string
          is_active: boolean
          label: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description: string
          is_active?: boolean
          label: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      school_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          school_id: string
          source: string | null
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          school_id: string
          source?: string | null
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          school_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_aliases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_aliases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          canonical_name: string
          created_at: string
          id: string
          region: string | null
          short_code: string
          updated_at: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          id?: string
          region?: string | null
          short_code: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          id?: string
          region?: string | null
          short_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_catering_feedback: {
        Row: {
          caterer_id: string | null
          created_at: string
          delivery_status: string | null
          food_quality_rating: number | null
          id: string
          issue_tags: string[]
          leftover_level: string | null
          manager_notes: string | null
          metadata: Json
          session_id: string
          source: string
        }
        Insert: {
          caterer_id?: string | null
          created_at?: string
          delivery_status?: string | null
          food_quality_rating?: number | null
          id?: string
          issue_tags?: string[]
          leftover_level?: string | null
          manager_notes?: string | null
          metadata?: Json
          session_id: string
          source: string
        }
        Update: {
          caterer_id?: string | null
          created_at?: string
          delivery_status?: string | null
          food_quality_rating?: number | null
          id?: string
          issue_tags?: string[]
          leftover_level?: string | null
          manager_notes?: string | null
          metadata?: Json
          session_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_catering_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_enrolments: {
        Row: {
          created_at: string
          session_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          session_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_enrolments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_enrolments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_enrolments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_enrolments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "session_enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "session_enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "session_enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          building: string | null
          caterer_id: string
          created_at: string
          dinner_time: string | null
          dinner_time_raw: string | null
          end_time: string | null
          end_time_raw: string | null
          id: string
          manager_mobile: string | null
          manager_name: string | null
          room: string | null
          school_id: string
          session_date: string
          start_time: string | null
          start_time_raw: string | null
          updated_at: string
          year_levels: number[]
        }
        Insert: {
          building?: string | null
          caterer_id: string
          created_at?: string
          dinner_time?: string | null
          dinner_time_raw?: string | null
          end_time?: string | null
          end_time_raw?: string | null
          id?: string
          manager_mobile?: string | null
          manager_name?: string | null
          room?: string | null
          school_id: string
          session_date: string
          start_time?: string | null
          start_time_raw?: string | null
          updated_at?: string
          year_levels: number[]
        }
        Update: {
          building?: string | null
          caterer_id?: string
          created_at?: string
          dinner_time?: string | null
          dinner_time_raw?: string | null
          end_time?: string | null
          end_time_raw?: string | null
          id?: string
          manager_mobile?: string | null
          manager_name?: string | null
          room?: string | null
          school_id?: string
          session_date?: string
          start_time?: string | null
          start_time_raw?: string | null
          updated_at?: string
          year_levels?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_dietary_tags: {
        Row: {
          created_at: string
          student_id: string
          tag_code: string
        }
        Insert: {
          created_at?: string
          student_id: string
          tag_code: string
        }
        Update: {
          created_at?: string
          student_id?: string
          tag_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_dietary_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_dietary_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_dietary_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_dietary_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_dietary_tags_tag_code_fkey"
            columns: ["tag_code"]
            isOneToOne: false
            referencedRelation: "dietary_tags"
            referencedColumns: ["code"]
          },
        ]
      }
      student_dietary_warnings: {
        Row: {
          created_at: string
          id: string
          raw_value: string
          resolved_at: string | null
          resolved_note: string | null
          resolved_tag_codes: string[] | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          raw_value: string
          resolved_at?: string | null
          resolved_note?: string | null
          resolved_tag_codes?: string[] | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          raw_value?: string
          resolved_at?: string | null
          resolved_note?: string | null
          resolved_tag_codes?: string[] | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_dietary_warnings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_dietary_warnings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_dietary_warnings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_dietary_warnings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fit_debt: {
        Row: {
          created_at: string
          decayed_from_previous: number | null
          fit_debt_score: number
          id: string
          reason: string | null
          service_week_start: string
          student_id: string
        }
        Insert: {
          created_at?: string
          decayed_from_previous?: number | null
          fit_debt_score?: number
          id?: string
          reason?: string | null
          service_week_start: string
          student_id: string
        }
        Update: {
          created_at?: string
          decayed_from_previous?: number | null
          fit_debt_score?: number
          id?: string
          reason?: string | null
          service_week_start?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fit_debt_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_fit_debt_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_fit_debt_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_fit_debt_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_meal_feedback: {
        Row: {
          created_at: string
          dish_variant_id: string | null
          free_text: string | null
          id: string
          liked: boolean | null
          metadata: Json
          order_allocation_id: string | null
          rating: number | null
          requested_food: string | null
          session_id: string | null
          source: string
          student_id: string
        }
        Insert: {
          created_at?: string
          dish_variant_id?: string | null
          free_text?: string | null
          id?: string
          liked?: boolean | null
          metadata?: Json
          order_allocation_id?: string | null
          rating?: number | null
          requested_food?: string | null
          session_id?: string | null
          source: string
          student_id: string
        }
        Update: {
          created_at?: string
          dish_variant_id?: string | null
          free_text?: string | null
          id?: string
          liked?: boolean | null
          metadata?: Json
          order_allocation_id?: string | null
          rating?: number | null
          requested_food?: string | null
          session_id?: string | null
          source?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_meal_feedback_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_meal_feedback_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "operator_meal_fit_signals"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "order_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_meal_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_meal_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_meal_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_preference_signals: {
        Row: {
          affinity_score: number
          confidence: number
          created_at: string
          feedback_count: number
          id: string
          last_observed_at: string | null
          student_id: string
          tag_code: string
          updated_at: string
        }
        Insert: {
          affinity_score: number
          confidence: number
          created_at?: string
          feedback_count?: number
          id?: string
          last_observed_at?: string | null
          student_id: string
          tag_code: string
          updated_at?: string
        }
        Update: {
          affinity_score?: number
          confidence?: number
          created_at?: string
          feedback_count?: number
          id?: string
          last_observed_at?: string | null
          student_id?: string
          tag_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_preference_signals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_preference_signals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_preference_signals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_preference_signals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_preference_signals_tag_code_fkey"
            columns: ["tag_code"]
            isOneToOne: false
            referencedRelation: "preference_tags"
            referencedColumns: ["code"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          dietary_raw: string | null
          full_name: string
          id: string
          opted_out: boolean
          parent_email: string | null
          parent_mobile: string | null
          parent_name: string | null
          school_id: string
          source_file: string | null
          source_row: Json | null
          student_email: string | null
          subjects_raw: string | null
          updated_at: string
          year_level: number
        }
        Insert: {
          created_at?: string
          dietary_raw?: string | null
          full_name: string
          id?: string
          opted_out?: boolean
          parent_email?: string | null
          parent_mobile?: string | null
          parent_name?: string | null
          school_id: string
          source_file?: string | null
          source_row?: Json | null
          student_email?: string | null
          subjects_raw?: string | null
          updated_at?: string
          year_level: number
        }
        Update: {
          created_at?: string
          dietary_raw?: string | null
          full_name?: string
          id?: string
          opted_out?: boolean
          parent_email?: string | null
          parent_mobile?: string | null
          parent_name?: string | null
          school_id?: string
          source_file?: string | null
          source_row?: Json | null
          student_email?: string | null
          subjects_raw?: string | null
          updated_at?: string
          year_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      operator_ai_interpretations: {
        Row: {
          ai_interpretation_id: string | null
          autopilot_exception_id: string | null
          caterer_reply_id: string | null
          confidence: number | null
          created_at: string | null
          exception_title: string | null
          exception_week_start: string | null
          input_hash: string | null
          metadata: Json | null
          model: string | null
          needs_human_review: boolean | null
          parsed_output: Json | null
          prompt_version: string | null
          provider: string | null
          purpose: string | null
          reply_caterer_id: string | null
          reply_caterer_name: string | null
          schema_version: string | null
          session_catering_feedback_id: string | null
          student_meal_feedback_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interpretations_autopilot_exception_id_fkey"
            columns: ["autopilot_exception_id"]
            isOneToOne: false
            referencedRelation: "autopilot_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interpretations_autopilot_exception_id_fkey"
            columns: ["autopilot_exception_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["exception_id"]
          },
          {
            foreignKeyName: "ai_interpretations_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "caterer_reply_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interpretations_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["caterer_reply_id"]
          },
          {
            foreignKeyName: "ai_interpretations_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["reply_id"]
          },
          {
            foreignKeyName: "ai_interpretations_session_catering_feedback_id_fkey"
            columns: ["session_catering_feedback_id"]
            isOneToOne: false
            referencedRelation: "session_catering_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interpretations_student_meal_feedback_id_fkey"
            columns: ["student_meal_feedback_id"]
            isOneToOne: false
            referencedRelation: "student_meal_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["reply_caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
        ]
      }
      operator_audit_events: {
        Row: {
          action: string | null
          actor_name: string | null
          after_state: Json | null
          audit_id: string | null
          before_state: Json | null
          created_at: string | null
          display_action: string | null
          entity_id: string | null
          entity_type: string | null
          order_run_id: string | null
          reason: string | null
        }
        Insert: {
          action?: string | null
          actor_name?: string | null
          after_state?: Json | null
          audit_id?: string | null
          before_state?: Json | null
          created_at?: string | null
          display_action?: never
          entity_id?: string | null
          entity_type?: string | null
          order_run_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string | null
          actor_name?: string | null
          after_state?: Json | null
          audit_id?: string | null
          before_state?: Json | null
          created_at?: string | null
          display_action?: never
          entity_id?: string | null
          entity_type?: string | null
          order_run_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "audit_log_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_automation_job_events: {
        Row: {
          counters: Json | null
          created_at: string | null
          detail: string | null
          event_id: string | null
          event_type: string | null
          job_id: string | null
          progress_percent: number | null
          stage_code: string | null
          stage_label: string | null
        }
        Insert: {
          counters?: Json | null
          created_at?: string | null
          detail?: string | null
          event_id?: string | null
          event_type?: string | null
          job_id?: string | null
          progress_percent?: number | null
          stage_code?: string | null
          stage_label?: string | null
        }
        Update: {
          counters?: Json | null
          created_at?: string | null
          detail?: string | null
          event_id?: string | null
          event_type?: string | null
          job_id?: string | null
          progress_percent?: number | null
          stage_code?: string | null
          stage_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_job_events_automation_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_job_events_automation_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "operator_automation_jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      operator_automation_jobs: {
        Row: {
          actor_name: string | null
          attempt_count: number | null
          completed_at: string | null
          counters: Json | null
          created_at: string | null
          current_stage: string | null
          error_detail: string | null
          job_id: string | null
          job_type: string | null
          linked_autopilot_run_id: string | null
          max_attempts: number | null
          progress_percent: number | null
          result: Json | null
          stage_label: string | null
          started_at: string | null
          status: string | null
          trigger_source: string | null
          updated_at: string | null
          week_start: string | null
        }
        Insert: {
          actor_name?: string | null
          attempt_count?: number | null
          completed_at?: string | null
          counters?: Json | null
          created_at?: string | null
          current_stage?: string | null
          error_detail?: string | null
          job_id?: string | null
          job_type?: string | null
          linked_autopilot_run_id?: string | null
          max_attempts?: number | null
          progress_percent?: number | null
          result?: Json | null
          stage_label?: string | null
          started_at?: string | null
          status?: string | null
          trigger_source?: string | null
          updated_at?: string | null
          week_start?: never
        }
        Update: {
          actor_name?: string | null
          attempt_count?: number | null
          completed_at?: string | null
          counters?: Json | null
          created_at?: string | null
          current_stage?: string | null
          error_detail?: string | null
          job_id?: string | null
          job_type?: string | null
          linked_autopilot_run_id?: string | null
          max_attempts?: number | null
          progress_percent?: number | null
          result?: Json | null
          stage_label?: string | null
          started_at?: string | null
          status?: string | null
          trigger_source?: string | null
          updated_at?: string | null
          week_start?: never
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_linked_autopilot_run_id_fkey"
            columns: ["linked_autopilot_run_id"]
            isOneToOne: false
            referencedRelation: "autopilot_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_linked_autopilot_run_id_fkey"
            columns: ["linked_autopilot_run_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_status"
            referencedColumns: ["autopilot_run_id"]
          },
        ]
      }
      operator_automation_schedule: {
        Row: {
          daytime_end: string | null
          daytime_interval_seconds: number | null
          daytime_start: string | null
          enabled: boolean | null
          last_checked_at: string | null
          last_error: string | null
          last_job_id: string | null
          last_result: Json | null
          last_success_at: string | null
          next_check_at: string | null
          overnight_interval_seconds: number | null
          schedule_key: string | null
          timezone: string | null
          updated_at: string | null
          worker_heartbeat_at: string | null
        }
        Insert: {
          daytime_end?: string | null
          daytime_interval_seconds?: number | null
          daytime_start?: string | null
          enabled?: boolean | null
          last_checked_at?: string | null
          last_error?: string | null
          last_job_id?: string | null
          last_result?: Json | null
          last_success_at?: string | null
          next_check_at?: string | null
          overnight_interval_seconds?: number | null
          schedule_key?: string | null
          timezone?: string | null
          updated_at?: string | null
          worker_heartbeat_at?: string | null
        }
        Update: {
          daytime_end?: string | null
          daytime_interval_seconds?: number | null
          daytime_start?: string | null
          enabled?: boolean | null
          last_checked_at?: string | null
          last_error?: string | null
          last_job_id?: string | null
          last_result?: Json | null
          last_success_at?: string | null
          next_check_at?: string | null
          overnight_interval_seconds?: number | null
          schedule_key?: string | null
          timezone?: string | null
          updated_at?: string | null
          worker_heartbeat_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_schedules_last_job_id_fkey"
            columns: ["last_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_schedules_last_job_id_fkey"
            columns: ["last_job_id"]
            isOneToOne: false
            referencedRelation: "operator_automation_jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      operator_autopilot_exceptions: {
        Row: {
          ai_confidence: number | null
          autopilot_run_id: string | null
          category: string | null
          caterer_id: string | null
          caterer_name: string | null
          caterer_reply_id: string | null
          complete_interpreted_summary: string | null
          created_at: string | null
          detail: string | null
          deterministic_block_reason: string | null
          dish_variant_id: string | null
          dish_variant_name: string | null
          exception_id: string | null
          latest_resolution_id: string | null
          metadata: Json | null
          order_run_id: string | null
          original_reply_body: string | null
          recommended_action: string | null
          resolution_message_text: string | null
          resolution_status: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_by_name: string | null
          resolved_note: string | null
          resulting_communication_id: string | null
          resulting_order_run_id: string | null
          school_name: string | null
          session_date: string | null
          session_id: string | null
          severity: string | null
          status: string | null
          student_id: string | null
          student_name: string | null
          title: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["revised_communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communication_recipients"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "order_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_autopilot_run_id_fkey"
            columns: ["autopilot_run_id"]
            isOneToOne: false
            referencedRelation: "autopilot_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_autopilot_run_id_fkey"
            columns: ["autopilot_run_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_status"
            referencedColumns: ["autopilot_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "autopilot_exceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_autopilot_status: {
        Row: {
          ai_interpretation_count: number | null
          autopilot_run_id: string | null
          blocking_exception_count: number | null
          communication_count: number | null
          completed_at: string | null
          emails_prepared_count: number | null
          emails_sent_count: number | null
          exception_count: number | null
          failed_communication_count: number | null
          generated_order_run_id: string | null
          idempotency_key: string | null
          metadata: Json | null
          open_exception_count: number | null
          requires_human_review: boolean | null
          sent_communication_count: number | null
          started_at: string | null
          status: string | null
          summary: string | null
          trigger_source: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_runs_generated_order_run_id_fkey"
            columns: ["generated_order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_caterer_detail: {
        Row: {
          assigned_school_count: number | null
          assigned_schools: Json | null
          available_variant_count: number | null
          caterer_id: string | null
          caterer_name: string | null
          contact_count: number | null
          contacts: Json | null
          delivery_fee: number | null
          delivery_notes: string | null
          delivery_scope: string | null
          dish_count: number | null
          gst_inclusive: boolean | null
          gst_rate_percent: number | null
          latest_communication: Json | null
          latest_order_lines: Json | null
          latest_order_totals: Json | null
          menu_summary: Json | null
          per_item_price: number | null
          region: string | null
          reviewed_variant_count: number | null
          unreviewed_variant_count: number | null
          variant_count: number | null
          weekly_minimums: Json | null
        }
        Relationships: []
      }
      operator_caterer_feedback_performance: {
        Row: {
          average_student_rating: number | null
          caterer_id: string | null
          caterer_name: string | null
          latest_quality_event_at: string | null
          low_student_rating_count: number | null
          manager_feedback_count: number | null
          manager_issue_count: number | null
          manager_positive_count: number | null
          quality_event_count: number | null
          review_quality_event_count: number | null
          serious_quality_event_count: number | null
          student_feedback_count: number | null
        }
        Relationships: []
      }
      operator_caterer_quality_signals: {
        Row: {
          caterer_id: string | null
          caterer_name: string | null
          latest_event_at: string | null
          quality_event_count: number | null
          recent_events: Json | null
          review_event_count: number | null
          serious_event_count: number | null
        }
        Relationships: []
      }
      operator_caterer_replies: {
        Row: {
          ai_interpretation_id: string | null
          ai_model: string | null
          ai_needs_human_review: boolean | null
          ai_parsed_output: Json | null
          ai_prompt_version: string | null
          caterer_id: string | null
          caterer_name: string | null
          communication_id: string | null
          complete_interpreted_summary: string | null
          confidence: number | null
          created_at: string | null
          deterministic_block_reason: string | null
          exception_detail: string | null
          exception_status: string | null
          from_email: string | null
          handled_at: string | null
          handled_status: string | null
          handling_summary: string | null
          in_reply_to_message_id: string | null
          linked_outbound_message_id: string | null
          metadata: Json | null
          order_run_id: string | null
          original_reply_body: string | null
          parsed_intent: string | null
          provider: string | null
          provider_message_id: string | null
          provider_thread_id: string | null
          received_at: string | null
          recommended_action: string | null
          reference_message_ids: string[] | null
          reply_id: string | null
          resolution_message_text: string | null
          resolution_status: string | null
          revised_communication_id: string | null
          revised_email_state: string | null
          revised_outbound_message_id: string | null
          revised_parent_message_id: string | null
          revised_reference_message_ids: string[] | null
          revised_thread_status: string | null
          subject: string | null
          updated_at: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caterer_reply_intake_ai_interpretation_id_fkey"
            columns: ["ai_interpretation_id"]
            isOneToOne: false
            referencedRelation: "ai_interpretations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_ai_interpretation_id_fkey"
            columns: ["ai_interpretation_id"]
            isOneToOne: false
            referencedRelation: "operator_ai_interpretations"
            referencedColumns: ["ai_interpretation_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["revised_communication_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_communication_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communication_recipients"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "order_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "caterer_reply_intake_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_caterers: {
        Row: {
          assigned_school_count: number | null
          assigned_school_names: string[] | null
          available_variant_count: number | null
          caterer_id: string | null
          caterer_name: string | null
          communication_event_count: number | null
          contact_count: number | null
          delivery_fee: number | null
          delivery_notes: string | null
          delivery_scope: string | null
          dish_count: number | null
          email_state: string | null
          exported_at: string | null
          exported_by: string | null
          gst_inclusive: boolean | null
          gst_rate_percent: number | null
          latest_communication_event_at: string | null
          latest_communication_id: string | null
          latest_order_line_count: number | null
          latest_order_quantity: number | null
          latest_order_run_id: string | null
          latest_order_run_status: string | null
          latest_order_total: number | null
          latest_order_week_start: string | null
          per_item_price: number | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_role: string | null
          region: string | null
          reviewed_variant_count: number | null
          unreviewed_variant_count: number | null
          valid_offer_counts: number[] | null
          variant_count: number | null
          weekly_minimum_tiers: Json | null
        }
        Relationships: []
      }
      operator_communication_events: {
        Row: {
          actor_name: string | null
          caterer_id: string | null
          caterer_name: string | null
          communication_id: string | null
          created_at: string | null
          error: string | null
          event_id: string | null
          event_type: string | null
          metadata: Json | null
          order_run_id: string | null
          provider: string | null
          reason: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["revised_communication_id"]
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_communication_id"]
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communication_recipients"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "order_communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "order_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_communication_recipients: {
        Row: {
          caterer_contact_id: string | null
          caterer_id: string | null
          caterer_name: string | null
          cc_preference: string | null
          communication_id: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          order_run_id: string | null
          recipient_id: string | null
          recipient_type: string | null
          role: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_communication_recipients_caterer_contact_id_fkey"
            columns: ["caterer_contact_id"]
            isOneToOne: false
            referencedRelation: "caterer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communication_recipients_caterer_contact_id_fkey"
            columns: ["caterer_contact_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_communications_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_communications: {
        Row: {
          body: string | null
          caterer_id: string | null
          caterer_name: string | null
          communication_id: string | null
          delivery_note_text: string | null
          email_state: string | null
          event_count: number | null
          exported_at: string | null
          exported_by: string | null
          in_reply_to_message_id: string | null
          issue_count: number | null
          latest_event_at: string | null
          latest_send_actor_name: string | null
          latest_send_error: string | null
          latest_send_event_at: string | null
          latest_send_event_id: string | null
          latest_send_event_type: string | null
          latest_send_metadata: Json | null
          latest_send_provider: string | null
          line_count: number | null
          order_run_id: string | null
          order_run_status: string | null
          outbound_message_id: string | null
          reference_message_ids: string[] | null
          rendered_text: string | null
          subject: string | null
          template_version: string | null
          thread_status: string | null
          total_quantity: number | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_current_week: {
        Row: {
          latest_order_run_id: string | null
          latest_order_run_status: string | null
          session_count: number | null
          week_end: string | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_exception_resolution_options: {
        Row: {
          caterer_id: string | null
          dish_variant_id: string | null
          display_name: string | null
          exception_id: string | null
          is_available: boolean | null
          is_current_order_item: boolean | null
          is_operator_reviewed: boolean | null
          order_run_id: string | null
        }
        Relationships: []
      }
      operator_exception_resolutions: {
        Row: {
          ai_interpretation_id: string | null
          applied_at: string | null
          applied_by: string | null
          applied_by_name: string | null
          caterer_reply_id: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          edited_action: Json | null
          exception_id: string | null
          failure_detail: string | null
          final_message_text: string | null
          operator_instruction: string | null
          proposed_action: Json | null
          proposed_message_text: string | null
          resolution_id: string | null
          resulting_communication_id: string | null
          resulting_order_run_id: string | null
          source_order_run_id: string | null
          status: string | null
          updated_at: string | null
          validation_report: Json | null
        }
        Insert: {
          ai_interpretation_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          applied_by_name?: string | null
          caterer_reply_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          edited_action?: Json | null
          exception_id?: string | null
          failure_detail?: string | null
          final_message_text?: string | null
          operator_instruction?: string | null
          proposed_action?: Json | null
          proposed_message_text?: string | null
          resolution_id?: string | null
          resulting_communication_id?: string | null
          resulting_order_run_id?: string | null
          source_order_run_id?: string | null
          status?: string | null
          updated_at?: string | null
          validation_report?: Json | null
        }
        Update: {
          ai_interpretation_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          applied_by_name?: string | null
          caterer_reply_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          edited_action?: Json | null
          exception_id?: string | null
          failure_detail?: string | null
          final_message_text?: string | null
          operator_instruction?: string | null
          proposed_action?: Json | null
          proposed_message_text?: string | null
          resolution_id?: string | null
          resulting_communication_id?: string | null
          resulting_order_run_id?: string | null
          source_order_run_id?: string | null
          status?: string | null
          updated_at?: string | null
          validation_report?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_exception_resolutions_ai_interpretation_id_fkey"
            columns: ["ai_interpretation_id"]
            isOneToOne: false
            referencedRelation: "ai_interpretations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_ai_interpretation_id_fkey"
            columns: ["ai_interpretation_id"]
            isOneToOne: false
            referencedRelation: "operator_ai_interpretations"
            referencedColumns: ["ai_interpretation_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "caterer_reply_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["caterer_reply_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_caterer_reply_id_fkey"
            columns: ["caterer_reply_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["reply_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "autopilot_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "operator_autopilot_exceptions"
            referencedColumns: ["exception_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_replies"
            referencedColumns: ["revised_communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communication_recipients"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_communication_id_fkey"
            columns: ["resulting_communication_id"]
            isOneToOne: false
            referencedRelation: "order_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_resulting_order_run_id_fkey"
            columns: ["resulting_order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "autopilot_exception_resolutions_source_order_run_id_fkey"
            columns: ["source_order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_feedback_events: {
        Row: {
          caterer_id: string | null
          caterer_name: string | null
          created_at: string | null
          delivery_status: string | null
          dish_variant_id: string | null
          dish_variant_name: string | null
          feedback_id: string | null
          feedback_type: string | null
          free_text: string | null
          issue_tags: string[] | null
          leftover_level: string | null
          liked: boolean | null
          metadata: Json | null
          rating: number | null
          requested_food: string | null
          school_name: string | null
          session_date: string | null
          session_id: string | null
          source: string | null
          student_id: string | null
          student_name: string | null
        }
        Relationships: []
      }
      operator_feedback_overview: {
        Row: {
          average_student_rating: number | null
          failed_request_count: number | null
          low_student_rating_count: number | null
          manager_feedback_count: number | null
          manager_issue_count: number | null
          manager_positive_count: number | null
          quality_event_count: number | null
          request_count: number | null
          requested_food_count: number | null
          review_quality_event_count: number | null
          sent_request_count: number | null
          serious_quality_event_count: number | null
          student_feedback_count: number | null
          submitted_request_count: number | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_feedback_requests: {
        Row: {
          audience: string | null
          caterer_id: string | null
          caterer_name: string | null
          created_at: string | null
          dinner_time: string | null
          eligible_at: string | null
          email_to: string | null
          expires_at: string | null
          last_error: string | null
          manager_name: string | null
          metadata: Json | null
          order_allocation_id: string | null
          order_run_id: string | null
          request_id: string | null
          response_session_feedback_id: string | null
          response_student_feedback_id: string | null
          school_name: string | null
          send_count: number | null
          sent_at: string | null
          session_date: string | null
          session_id: string | null
          status: string | null
          student_id: string | null
          student_name: string | null
          submitted_at: string | null
          updated_at: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "caterers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_detail"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_feedback_performance"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterer_quality_signals"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_contacts"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_caterer_id_fkey"
            columns: ["caterer_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["caterer_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "operator_meal_fit_signals"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_allocation_id_fkey"
            columns: ["order_allocation_id"]
            isOneToOne: false
            referencedRelation: "order_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "feedback_requests_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_response_session_feedback_id_fkey"
            columns: ["response_session_feedback_id"]
            isOneToOne: false
            referencedRelation: "session_catering_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_response_student_feedback_id_fkey"
            columns: ["response_student_feedback_id"]
            isOneToOne: false
            referencedRelation: "student_meal_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "feedback_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "feedback_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "feedback_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_feedback_weekly_trends: {
        Row: {
          failed_count: number | null
          request_count: number | null
          response_rate_percent: number | null
          submitted_count: number | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_manual_overrides: {
        Row: {
          actor_name: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          manual_override_id: string | null
          order_run_id: string | null
          override_type: string | null
          reason: string | null
        }
        Insert: {
          actor_name?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          manual_override_id?: string | null
          order_run_id?: string | null
          override_type?: string | null
          reason?: string | null
        }
        Update: {
          actor_name?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          manual_override_id?: string | null
          order_run_id?: string | null
          override_type?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "manual_overrides_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_meal_fit_signals: {
        Row: {
          allocation_id: string | null
          chosen_dish_variant_id: string | null
          chosen_display_name: string | null
          chosen_score: number | null
          constrained_by: string[] | null
          created_at: string | null
          explanation: string | null
          fit_debt_applied: number | null
          latest_fit_debt_reason: string | null
          latest_fit_debt_score: number | null
          negative_factors: Json | null
          novelty_applied: number | null
          order_run_id: string | null
          positive_factors: Json | null
          preference_signals: Json | null
          school_id: string | null
          school_name: string | null
          scoring_version: string | null
          session_date: string | null
          session_id: string | null
          student_id: string | null
          student_name: string | null
          top_feasible_display_name: string | null
          top_feasible_score: number | null
          top_feasible_variant_id: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_allocation_fit_explanations_scoring_version_fkey"
            columns: ["scoring_version"]
            isOneToOne: false
            referencedRelation: "meal_fit_scoring_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_top_feasible_variant_id_fkey"
            columns: ["top_feasible_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_top_feasible_variant_id_fkey"
            columns: ["top_feasible_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_top_feasible_variant_id_fkey"
            columns: ["top_feasible_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocation_fit_explanations_top_feasible_variant_id_fkey"
            columns: ["top_feasible_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey"
            columns: ["chosen_dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey"
            columns: ["chosen_dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey"
            columns: ["chosen_dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocations_dish_variant_id_fkey"
            columns: ["chosen_dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_menu_setup: {
        Row: {
          caterer_id: string | null
          caterer_name: string | null
          contains_beef: boolean | null
          contains_fish: boolean | null
          contains_pork: boolean | null
          contains_red_meat: boolean | null
          contains_shellfish: boolean | null
          current_selected_count: number | null
          dish_id: string | null
          dish_name: string | null
          dish_name_raw: string | null
          display_name: string | null
          has_no_declared_tags: boolean | null
          ingredient_flags_source: string | null
          ingredient_notes: string | null
          is_available: boolean | null
          is_dairy_free: boolean | null
          is_default: boolean | null
          is_gluten_free: boolean | null
          is_halal_inferred: boolean | null
          is_nut_free: boolean | null
          is_offered: boolean | null
          is_vegetarian_option: boolean | null
          menu_offer_id: string | null
          offer_notes: string | null
          operator_reviewed: boolean | null
          selected_at: string | null
          selected_by: string | null
          selected_minimum_meals: number | null
          tags_review_reason: string | null
          tags_reviewed_at: string | null
          tags_reviewed_by: string | null
          valid_offer_counts: number[] | null
          variant_id: string | null
          variant_name: string | null
          week_end: string | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_order_run_allocations: {
        Row: {
          allocation_id: string | null
          allocation_status: string | null
          dietary_tags: string[] | null
          dish_variant_id: string | null
          display_name: string | null
          issue_count: number | null
          order_run_id: string | null
          school_name: string | null
          session_date: string | null
          session_id: string | null
          student_id: string | null
          student_name: string | null
          year_level: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocations_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_order_run_contacts: {
        Row: {
          caterer_id: string | null
          caterer_name: string | null
          contact_id: string | null
          contact_name: string | null
          contact_role: string | null
          delivery_notes: string | null
          email: string | null
          order_run_id: string | null
          recipient_kind: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_order_run_issues: {
        Row: {
          category: string | null
          dish_variant_id: string | null
          issue_id: string | null
          message: string | null
          order_run_id: string | null
          session_id: string | null
          severity: string | null
          student_id: string | null
        }
        Insert: {
          category?: string | null
          dish_variant_id?: string | null
          issue_id?: string | null
          message?: string | null
          order_run_id?: string | null
          session_id?: string | null
          severity?: string | null
          student_id?: string | null
        }
        Update: {
          category?: string | null
          dish_variant_id?: string | null
          issue_id?: string | null
          message?: string | null
          order_run_id?: string | null
          session_id?: string | null
          severity?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "dish_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_menu_setup"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_dish_variant_id_fkey"
            columns: ["dish_variant_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["dish_variant_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_lines"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_order_run_allocations"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "order_allocation_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_order_run_lines: {
        Row: {
          caterer_id: string | null
          caterer_name: string | null
          dish_variant_id: string | null
          display_name: string | null
          line_total: number | null
          order_line_id: string | null
          order_run_id: string | null
          quantity: number | null
          school_name: string | null
          session_date: string | null
          session_id: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_caterers"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_communications"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_current_week"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_order_runs"
            referencedColumns: ["order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_student_detail"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_students"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_week_status"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "operator_weeks"
            referencedColumns: ["latest_order_run_id"]
          },
          {
            foreignKeyName: "order_lines_order_run_id_fkey"
            columns: ["order_run_id"]
            isOneToOne: false
            referencedRelation: "order_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_order_runs: {
        Row: {
          allocation_count: number | null
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          exported_caterer_count: number | null
          generated_at: string | null
          generated_by: string | null
          is_latest: boolean | null
          issue_count: number | null
          line_count: number | null
          order_run_id: string | null
          status: string | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_student_detail: {
        Row: {
          absence_count: number | null
          absences: Json | null
          audit_events: Json | null
          dietary_raw: string | null
          dietary_tag_details: Json | null
          dietary_tags: string[] | null
          dietary_warnings: Json | null
          enrolment_count: number | null
          enrolments: Json | null
          first_session_date: string | null
          last_session_date: string | null
          latest_allocated_count: number | null
          latest_allocation_count: number | null
          latest_allocation_statuses: string[] | null
          latest_allocations: Json | null
          latest_not_allocated_count: number | null
          latest_order_run_id: string | null
          latest_order_run_status: string | null
          latest_order_week_start: string | null
          manual_overrides: Json | null
          opted_out: boolean | null
          parent_email: string | null
          parent_mobile: string | null
          parent_name: string | null
          pending_warning_count: number | null
          school_id: string | null
          school_name: string | null
          source_file: string | null
          student_email: string | null
          student_id: string | null
          student_name: string | null
          subjects: string | null
          warning_count: number | null
          year_level: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_students: {
        Row: {
          absence_count: number | null
          dietary_raw: string | null
          dietary_tag_details: Json | null
          dietary_tags: string[] | null
          enrolment_count: number | null
          first_session_date: string | null
          last_session_date: string | null
          latest_allocated_count: number | null
          latest_allocation_count: number | null
          latest_allocation_statuses: string[] | null
          latest_not_allocated_count: number | null
          latest_order_run_id: string | null
          latest_order_run_status: string | null
          latest_order_week_start: string | null
          opted_out: boolean | null
          parent_email: string | null
          parent_mobile: string | null
          parent_name: string | null
          pending_warning_count: number | null
          school_id: string | null
          school_name: string | null
          source_file: string | null
          student_email: string | null
          student_id: string | null
          student_name: string | null
          subjects: string | null
          warning_count: number | null
          year_level: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "operator_week_sessions"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_validation_summary: {
        Row: {
          category: string | null
          caterer_id: string | null
          caterer_name: string | null
          finding_count: number | null
          severity: string | null
          summary: string | null
          target_route: string | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_week_sessions: {
        Row: {
          building: string | null
          cancelled_count: number | null
          caterer_id: string | null
          caterer_name: string | null
          enrolled_count: number | null
          export_state: string | null
          latest_order_line_count: number | null
          manager_mobile: string | null
          manager_name: string | null
          orderable_student_count: number | null
          school_id: string | null
          school_name: string | null
          session_date: string | null
          session_id: string | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_week_status: {
        Row: {
          approval_state: string | null
          blocking_issue_count: number | null
          export_state: string | null
          latest_order_run_id: string | null
          latest_order_run_status: string | null
          menu_offers_ready: boolean | null
          missing_offer_caterer_count: number | null
          source_data_ready: boolean | null
          unreviewed_variant_count: number | null
          validation_state: string | null
          variant_review_ready: boolean | null
          warning_count: number | null
          week_start: string | null
        }
        Relationships: []
      }
      operator_weeks: {
        Row: {
          allocation_issue_count: number | null
          approved_at: string | null
          caterer_count: number | null
          exported_caterer_count: number | null
          latest_order_run_id: string | null
          latest_order_run_status: string | null
          session_count: number | null
          student_count: number | null
          week_end: string | null
          week_start: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_automation_job: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: {
          actor_id: string | null
          actor_name: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          counters: Json
          created_at: string
          current_stage: string
          error_detail: string | null
          id: string
          idempotency_key: string
          job_type: string
          lease_expires_at: string | null
          lease_owner: string | null
          linked_autopilot_run_id: string | null
          max_attempts: number
          payload: Json
          progress_percent: number
          result: Json
          stage_label: string
          started_at: string | null
          status: string
          trigger_source: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      operator_approve_order_run: {
        Args: { p_order_run_id: string; p_reason: string }
        Returns: string
      }
      operator_create_dish_variant: {
        Args: {
          p_contains_beef: boolean
          p_contains_fish: boolean
          p_contains_pork: boolean
          p_contains_red_meat: boolean
          p_contains_shellfish: boolean
          p_dish_id: string
          p_ingredient_notes: string
          p_is_dairy_free: boolean
          p_is_gluten_free: boolean
          p_is_halal_inferred: boolean
          p_is_nut_free: boolean
          p_is_vegetarian_option: boolean
          p_reason: string
          p_variant_name: string
        }
        Returns: string
      }
      operator_record_caterer_email_preparation: {
        Args: { p_communication_id: string; p_reason: string }
        Returns: string
      }
      operator_record_manual_override: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_order_run_id: string
          p_override_type: string
          p_reason: string
        }
        Returns: string
      }
      operator_reopen_order_run: {
        Args: { p_order_run_id: string; p_reason: string }
        Returns: string
      }
      operator_review_dish_variant: {
        Args: {
          p_contains_beef: boolean
          p_contains_fish: boolean
          p_contains_pork: boolean
          p_contains_red_meat: boolean
          p_contains_shellfish: boolean
          p_dish_variant_id: string
          p_ingredient_notes: string
          p_is_dairy_free: boolean
          p_is_gluten_free: boolean
          p_is_halal_inferred: boolean
          p_is_nut_free: boolean
          p_is_vegetarian_option: boolean
          p_reason: string
        }
        Returns: string
      }
      operator_save_menu_offers: {
        Args: {
          p_caterer_id: string
          p_dish_variant_ids: string[]
          p_reason: string
          p_week_start: string
        }
        Returns: number
      }
      operator_update_dish_variant_availability: {
        Args: {
          p_dish_variant_id: string
          p_is_available: boolean
          p_reason: string
        }
        Returns: string
      }
    }
    Enums: {
      cc_preference: "cc" | "do_not_cc" | "unspecified"
      contact_role: "primary" | "secondary" | "chef" | "manager"
      dietary_tag_kind: "allergen" | "religious" | "preference"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cc_preference: ["cc", "do_not_cc", "unspecified"],
      contact_role: ["primary", "secondary", "chef", "manager"],
      dietary_tag_kind: ["allergen", "religious", "preference"],
    },
  },
} as const
