/**
 * Scan Result Modal Component
 *
 * Shows animated feedback after a QR scan including:
 * - Points earned
 * - Tier progression/upgrade
 * - New achievements unlocked
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, Check, ChevronUp, Sparkles, Star, Trophy, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { QrAchievement, QrScanTier, ScanResultResponse } from '@/types/qr-gamification'
import { QR_TIER_CONFIG } from '@/types/qr-gamification'
import { ScanTierBadge } from './ScanTierBadge'
import { AchievementBadge } from './AchievementBadge'

interface ScanResultModalProps {
  result: ScanResultResponse | null
  isOpen: boolean
  onClose: () => void
}

export function ScanResultModal({ result, isOpen, onClose }: ScanResultModalProps) {
  const [stage, setStage] = useState<'points' | 'tier' | 'achievements' | 'complete'>('points')
  const [showConfetti, setShowConfetti] = useState(false)

  // Reset and animate through stages
  useEffect(() => {
    if (!isOpen || !result) {
      setStage('points')
      return
    }

    setStage('points')

    const timer1 = setTimeout(() => {
      if (result.tier_changed) {
        setStage('tier')
        setShowConfetti(true)
      } else if (result.new_achievements.length > 0) {
        setStage('achievements')
      } else {
        setStage('complete')
      }
    }, 1500)

    const timer2 = setTimeout(() => {
      if (result.tier_changed && result.new_achievements.length > 0) {
        setStage('achievements')
      } else if (result.tier_changed) {
        setStage('complete')
      }
    }, 3500)

    const timer3 = setTimeout(() => {
      if (result.tier_changed || result.new_achievements.length > 0) {
        setStage('complete')
      }
      setShowConfetti(false)
    }, result.tier_changed ? 5500 : 3500)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [isOpen, result])

  if (!result) return null

  const tierConfig = QR_TIER_CONFIG[result.new_tier]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 hover:bg-muted transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative py-8">
          {/* Confetti background for tier upgrade */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: ['#FFD700', '#C0C0C0', '#CD7F32', '#A855F7', '#3B82F6'][
                      i % 5
                    ],
                    left: `${Math.random() * 100}%`,
                  }}
                  initial={{ y: -20, opacity: 1, scale: 0 }}
                  animate={{
                    y: 400,
                    opacity: 0,
                    scale: 1,
                    rotate: Math.random() * 360,
                  }}
                  transition={{
                    duration: 2 + Math.random(),
                    delay: Math.random() * 0.5,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Stage 1: Points earned */}
            {stage === 'points' && (
              <motion.div
                key="points"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
                >
                  <Check className="h-10 w-10 text-primary" />
                </motion.div>

                <h3 className="text-xl font-semibold">Сканирование успешно!</h3>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4"
                >
                  <span className="text-4xl font-bold text-primary">
                    +{result.points_earned}
                  </span>
                  <span className="ml-2 text-muted-foreground">очков</span>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-2 text-sm text-muted-foreground"
                >
                  Всего: {result.profile.total_scans} сканирований
                </motion.p>
              </motion.div>
            )}

            {/* Stage 2: Tier upgrade */}
            {stage === 'tier' && result.tier_changed && (
              <motion.div
                key="tier"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <motion.div
                  initial={{ y: 50 }}
                  animate={{ y: 0 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                >
                  <Sparkles
                    className="mx-auto mb-2 h-8 w-8"
                    style={{ color: tierConfig.color }}
                  />
                  <h3 className="text-xl font-bold">Новый уровень!</h3>
                </motion.div>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.3, bounce: 0.6 }}
                  className="my-6"
                >
                  <ScanTierBadge tier={result.new_tier} size="xl" animate />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <h4
                    className="text-2xl font-bold"
                    style={{ color: tierConfig.color }}
                  >
                    {tierConfig.name_ru}
                  </h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Поздравляем! Вы открыли новые награды
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* Stage 3: Achievements */}
            {stage === 'achievements' && result.new_achievements.length > 0 && (
              <motion.div
                key="achievements"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <Trophy className="mx-auto mb-2 h-8 w-8 text-yellow-500" />
                <h3 className="text-xl font-bold">
                  {result.new_achievements.length === 1
                    ? 'Новое достижение!'
                    : `${result.new_achievements.length} новых достижения!`}
                </h3>

                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  {result.new_achievements.map((achievement, i) => (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, scale: 0, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.15, type: 'spring' }}
                    >
                      <AchievementBadge
                        achievement={achievement}
                        userAchievement={{
                          id: '',
                          user_id: '',
                          achievement_id: achievement.id,
                          earned_at: new Date().toISOString(),
                          progress_value: 0,
                          is_seen: false,
                        }}
                        size="lg"
                        showTooltip={false}
                      />
                      <p className="mt-2 text-sm font-medium">{achievement.name_ru}</p>
                      <p className="text-xs text-primary">
                        +{achievement.points_reward} очков
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Stage 4: Complete summary */}
            {stage === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="mb-6">
                  <ScanTierBadge tier={result.new_tier} size="lg" showLabel />
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="grid grid-cols-3 divide-x">
                    <div className="px-3">
                      <p className="text-2xl font-bold">{result.profile.total_scans}</p>
                      <p className="text-xs text-muted-foreground">Сканирований</p>
                    </div>
                    <div className="px-3">
                      <p className="text-2xl font-bold text-primary">
                        +{result.points_earned}
                      </p>
                      <p className="text-xs text-muted-foreground">Очков</p>
                    </div>
                    <div className="px-3">
                      <p className="text-2xl font-bold">{result.profile.current_streak_days}</p>
                      <p className="text-xs text-muted-foreground">Дней стрик</p>
                    </div>
                  </div>
                </div>

                {result.profile.scans_to_next_tier !== null && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    До следующего уровня:{' '}
                    <span className="font-medium text-foreground">
                      {result.profile.scans_to_next_tier} сканирований
                    </span>
                  </p>
                )}

                <Button onClick={onClose} className="mt-6 w-full">
                  Продолжить
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ScanResultModal
