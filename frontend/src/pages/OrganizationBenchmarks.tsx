/**
 * OrganizationBenchmarks - Full page for competitor benchmarking.
 */
import { useMemo } from 'react'

import { BenchmarkDashboard } from '@/components/benchmarks/BenchmarkDashboard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useUserStore } from '@/store/userStore'

export function OrganizationBenchmarksPage() {
  const { organizations, selectedOrganizationId } = useUserStore()

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId]
  )

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Alert>
          <AlertTitle>Выберите организацию</AlertTitle>
          <AlertDescription>
            Перейдите в дашборд и выберите организацию для просмотра сравнительного анализа.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Аналитика конкурентов</p>
        <h1 className="text-3xl font-semibold">Сравнение с конкурентами</h1>
        <p className="text-muted-foreground">
          Узнайте, как {currentOrganization.name} выглядит на фоне других организаций в категории.
        </p>
      </div>

      <BenchmarkDashboard
        organizationId={currentOrganization.id}
        organizationName={currentOrganization.name}
      />
    </div>
  )
}

export default OrganizationBenchmarksPage
