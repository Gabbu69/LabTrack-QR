export type AppRole = "student" | "custodian" | "instructor";
export type ProfileStatus = "pending" | "active" | "disabled";
export type DataScope = "operational" | "demo";
export type ToolCondition = "good" | "fair" | "damaged";
export type ToolStatus = "available" | "borrowed" | "missing" | "unavailable" | "archived";
export type TransactionStatus = "borrowed" | "partial" | "incomplete" | "returned";
export type ItemStatus = "borrowed" | "returned" | "missing";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: ProfileStatus;
  student_id: string | null;
  year_section: string | null;
  group_number: string | null;
  contact_number: string | null;
  photo_path: string | null;
  qr_token: string;
  must_change_password: boolean;
  data_scope: DataScope;
  created_at: string;
  updated_at: string;
}

export interface Tool {
  id: string;
  asset_code: string;
  tool_name: string;
  description: string;
  category: string;
  condition: ToolCondition;
  status: ToolStatus;
  qr_token: string;
  creation_batch_id: string;
  data_scope: DataScope;
  created_by: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  borrower_id: string;
  processed_by: string;
  borrower_name_snapshot: string;
  borrower_student_id_snapshot: string;
  borrower_year_section_snapshot: string | null;
  borrower_group_snapshot: string | null;
  borrowed_at: string;
  completed_at: string | null;
  status: TransactionStatus;
  data_scope: DataScope;
  created_at: string;
  updated_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  tool_id: string;
  tool_name_snapshot: string;
  asset_code_snapshot: string;
  item_status: ItemStatus;
  issue_condition: ToolCondition;
  return_condition: ToolCondition | null;
  return_note: string | null;
  returned_by: string | null;
  returned_at: string | null;
  missing_at: string | null;
  missing_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  total: number;
  available: number;
  borrowed: number;
  missing: number;
  activeTransactions: number;
}
