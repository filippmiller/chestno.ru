import { Navigate, Route, Routes } from 'react-router-dom'

// New Auth Components
import { AuthPage } from '@/auth/AuthPage'
import { AuthCallbackPage } from '@/auth/AuthCallbackPage'
import { ForgotPasswordPage } from '@/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/auth/ResetPasswordPage'
import { ProtectedRoute } from '@/auth/ProtectedRoute'

// Existing Pages
import { AdminPanelPage } from '@/pages/AdminPanel'
import { DashboardPage } from '@/pages/Dashboard'
import { DatabaseExplorerPage } from '@/pages/DatabaseExplorer'
import { InviteLandingPage } from '@/pages/InviteLanding'
import { ModerationDashboardPage } from '@/pages/ModerationDashboard'
import { ModerationQueuePage } from '@/pages/ModerationQueuePage'
import { ModerationPatternPage } from '@/pages/ModerationPatternPage'
import { NotificationSettingsPage } from '@/pages/NotificationSettings'
import { NotificationsPage } from '@/pages/Notifications'
import { OrganizationAnalyticsPage } from '@/pages/OrganizationAnalytics'
import { OrganizationInvitesPage } from '@/pages/OrganizationInvites'
import { OrganizationOnboardingPage } from '@/pages/OrganizationOnboarding'
import { OrganizationPlanPage } from '@/pages/OrganizationPlan'
import { OrganizationProductsPage } from '@/pages/OrganizationProducts'
import { OrganizationProductImportPage } from '@/pages/OrganizationProductImport'
import { OrganizationProfilePage } from '@/pages/OrganizationProfile'
import { OrganizationPostsPage } from '@/pages/OrganizationPosts'
import { OrganizationPostEditPage } from '@/pages/OrganizationPostEdit'
import { OrganizationReviewsPage } from '@/pages/OrganizationReviews'
import { OrganizationQrPage } from '@/pages/OrganizationQr'
import { OrganizationQrPosterPage } from '@/pages/OrganizationQrPoster'
import { OrganizationMarketingPage } from '@/pages/OrganizationMarketing'
import { OrganizationMarketingEditPage } from '@/pages/OrganizationMarketingEdit'
import { ProducersLandingPage } from '@/pages/ProducersLanding'
import { PublicOrganizationPage } from '@/pages/PublicOrganization'
import { PublicOrganizationsCatalogPage } from '@/pages/PublicOrganizationsCatalog'
import { CreateReviewPage } from '@/pages/CreateReview'
import { AdminDashboardPage } from '@/pages/AdminDashboard'
import { AdminImportsPage } from '@/pages/AdminImports'
import { AdminImportDetailsPage } from '@/pages/AdminImportDetails'
import { LinkedAccountsPage } from '@/pages/LinkedAccounts'
import { ProductsCatalogPage } from '@/pages/ProductsCatalog'
import { PublicOrganizationPostsPage } from '@/pages/PublicOrganizationPosts'
import { StoriesPage } from '@/pages/StoriesPage'
import { AboutPage } from '@/pages/AboutPage'
import { PricingPage } from '@/pages/PricingPage'
import { StatusLevelsInfo } from '@/pages/StatusLevelsInfo'
import { MethodologyPage } from '@/pages/MethodologyPage'
import { OrganizationStatusPage } from '@/pages/OrganizationStatus'
import { WidgetConfiguratorPage } from '@/pages/WidgetConfigurator'
import { OrganizationBenchmarksPage } from '@/pages/OrganizationBenchmarks'
import { ProductPage } from '@/pages/ProductPage'
import { MySubscriptionsPage } from '@/pages/MySubscriptions'
import { GamificationPage } from '@/pages/GamificationPage'
import { ProductComparisonPage } from '@/pages/ProductComparisonPage'
import { TrustPreferencesPage } from '@/pages/TrustPreferencesPage'

// Retail Store Pages
import { RetailDashboardPage } from '@/pages/RetailDashboardPage'
import { KioskPage } from '@/pages/KioskPage'
import { StaffPortalPage } from '@/pages/StaffPortalPage'

// Scan Notifications
import { OrganizationScanNotificationsPage } from '@/pages/OrganizationScanNotifications'

// Geographic Security
import { OrganizationGeoSecurityPage } from '@/pages/OrganizationGeoSecurity'

// Supply Chain
import { OrganizationSupplyChainPage } from '@/pages/OrganizationSupplyChain'

// Warranty Management
import { MyWarrantiesPage } from '@/pages/MyWarranties'
import { OrganizationWarrantiesPage } from '@/pages/OrganizationWarranties'
import { WarrantyDetailsPage } from '@/pages/WarrantyClaimDetails'

// Product Stories
import { ProductStoryViewerPage } from '@/pages/ProductStoryViewer'
import { OrganizationStoriesPage } from '@/pages/OrganizationStories'
import { OrganizationStoryEditPage } from '@/pages/OrganizationStoryEdit'

