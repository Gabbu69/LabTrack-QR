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
      profiles: {
        Row: {
          contact_number: string | null
          created_at: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          email: string
          full_name: string
          group_number: string | null
          id: string
          must_change_password: boolean
          photo_path: string | null
          qr_token: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["profile_status"]
          student_id: string | null
          updated_at: string
          year_section: string | null
        }
        Insert: {
          contact_number?: string | null
          created_at?: string
          data_scope?: Database["public"]["Enums"]["data_scope"]
          email: string
          full_name: string
          group_number?: string | null
          id: string
          must_change_password?: boolean
          photo_path?: string | null
          qr_token?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          student_id?: string | null
          updated_at?: string
          year_section?: string | null
        }
        Update: {
          contact_number?: string | null
          created_at?: string
          data_scope?: Database["public"]["Enums"]["data_scope"]
          email?: string
          full_name?: string
          group_number?: string | null
          id?: string
          must_change_password?: boolean
          photo_path?: string | null
          qr_token?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          student_id?: string | null
          updated_at?: string
          year_section?: string | null
        }
        Relationships: []
      }
      tools: {
        Row: {
          archived_at: string | null
          asset_code: string
          category: string
          condition: Database["public"]["Enums"]["tool_condition"]
          created_at: string
          created_by: string
          creation_batch_id: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          description: string
          id: string
          qr_token: string
          status: Database["public"]["Enums"]["tool_status"]
          tool_name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          asset_code: string
          category: string
          condition?: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          created_by: string
          creation_batch_id: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          description?: string
          id?: string
          qr_token?: string
          status?: Database["public"]["Enums"]["tool_status"]
          tool_name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          asset_code?: string
          category?: string
          condition?: Database["public"]["Enums"]["tool_condition"]
          created_at?: string
          created_by?: string
          creation_batch_id?: string
          data_scope?: Database["public"]["Enums"]["data_scope"]
          description?: string
          id?: string
          qr_token?: string
          status?: Database["public"]["Enums"]["tool_status"]
          tool_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          asset_code_snapshot: string
          created_at: string
          id: string
          issue_condition: Database["public"]["Enums"]["tool_condition"]
          item_status: Database["public"]["Enums"]["item_status"]
          missing_at: string | null
          missing_note: string | null
          return_condition: Database["public"]["Enums"]["tool_condition"] | null
          return_note: string | null
          returned_at: string | null
          returned_by: string | null
          tool_id: string
          tool_name_snapshot: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          asset_code_snapshot: string
          created_at?: string
          id?: string
          issue_condition: Database["public"]["Enums"]["tool_condition"]
          item_status?: Database["public"]["Enums"]["item_status"]
          missing_at?: string | null
          missing_note?: string | null
          return_condition?:
            | Database["public"]["Enums"]["tool_condition"]
            | null
          return_note?: string | null
          returned_at?: string | null
          returned_by?: string | null
          tool_id: string
          tool_name_snapshot: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          asset_code_snapshot?: string
          created_at?: string
          id?: string
          issue_condition?: Database["public"]["Enums"]["tool_condition"]
          item_status?: Database["public"]["Enums"]["item_status"]
          missing_at?: string | null
          missing_note?: string | null
          return_condition?:
            | Database["public"]["Enums"]["tool_condition"]
            | null
          return_note?: string | null
          returned_at?: string | null
          returned_by?: string | null
          tool_id?: string
          tool_name_snapshot?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          borrowed_at: string
          borrower_group_snapshot: string | null
          borrower_id: string
          borrower_name_snapshot: string
          borrower_student_id_snapshot: string
          borrower_year_section_snapshot: string | null
          completed_at: string | null
          created_at: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          id: string
          processed_by: string
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
        }
        Insert: {
          borrowed_at?: string
          borrower_group_snapshot?: string | null
          borrower_id: string
          borrower_name_snapshot: string
          borrower_student_id_snapshot: string
          borrower_year_section_snapshot?: string | null
          completed_at?: string | null
          created_at?: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          id?: string
          processed_by: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
        }
        Update: {
          borrowed_at?: string
          borrower_group_snapshot?: string | null
          borrower_id?: string
          borrower_name_snapshot?: string
          borrower_student_id_snapshot?: string
          borrower_year_section_snapshot?: string | null
          completed_at?: string | null
          created_at?: string
          data_scope?: Database["public"]["Enums"]["data_scope"]
          id?: string
          processed_by?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      borrow_tools: {
        Args: { p_borrower_token: string; p_tool_tokens: string[] }
        Returns: string
      }
      complete_password_change: { Args: never; Returns: undefined }
      create_tool_batch: {
        Args: {
          p_category: string
          p_code_prefix: string
          p_condition: Database["public"]["Enums"]["tool_condition"]
          p_description: string
          p_quantity: number
          p_tool_name: string
        }
        Returns: {
          archived_at: string | null
          asset_code: string
          category: string
          condition: Database["public"]["Enums"]["tool_condition"]
          created_at: string
          created_by: string
          creation_batch_id: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          description: string
          id: string
          qr_token: string
          status: Database["public"]["Enums"]["tool_status"]
          tool_name: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tools"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_unused_tool: { Args: { p_tool_id: string }; Returns: undefined }
      mark_items_missing: {
        Args: { p_item_ids: string[]; p_note: string }
        Returns: number
      }
      reset_demo_records: { Args: never; Returns: undefined }
      return_tools: {
        Args: { p_borrower_token: string; p_returned_items: Json }
        Returns: number
      }
      set_profile_status: {
        Args: {
          p_profile_id: string
          p_status: Database["public"]["Enums"]["profile_status"]
        }
        Returns: {
          contact_number: string | null
          created_at: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          email: string
          full_name: string
          group_number: string | null
          id: string
          must_change_password: boolean
          photo_path: string | null
          qr_token: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["profile_status"]
          student_id: string | null
          updated_at: string
          year_section: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_profile: {
        Args: {
          p_contact_number: string
          p_full_name: string
          p_group_number: string
          p_photo_path?: string
          p_student_id: string
          p_year_section: string
        }
        Returns: {
          contact_number: string | null
          created_at: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          email: string
          full_name: string
          group_number: string | null
          id: string
          must_change_password: boolean
          photo_path: string | null
          qr_token: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["profile_status"]
          student_id: string | null
          updated_at: string
          year_section: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_tool: {
        Args: {
          p_category: string
          p_condition: Database["public"]["Enums"]["tool_condition"]
          p_description: string
          p_status: Database["public"]["Enums"]["tool_status"]
          p_tool_id: string
          p_tool_name: string
        }
        Returns: {
          archived_at: string | null
          asset_code: string
          category: string
          condition: Database["public"]["Enums"]["tool_condition"]
          created_at: string
          created_by: string
          creation_batch_id: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          description: string
          id: string
          qr_token: string
          status: Database["public"]["Enums"]["tool_status"]
          tool_name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tools"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "student" | "custodian" | "instructor"
      data_scope: "operational" | "demo"
      item_status: "borrowed" | "returned" | "missing"
      profile_status: "pending" | "active" | "disabled"
      tool_condition: "good" | "fair" | "damaged"
      tool_status:
        | "available"
        | "borrowed"
        | "missing"
        | "unavailable"
        | "archived"
      transaction_status: "borrowed" | "partial" | "incomplete" | "returned"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["student", "custodian", "instructor"],
      data_scope: ["operational", "demo"],
      item_status: ["borrowed", "returned", "missing"],
      profile_status: ["pending", "active", "disabled"],
      tool_condition: ["good", "fair", "damaged"],
      tool_status: [
        "available",
        "borrowed",
        "missing",
        "unavailable",
        "archived",
      ],
      transaction_status: ["borrowed", "partial", "incomplete", "returned"],
    },
  },
} as const
