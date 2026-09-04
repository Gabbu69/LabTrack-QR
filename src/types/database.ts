import type { DataScope, ItemStatus, Profile, Tool, ToolCondition, ToolStatus, Transaction, TransactionItem, TransactionStatus } from "./app";

type Relationship = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };
type Table<Row> = {
  Row: Row & Record<string, unknown>;
  Insert: Partial<Row> & Record<string, unknown>;
  Update: Partial<Row> & Record<string, unknown>;
  Relationships: Relationship[];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      tools: Table<Tool>;
      transactions: Table<Transaction>;
      transaction_items: Table<TransactionItem>;
    };
    Views: Record<string, never>;
    Functions: {
      update_my_profile: { Args: { p_full_name: string; p_student_id: string; p_year_section: string; p_group_number: string; p_contact_number: string; p_photo_path?: string | null }; Returns: Profile };
      complete_password_change: { Args: Record<string, never>; Returns: undefined };
      set_profile_status: { Args: { p_profile_id: string; p_status: "pending" | "active" | "disabled" }; Returns: Profile };
      create_tool_batch: { Args: { p_tool_name: string; p_description: string; p_category: string; p_quantity: number; p_code_prefix: string; p_condition: ToolCondition }; Returns: Tool[] };
      borrow_tools: { Args: { p_borrower_token: string; p_tool_tokens: string[] }; Returns: string };
      return_tools: { Args: { p_borrower_token: string; p_returned_items: unknown }; Returns: number };
      mark_items_missing: { Args: { p_item_ids: string[]; p_note: string }; Returns: number };
      update_tool: { Args: { p_tool_id: string; p_tool_name: string; p_description: string; p_category: string; p_condition: ToolCondition; p_status: ToolStatus }; Returns: Tool };
      delete_unused_tool: { Args: { p_tool_id: string }; Returns: undefined };
    };
    Enums: {
      app_role: "student" | "custodian" | "instructor";
      profile_status: "pending" | "active" | "disabled";
      data_scope: DataScope;
      tool_condition: ToolCondition;
      tool_status: ToolStatus;
      transaction_status: TransactionStatus;
      item_status: ItemStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
