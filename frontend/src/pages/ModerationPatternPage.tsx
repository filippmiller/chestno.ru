/**
 * Moderation Pattern Page
 * Admin page for managing AI moderation patterns.
 */
import { useAuthV2 } from '@/auth/AuthProviderV2'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AIPatternManager } from '@/components/moderation/AIPatternManager'

const ADMIN_ROLES = new Set(['platform_admin'])

export function ModerationPatternPage() {
  const { platformRoles } = useAuthV2()
  const isAdmin = platformRoles.some((role) => ADMIN_ROLES.has(role))

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно прав</AlertTitle>
          <AlertDescription>
            Управление AI-паттернами доступно только администраторам платформы.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <h1 className="text-2xl font-bold">Управление AI-паттернами</h1>
          <p className="text-muted-foreground mt-1">
            Настройка автоматических правил модерации контента
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <AIPatternManager />
      </div>
    </div>
  )
}
