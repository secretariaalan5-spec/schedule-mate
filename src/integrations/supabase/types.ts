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
      appointments: {
        Row: {
          created_at: string
          date: string
          id: string
          patient_id: string
          printed: boolean
          reason: string | null
          schedule_time: string
          slot: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          patient_id: string
          printed?: boolean
          reason?: string | null
          schedule_time?: string
          slot: number
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          patient_id?: string
          printed?: boolean
          reason?: string | null
          schedule_time?: string
          slot?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      glucometer_loans: {
        Row: {
          created_at: string
          expected_return_date: string
          glucometer_id: string
          id: string
          loaned_at: string
          notes: string | null
          patient_id: string
          returned_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_return_date: string
          glucometer_id: string
          id?: string
          loaned_at?: string
          notes?: string | null
          patient_id: string
          returned_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_return_date?: string
          glucometer_id?: string
          id?: string
          loaned_at?: string
          notes?: string | null
          patient_id?: string
          returned_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glucometer_loans_glucometer_id_fkey"
            columns: ["glucometer_id"]
            isOneToOne: false
            referencedRelation: "glucometers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glucometer_loans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      glucometers: {
        Row: {
          brand: string | null
          code: string
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          code: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_units: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      implanon_records: {
        Row: {
          application_site: string | null
          applied_at: string | null
          created_at: string
          dum: string | null
          expected_removal_at: string | null
          health_unit_id: string | null
          id: string
          lot: string | null
          lot_expiry: string | null
          notes: string | null
          patient_id: string
          professional: string | null
          released_at: string | null
          removal_reason: string | null
          removed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          application_site?: string | null
          applied_at?: string | null
          created_at?: string
          dum?: string | null
          expected_removal_at?: string | null
          health_unit_id?: string | null
          id?: string
          lot?: string | null
          lot_expiry?: string | null
          notes?: string | null
          patient_id: string
          professional?: string | null
          released_at?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_site?: string | null
          applied_at?: string | null
          created_at?: string
          dum?: string | null
          expected_removal_at?: string | null
          health_unit_id?: string | null
          id?: string
          lot?: string | null
          lot_expiry?: string | null
          notes?: string | null
          patient_id?: string
          professional?: string | null
          released_at?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implanon_records_health_unit_id_fkey"
            columns: ["health_unit_id"]
            isOneToOne: false
            referencedRelation: "health_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implanon_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          acs: string | null
          address: string | null
          city: string | null
          cpf: string | null
          created_at: string
          dob: string | null
          dum: string | null
          gestational_notes: string | null
          health_unit_id: string | null
          id: string
          is_pregnant: boolean | null
          legacy_id: string | null
          name: string
          neighborhood: string | null
          observations: string | null
          phone: string | null
          psf: string | null
          risk_classification: string | null
          sus_card: string | null
          updated_at: string
        }
        Insert: {
          acs?: string | null
          address?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          dob?: string | null
          dum?: string | null
          gestational_notes?: string | null
          health_unit_id?: string | null
          id?: string
          is_pregnant?: boolean | null
          legacy_id?: string | null
          name: string
          neighborhood?: string | null
          observations?: string | null
          phone?: string | null
          psf?: string | null
          risk_classification?: string | null
          sus_card?: string | null
          updated_at?: string
        }
        Update: {
          acs?: string | null
          address?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          dob?: string | null
          dum?: string | null
          gestational_notes?: string | null
          health_unit_id?: string | null
          id?: string
          is_pregnant?: boolean | null
          legacy_id?: string | null
          name?: string
          neighborhood?: string | null
          observations?: string | null
          phone?: string | null
          psf?: string | null
          risk_classification?: string | null
          sus_card?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_health_unit_id_fkey"
            columns: ["health_unit_id"]
            isOneToOne: false
            referencedRelation: "health_units"
            referencedColumns: ["id"]
          },
        ]
      }
      released_days: {
        Row: {
          created_at: string
          date: string
          id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
        }
        Relationships: []
      }
      scheduling_shifts: {
        Row: {
          created_at: string | null
          default_time: string
          display_title: string
          end_slot: number
          id: string
          is_active: boolean | null
          label: string
          start_slot: number
        }
        Insert: {
          created_at?: string | null
          default_time?: string
          display_title: string
          end_slot: number
          id?: string
          is_active?: boolean | null
          label: string
          start_slot: number
        }
        Update: {
          created_at?: string | null
          default_time?: string
          display_title?: string
          end_slot?: number
          id?: string
          is_active?: boolean | null
          label?: string
          start_slot?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          name: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      appointment_counts_by_date: {
        Row: {
          count: number | null
          date: string | null
        }
        Relationships: []
      }
      health_unit_patient_counts: {
        Row: {
          name: string | null
          patient_count: number | null
        }
        Relationships: []
      }
      patient_timeline: {
        Row: {
          created_at: string | null
          detail: string | null
          event_date: string | null
          event_time: string | null
          event_type: string | null
          id: string | null
          module: string | null
          patient_id: string | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_approved_member: { Args: { _user_id: string }; Returns: boolean }
      merge_patients: {
        Args: { duplicate_id: string; master_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
