/**
 * Gamification Dashboard Component
 *
 * Main dashboard showing all gamification features:
 * - Tier progress
 * - Achievements
 * - Leaderboard
 * - Rewards
 */
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { httpClient } from '@/api/httpClient'
import type {
  GamificationDashboardResponse,
  QrAchievement,
  QrReward,
} from '@/types/qr-gamification'
import { TierProgressCard } from './TierProgressCard'
import { AchievementsGrid } from './AchievementsGrid'
import { ScanLeaderboard } from './ScanLeaderboard'
import { RewardsSection } from './RewardsSection'

interface GamificationDashboardProps {
  userId?: string
  className?: string
}

export function GamificationDashboard({
  userId,
  className = '',
}: GamificationDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<GamificationDashboardResponse | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchDashboardData()
  }, [userId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await httpClient.get<GamificationDashboardResponse>(
        '/api/v1/gamification/dashboard',
        { params: userId ? { user_id: userId } : {} }
      )
      setData(response.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClaimReward = async (reward: QrReward): Promise<void> => {
    const response = await httpClient.post('/api/v1/gamification/rewards/claim', {
      reward_id: reward.id,
    })

    // Refresh dashboard to show claimed reward
    await fetchDashboardData()
  }

  const handleAchievementClick = (achievement: QrAchievement) => {
    // Mark as seen if not already
    const userAchievement = data?.achievements.earned.find(
      (ua) => ua.achievement_id === achievement.id
    )
    if (userAchievement && !userAchievement.is_seen) {
      httpClient.post('/api/v1/gamification/achievements/mark-seen', {
        achievement_id: achievement.id,
      })
    }
  }

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Loading skeleton for tier card */}
        <div className="rounded-xl border bg-card p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-6 w-32 rounded bg-muted" />
                <div className="h-8 w-48 rounded bg-muted" />
              </div>
            </div>
            <div className="h-3 w-full rounded bg-muted" />
          </div>
        </div>

        {/* Loading skeleton for tabs */}
        <div className="h-10 w-full rounded bg-muted" />
        <div className="h-64 w-full rounded-xl border bg-card" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-xl border bg-card p-8 text-center ${className}`}>
        <p className="text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={fetchDashboardData}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Повторить
        </Button>
      </div>
    )
  }

  if (!data) return null

  const allAchievements = [
    ...data.achievements.available,
    ...data.achievements.earned.map((ua) => ua.achievement!).filter(Boolean),
  ].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Tier Progress Card */}
      <TierProgressCard profile={data.profile} />

      {/* Tabbed content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="achievements">
            Достижения
            {data.achievements.earned.some((ua) => !ua.is_seen) && (
              <span className="ml-1.5 flex h-2 w-2 rounded-full bg-red-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="rewards">Награды</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Mini achievements showcase */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Последние достижения</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('achievements')}
              >
                Все
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {data.achievements.earned.slice(0, 6).map((ua) => (
                <AchievementBadge
                  key={ua.id}
                  achievement={ua.achievement!}
                  userAchievement={ua}
                  size="sm"
                  onClick={() => ua.achievement && handleAchievementClick(ua.achievement)}
                />
              ))}
              {data.achievements.earned.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Пока нет достижений. Продолжайте сканировать!
                </p>
              )}
            </div>
          </div>

          {/* Leaderboard */}
          <ScanLeaderboard
            initialPeriod="monthly"
            limit={5}
            showPeriodSelector={false}
            highlightUserId={data.profile.user_id}
          />
        </TabsContent>

        {/* Achievements tab */}
        <TabsContent value="achievements" className="mt-6">
          <AchievementsGrid
            achievements={allAchievements}
            userAchievements={data.achievements.earned}
            progress={data.achievements.progress}
            onAchievementClick={handleAchievementClick}
          />
        </TabsContent>

        {/* Rewards tab */}
        <TabsContent value="rewards" className="mt-6">
          <RewardsSection
            currentTier={data.profile.current_tier}
            currentPoints={data.profile.total_scans} // Using scans as points for simplicity
            availableRewards={data.available_rewards}
            claimedRewards={data.claimed_rewards}
            onClaimReward={handleClaimReward}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default GamificationDashboard

// Also export the AchievementBadge for the overview section
import { AchievementBadge } from './AchievementBadge'
