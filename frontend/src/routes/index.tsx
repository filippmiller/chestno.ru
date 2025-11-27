import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminPanelPage } from '@/pages/AdminPanel'
import { AuthCallbackPage } from '@/pages/AuthCallback'
import { DashboardPage } from '@/pages/Dashboard'
import { InviteLandingPage } from '@/pages/InviteLanding'
import { LoginPage } from '@/pages/Login'
import { ModerationDashboardPage } from '@/pages/ModerationDashboard'
import { OrganizationInvitesPage } from '@/pages/OrganizationInvites'
import { OrganizationProfilePage } from '@/pages/OrganizationProfile'
import { OrganizationQrPage } from '@/pages/OrganizationQr'
import { ProducersLandingPage } from '@/pages/ProducersLanding'
import { PublicOrganizationPage } from '@/pages/PublicOrganization'
import { RegisterPage } from '@/pages/Register'

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/register" replace />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/dashboard/organization/profile" element={<OrganizationProfilePage />} />
    <Route path="/dashboard/organization/invites" element={<OrganizationInvitesPage />} />
    <Route path="/dashboard/organization/qr" element={<OrganizationQrPage />} />
    <Route path="/dashboard/moderation/organizations" element={<ModerationDashboardPage />} />
    <Route path="/admin" element={<AdminPanelPage />} />
    <Route path="/invite/:code" element={<InviteLandingPage />} />
    <Route path="/org/:slug" element={<PublicOrganizationPage />} />
    <Route path="/orgs" element={<ProducersLandingPage />} />
    <Route path="*" element={<Navigate to="/register" replace />} />
  </Routes>
)

