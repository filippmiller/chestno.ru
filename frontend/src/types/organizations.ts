// Organization status and upgrade request types

export type StatusLevel = 'A' | 'B' | 'C';

export interface OrganizationStatus {
  organization_id: string;
  current_level: StatusLevel;
  can_request_upgrade: boolean;
  active_request?: UpgradeRequest;
  last_request_date?: string;
  days_until_next_request?: number;
}

export interface UpgradeRequest {
  id: string;
  organization_id: string;
  target_level: StatusLevel;
  message: string;
  evidence_urls?: string[];
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  admin_notes?: string;
}

export interface CreateUpgradeRequestPayload {
  target_level: 'B' | 'C';
  message: string;
  evidence_urls?: string[];
  accept_terms: boolean;
}

export interface UpgradeRequestResponse {
  success: boolean;
  request: UpgradeRequest;
  message: string;
}
