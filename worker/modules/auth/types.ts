export interface AdminRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_algorithm: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionWithAdminRow {
  session_id: string;
  admin_id: string;
  expires_at: string;
  last_activity_at: string;
  revoked_at: string | null;
  username: string;
  display_name: string;
  is_active: number;
  last_login_at: string | null;
}

export interface AuditLogInput {
  adminId: string | null;
  actorType: 'admin' | 'system' | 'public';
  action: string;
  entityType: string;
  entityId: string;
  changeSummary?: Record<string, unknown>;
  requestId: string;
}
