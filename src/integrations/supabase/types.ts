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
      availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          staff_id: string
          start_time: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          staff_id?: string
          start_time?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      centre_contacts: {
        Row: {
          centre_id: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centre_contacts_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      centre_secondary_channels: {
        Row: {
          centre_id: string
          channel: Database["public"]["Enums"]["centre_channel"]
          created_at: string
        }
        Insert: {
          centre_id: string
          channel: Database["public"]["Enums"]["centre_channel"]
          created_at?: string
        }
        Update: {
          centre_id?: string
          channel?: Database["public"]["Enums"]["centre_channel"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centre_secondary_channels_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      centres: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          preferred_channel: Database["public"]["Enums"]["centre_channel"]
          primary_channel: Database["public"]["Enums"]["centre_channel"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          preferred_channel?: Database["public"]["Enums"]["centre_channel"]
          primary_channel?: Database["public"]["Enums"]["centre_channel"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          preferred_channel?: Database["public"]["Enums"]["centre_channel"]
          primary_channel?: Database["public"]["Enums"]["centre_channel"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          shift_id: string
        }
        Insert: {
          author_id: string
          body?: string
          created_at?: string
          id?: string
          shift_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_comments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_contacted: {
        Row: {
          contacted_at: string
          shift_id: string
          staff_id: string
        }
        Insert: {
          contacted_at?: string
          shift_id: string
          staff_id: string
        }
        Update: {
          contacted_at?: string
          shift_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_contacted_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_contacted_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          added_to_staffpoint: boolean
          assigned_staff_id: string | null
          cancellation_reason: string | null
          centre_id: string
          created_at: string
          end_time: string
          id: string
          notes: string | null
          role_needed: string | null
          shift_date: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          updated_at: string
        }
        Insert: {
          added_to_staffpoint?: boolean
          assigned_staff_id?: string | null
          cancellation_reason?: string | null
          centre_id: string
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          role_needed?: string | null
          shift_date: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
        }
        Update: {
          added_to_staffpoint?: boolean
          assigned_staff_id?: string | null
          cancellation_reason?: string | null
          centre_id?: string
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          role_needed?: string | null
          shift_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          display_name: string | null
          documents_url: string | null
          email: string | null
          id: string
          legal_name: string
          notes: string | null
          phone: string | null
          role: string | null
          status: Database["public"]["Enums"]["staff_status"]
          updated_at: string
          use_display_name: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          documents_url?: string | null
          email?: string | null
          id?: string
          legal_name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          use_display_name?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          documents_url?: string | null
          email?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          use_display_name?: boolean
        }
        Relationships: []
      }
      staff_centre_banned: {
        Row: {
          centre_id: string
          created_at: string
          staff_id: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          staff_id: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_centre_banned_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_centre_banned_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_centre_top: {
        Row: {
          centre_id: string
          created_at: string
          staff_id: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          staff_id: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_centre_top_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_centre_top_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_complete_shifts: { Args: never; Returns: undefined }
    }
    Enums: {
      centre_channel: "whatsapp" | "goto" | "email"
      shift_status: "pending" | "filled" | "cancelled" | "completed"
      staff_status: "active" | "inactive"
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
      centre_channel: ["whatsapp", "goto", "email"],
      shift_status: ["pending", "filled", "cancelled", "completed"],
      staff_status: ["active", "inactive"],
    },
  },
} as const
