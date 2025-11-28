import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminPanelPage } from '@/pages/AdminPanel'
import { AuthCallbackPage } from '@/pages/AuthCallback'
import { DashboardPage } from '@/pages/Dashboard'
import { DatabaseExplorerPage } from '@/pages/DatabaseExplorer'
import { InviteLandingPage } from '@/pages/InviteLanding'
import { LoginPage } from '@/pages/Login'
import { ModerationDashboardPage } from '@/pages/ModerationDashboard'
import { NotificationSettingsPage } from '@/pages/NotificationSettings'
import { NotificationsPage } from '@/pages/Notifications'
import { OrganizationAnalyticsPage } from '@/pages/OrganizationAnalytics'
import { OrganizationInvitesPage } from '@/pages/OrganizationInvites'
import { OrganizationOnboardingPage } from '@/pages/OrganizationOnboarding'
import { OrganizationPlanPage } from '@/pages/OrganizationPlan'
import { OrganizationProductsPage } from '@/pages/OrganizationProducts'
import { OrganizationProfilePage } from '@/pages/OrganizationProfile'
import { OrganizationPostsPage } from '@/pages/OrganizationPosts'
import { OrganizationPostEditPage } from '@/pages/OrganizationPostEdit'
import { OrganizationReviewsPage } from '@/pages/OrganizationReviews'
import { OrganizationQrPage } from '@/pages/OrganizationQr'
import { ProducersLandingPage } from '@/pages/ProducersLanding'
import { PublicOrganizationPage } from '@/pages/PublicOrganization'
import { PublicOrganizationsCatalogPage } from '@/pages/PublicOrganizationsCatalog'
import { RegisterPage } from '@/pages/Register'
import { AdminDashboardPage } from '@/pages/AdminDashboard'
import { LinkedAccountsPage } from '@/pages/LinkedAccounts'

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<ProducersLandingPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/organization/profile" element={<OrganizationProfilePage />} />
            <Route path="/dashboard/organization/posts" element={<OrganizationPostsPage />} />
            <Route path="/dashboard/organization/posts/new" element={<OrganizationPostEditPage />} />
            <Route path="/dashboard/organization/posts/:postId" element={<OrganizationPostEditPage />} />
            <Route path="/dashboard/organization/reviews" element={<OrganizationReviewsPage />} />
    <Route path="/dashboard/organization/products" element={<OrganizationProductsPage />} />
    <Route path="/dashboard/organization/plan" element={<OrganizationPlanPage />} />
    <Route path="/dashboard/organization/invites" element={<OrganizationInvitesPage />} />
    <Route path="/dashboard/organization/onboarding" element={<OrganizationOnboardingPage />} />
    <Route path="/dashboard/organization/analytics" element={<OrganizationAnalyticsPage />} />
    <Route path="/dashboard/organization/qr" element={<OrganizationQrPage />} />
    <Route path="/dashboard/notifications" element={<NotificationsPage />} />
    <Route path="/dashboard/settings/notifications" element={<NotificationSettingsPage />} />
    <Route path="/settings/linked-accounts" element={<LinkedAccountsPage />} />
    <Route path="/dashboard/moderation/organizations" element={<ModerationDashboardPage />} />
    <Route path="/dashboard/admin" element={<AdminDashboardPage />} />
    <Route path="/admin" element={<AdminPanelPage />} />
    <Route path="/admin/db" element={<DatabaseExplorerPage />} />
    <Route path="/invite/:code" element={<InviteLandingPage />} />
    <Route path="/org/:slug" element={<PublicOrganizationPage />} />
    <Route path="/orgs" element={<PublicOrganizationsCatalogPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

