import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ImportWizard } from '@/components/import/ImportWizard'
import { useUserStore } from '@/store/userStore'

export const OrganizationProductImportPage = () => {
  const { organizations, selectedOrganizationId, memberships } = useUserStore()

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId]
  )

  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canEdit = membership && ['owner', 'admin', 'manager', 'editor'].includes(membership.role)

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Нет организации</AlertTitle>
          <AlertDescription>Сначала создайте организацию или примите приглашение.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Доступ запрещён</AlertTitle>
          <AlertDescription>У вас недостаточно прав для импорта товаров.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/organization/products">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Импорт товаров</p>
          <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        </div>
      </div>

      <ImportWizard organizationId={currentOrganization.id} />
    </div>
  )
}