export const AppRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/" element={<ProducersLandingPage />} />
    <Route path="/products" element={<ProductsCatalogPage />} />
    <Route path="/stories" element={<StoriesPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route path="/levels" element={<StatusLevelsInfo />} />
    <Route path="/methodology" element={<MethodologyPage />} />
    <Route path="/compare/:productId" element={<ProductComparisonPage />} />
    <Route path="/org/:id" element={<PublicOrganizationPage />} />
    <Route path="/product/:slug" element={<ProductPage />} />
    <Route path="/product/:slug/story" element={<ProductStoryViewerPage />} />
    <Route path="/org/:slug/posts" element={<PublicOrganizationPostsPage />} />
    <Route path="/org/:slug/posts/:postSlug" element={<PublicOrganizationPostsPage />} />
    <Route path="/org/:id/review" element={<CreateReviewPage />} />
    <Route path="/orgs" element={<PublicOrganizationsCatalogPage />} />

    {/* New Auth routes */}
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/auth/forgot" element={<ForgotPasswordPage />} />
    <Route path="/auth/reset" element={<ResetPasswordPage />} />

    {/* Legacy auth routes - redirect to new /auth */}
    <Route path="/login" element={<Navigate to="/auth" replace />} />
    <Route path="/register" element={<Navigate to="/auth" replace />} />

    {/* Protected Dashboard routes */}
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/profile"
      element={
        <ProtectedRoute>
          <OrganizationProfilePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/posts"
      element={
        <ProtectedRoute>
          <OrganizationPostsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/posts/new"
      element={
        <ProtectedRoute>
          <OrganizationPostEditPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/posts/:postId"
      element={
        <ProtectedRoute>
          <OrganizationPostEditPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/reviews"
      element={
        <ProtectedRoute>
          <OrganizationReviewsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/products"
      element={
        <ProtectedRoute>
          <OrganizationProductsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/products/import"
      element={
        <ProtectedRoute>
          <OrganizationProductImportPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/plan"
      element={
        <ProtectedRoute>
          <OrganizationPlanPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/invites"
      element={
        <ProtectedRoute>
          <OrganizationInvitesPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/onboarding"
      element={
        <ProtectedRoute>
          <OrganizationOnboardingPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/analytics"
      element={
        <ProtectedRoute>
          <OrganizationAnalyticsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/benchmarks"
      element={
        <ProtectedRoute>
          <OrganizationBenchmarksPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/status"
      element={
        <ProtectedRoute>
          <OrganizationStatusPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/scan-notifications"
      element={
        <ProtectedRoute>
          <OrganizationScanNotificationsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/geo-security"
      element={
        <ProtectedRoute>
          <OrganizationGeoSecurityPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/supply-chain"
      element={
        <ProtectedRoute>
          <OrganizationSupplyChainPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/qr"
      element={
        <ProtectedRoute>
          <OrganizationQrPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/widget"
      element={
        <ProtectedRoute>
          <WidgetConfiguratorPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/marketing/qr-poster"
      element={
        <ProtectedRoute>
          <OrganizationQrPosterPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/marketing"
      element={
        <ProtectedRoute>
          <OrganizationMarketingPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/marketing/:materialId"
      element={
        <ProtectedRoute>
          <OrganizationMarketingEditPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/notifications"
      element={
        <ProtectedRoute>
          <NotificationsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/settings/notifications"
      element={
        <ProtectedRoute>
          <NotificationSettingsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings/linked-accounts"
      element={
        <ProtectedRoute>
          <LinkedAccountsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/subscriptions"
      element={
        <ProtectedRoute>
          <MySubscriptionsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/gamification"
      element={
        <ProtectedRoute>
          <GamificationPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings/trust-preferences"
      element={
        <ProtectedRoute>
          <TrustPreferencesPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/moderation/organizations"
      element={
        <ProtectedRoute>
          <ModerationDashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/moderation"
      element={
        <ProtectedRoute>
          <ModerationQueuePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/moderation/patterns"
      element={
        <ProtectedRoute>
          <ModerationPatternPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/admin"
      element={
        <ProtectedRoute>
          <AdminDashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <ProtectedRoute>
          <AdminPanelPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/db"
      element={
        <ProtectedRoute>
          <DatabaseExplorerPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/imports"
      element={
        <ProtectedRoute>
          <AdminImportsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/imports/:jobId"
      element={
        <ProtectedRoute>
          <AdminImportDetailsPage />
        </ProtectedRoute>
      }
    />

    {/* Invite landing (public) */}
    <Route path="/invite/:code" element={<InviteLandingPage />} />

    {/* Kiosk mode (public, device-authenticated) */}
    <Route path="/kiosk" element={<KioskPage />} />

    {/* Warranty Management routes (protected) */}
    <Route
      path="/dashboard/warranties"
      element={
        <ProtectedRoute>
          <MyWarrantiesPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/warranty/:warrantyId"
      element={
        <ProtectedRoute>
          <WarrantyDetailsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/warranties"
      element={
        <ProtectedRoute>
          <OrganizationWarrantiesPage />
        </ProtectedRoute>
      }
    />

    {/* Product Stories routes (protected) */}
    <Route
      path="/dashboard/organization/stories"
      element={
        <ProtectedRoute>
          <OrganizationStoriesPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/stories/new"
      element={
        <ProtectedRoute>
          <OrganizationStoryEditPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/stories/:storyId"
      element={
        <ProtectedRoute>
          <OrganizationStoryEditPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/organization/stories/:storyId/edit"
      element={
        <ProtectedRoute>
          <OrganizationStoryEditPage />
        </ProtectedRoute>
      }
    />

    {/* Retail Dashboard routes (protected) */}
    <Route
      path="/retail"
      element={
        <ProtectedRoute>
          <RetailDashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/retail/staff"
      element={
        <ProtectedRoute>
          <StaffPortalPage />
        </ProtectedRoute>
      }
    />

    {/* Catch-all */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)
