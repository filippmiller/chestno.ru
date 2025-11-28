import { Navbar } from '@/components/ui/navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/store/userStore'
import { getSupabaseClient } from '@/lib/supabaseClient'

export const StoriesPage = () => {
  const { user, reset, platformRoles } = useUserStore()
  const supabase = getSupabaseClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    reset()
  }

  const isAdmin = platformRoles.some((role) => role === 'platform_owner' || role === 'platform_admin')

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar userEmail={user?.email ?? undefined} onLogout={handleLogout} isAdmin={isAdmin} />
      <main className="flex-1 bg-muted/10">
        <div className="container py-8">
          <Card>
            <CardHeader>
              <CardTitle>Истории героев</CardTitle>
              <CardDescription>Скоро тут будет новая информация</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Мы собираем вдохновляющие истории российских производителей. Скоро здесь вы сможете узнать о людях, которые
                создают качественные товары и развивают производство в России.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Сделано в России! Честно!
      </footer>
    </div>
  )
}

