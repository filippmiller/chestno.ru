import { create } from 'zustand'

import type { AppUser, Organization, OrganizationMembership, PlatformRole } from '@/types/auth'

type UserState = {
  user: AppUser | null
  memberships: OrganizationMembership[]
  organizations: Organization[]
  selectedOrganizationId: string | null
  platformRoles: PlatformRole[]
  loading: boolean
  setSessionData: (payload: {
    user: AppUser | null
    memberships: OrganizationMembership[]
    organizations: Organization[]
    platform_roles?: PlatformRole[]
  }) => void
  setLoading: (loading: boolean) => void
  setSelectedOrganization: (organizationId: string | null) => void
  reset: () => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  memberships: [],
  organizations: [],
  selectedOrganizationId: null,
  platformRoles: [],
  loading: false,
  setSessionData: ({ user, memberships, organizations, platform_roles }) => {
    console.log('setSessionData called with platform_roles:', platform_roles)
    return set((state) => ({
      user,
      memberships,
      organizations,
      platformRoles: platform_roles ?? state.platformRoles,
      selectedOrganizationId:
        state.selectedOrganizationId && memberships.some((m) => m.organization_id === state.selectedOrganizationId)
          ? state.selectedOrganizationId
          : memberships[0]?.organization_id ?? null,
    }))
  },
  setLoading: (loading) => set({ loading }),
  setSelectedOrganization: (organizationId) => set({ selectedOrganizationId: organizationId }),
  reset: () =>
    set({
      user: null,
      memberships: [],
      organizations: [],
      selectedOrganizationId: null,
      platformRoles: [],
    }),
}))

