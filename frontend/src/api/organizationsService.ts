import { httpClient } from './httpClient';
import type {
  OrganizationStatus,
  CreateUpgradeRequestPayload,
  UpgradeRequestResponse
} from '@/types/organizations';

/**
 * Get organization status level information
 */
export const getOrganizationStatus = async (organizationId: string): Promise<OrganizationStatus> => {
  const response = await httpClient.get<OrganizationStatus>(
    `/api/organizations/${organizationId}/status`
  );
  return response.data;
};

/**
 * Submit an upgrade request for organization status level
 * Rate limited to 1 request per 30 days
 */
export const submitUpgradeRequest = async (
  organizationId: string,
  payload: CreateUpgradeRequestPayload
): Promise<UpgradeRequestResponse> => {
  const response = await httpClient.post<UpgradeRequestResponse>(
    `/api/organizations/${organizationId}/status-upgrade-request`,
    payload
  );
  return response.data;
};
