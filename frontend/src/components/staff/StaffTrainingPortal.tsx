/**
 * StaffTrainingPortal Component
 *
 * Training module viewer for retail staff to become "Trust Ambassadors".
 * Displays modules, tracks progress, and handles certification.
 */
import { useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Clock,
  GraduationCap,
  Lock,
  Play,
  RefreshCw,
  Trophy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  getMyTrainingProgress,
  listTrainingModules,
  getTrainingModule,
  updateTrainingProgress,
  submitQuiz,
} from '@/api/staffService'
import type {
  TrainingModule,
  TrainingProgress,
  StaffCertification,
  TrainingStatus,
  QuizQuestion,
  QuizResult,
} from '@/types/retail'

interface StaffTrainingPortalProps {
  className?: string
}

const STATUS_CONFIG: Record<TrainingStatus, { label: string; color: string; icon: React.ElementType }> = {
  not_started: { label: 'Не начат', color: 'text-gray-500', icon: BookOpen },
  in_progress: { label: 'В процессе', color: 'text-blue-500', icon: Play },
  completed: { label: 'Завершен', color: 'text-green-500', icon: CheckCircle },
  failed: { label: 'Не пройден', color: 'text-red-500', icon: RefreshCw },
}

export function StaffTrainingPortal({ className = '' }: StaffTrainingPortalProps) {
  const [modules, setModules] = useState<TrainingModule[]>([])
  const [progress, setProgress] = useState<TrainingProgress[]>([])
  const [certification, setCertification] = useState<StaffCertification | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Active module state
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [activeModule, setActiveModule] = useState<TrainingModule | null>(null)
  const [moduleLoading, setModuleLoading] = useState(false)

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitting, setQuizSubmitting] = useState(false)
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const [modulesResponse, progressResponse] = await Promise.all([
          listTrainingModules(),
          getMyTrainingProgress(),
        ])

        setModules(modulesResponse.modules)
        setProgress(progressResponse.progress)
        setCertification(progressResponse.certification)
      } catch (err) {
        console.error('Failed to load training data:', err)
        setError('Не удалось загрузить данные обучения')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Load active module content
  useEffect(() => {
    if (!activeModuleId) {
      setActiveModule(null)
      setQuizQuestions([])
      setQuizAnswers({})
      setQuizResult(null)
      return
    }

    const loadModule = async () => {
      setModuleLoading(true)
      try {
        const module = await getTrainingModule(activeModuleId)
        setActiveModule(module)

        // If it's a quiz, extract questions from content_data
        if (module.content_type === 'quiz' && module.content_data) {
          setQuizQuestions((module.content_data as { questions?: QuizQuestion[] }).questions || [])
        }

        // Update progress to in_progress if not started
        const moduleProgress = progress.find((p) => p.module_id === activeModuleId)
        if (!moduleProgress || moduleProgress.status === 'not_started') {
          await updateTrainingProgress(activeModuleId, {
            progress_percent: 0,
            status: 'in_progress',
          })
        }
      } catch (err) {
        console.error('Failed to load module:', err)
        setError('Не удалось загрузить модуль')
      } finally {
        setModuleLoading(false)
      }
    }

    loadModule()
  }, [activeModuleId])

  // Get module progress
  const getModuleProgress = (moduleId: string): TrainingProgress | undefined => {
    return progress.find((p) => p.module_id === moduleId)
  }

  // Check if module is available (prerequisites met)
  const isModuleAvailable = (module: TrainingModule): boolean => {
    if (!module.prerequisite_module_id) return true
    const prereqProgress = getModuleProgress(module.prerequisite_module_id)
    return prereqProgress?.status === 'completed'
  }

  // Handle quiz answer selection
  const handleQuizAnswer = (questionId: string, answerIndex: number) => {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: answerIndex }))
  }

  // Submit quiz
  const handleQuizSubmit = async () => {
    if (!activeModuleId) return

    setQuizSubmitting(true)
    try {
      const result = await submitQuiz({
        module_id: activeModuleId,
        answers: Object.entries(quizAnswers).map(([questionId, selectedIndex]) => ({
          question_id: questionId,
          selected_index: selectedIndex,
        })),
      })

      setQuizResult(result)

      // Refresh progress
      const progressResponse = await getMyTrainingProgress()
      setProgress(progressResponse.progress)
      setCertification(progressResponse.certification)
    } catch (err) {
      console.error('Quiz submission failed:', err)
      setError('Не удалось отправить ответы')
    } finally {
      setQuizSubmitting(false)
    }
  }

  // Mark module as completed
  const handleMarkCompleted = async () => {
    if (!activeModuleId) return

    try {
      await updateTrainingProgress(activeModuleId, {
        progress_percent: 100,
        status: 'completed',
      })

      // Refresh progress
      const progressResponse = await getMyTrainingProgress()
      setProgress(progressResponse.progress)
      setCertification(progressResponse.certification)

      setActiveModuleId(null)
    } catch (err) {
      console.error('Failed to mark completed:', err)
    }
  }

  // Calculate overall progress
  const overallProgress = modules.length > 0
    ? Math.round((progress.filter((p) => p.status === 'completed').length / modules.length) * 100)
    : 0

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error && !modules.length) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Module detail view
  if (activeModule) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Button variant="ghost" onClick={() => setActiveModuleId(null)}>
          <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
          Назад к модулям
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{activeModule.title}</CardTitle>
                <CardDescription className="mt-1">
                  {activeModule.description}
                </CardDescription>
              </div>
              <Badge variant="outline">
                <Clock className="mr-1 h-3 w-3" />
                {activeModule.duration_minutes} мин
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {moduleLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : activeModule.content_type === 'video' ? (
              // Video module
              <div className="space-y-4">
                <div className="aspect-video rounded-lg bg-black">
                  {activeModule.content_url ? (
                    <video
                      src={activeModule.content_url}
                      controls
                      className="h-full w-full rounded-lg"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white">
                      <Play className="h-16 w-16" />
                    </div>
                  )}
                </div>
                <Button className="w-full" onClick={handleMarkCompleted}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Отметить как просмотренное
                </Button>
              </div>
            ) : activeModule.content_type === 'quiz' ? (
              // Quiz module
              <div className="space-y-6">
                {quizResult ? (
                  // Quiz result
                  <div className="text-center">
                    <div
                      className={`mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full ${
                        quizResult.passed ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {quizResult.passed ? (
                        <Trophy className="h-12 w-12 text-green-600" />
                      ) : (
                        <RefreshCw className="h-12 w-12 text-red-600" />
                      )}
                    </div>
                    <h3 className="text-2xl font-bold">
                      {quizResult.passed ? 'Поздравляем!' : 'Попробуйте еще раз'}
                    </h3>
                    <p className="mt-2 text-lg">
                      Ваш результат: {quizResult.score}%
                    </p>
                    <p className="text-muted-foreground">
                      Правильных ответов: {quizResult.correct_answers} из {quizResult.total_questions}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Необходимо для прохождения: {quizResult.passing_score}%
                    </p>

                    {!quizResult.passed && (
                      <Button
                        className="mt-6"
                        onClick={() => {
                          setQuizResult(null)
                          setQuizAnswers({})
                        }}
                      >
                        Пройти еще раз
                      </Button>
                    )}
                  </div>
                ) : (
                  // Quiz questions
                  <>
                    {quizQuestions.map((question, index) => (
                      <div key={question.id} className="space-y-3">
                        <p className="font-medium">
                          {index + 1}. {question.question}
                        </p>
                        <div className="space-y-2">
                          {question.options.map((option, optionIndex) => (
                            <button
                              key={optionIndex}
                              onClick={() => handleQuizAnswer(question.id, optionIndex)}
                              className={`
                                w-full rounded-lg border p-3 text-left transition-colors
                                ${
                                  quizAnswers[question.id] === optionIndex
                                    ? 'border-primary bg-primary/5'
                                    : 'hover:bg-muted'
                                }
                              `}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleQuizSubmit}
                      disabled={
                        Object.keys(quizAnswers).length < quizQuestions.length ||
                        quizSubmitting
                      }
                    >
                      {quizSubmitting ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        'Завершить тест'
                      )}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              // Interactive module
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-6 text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">
                    Интерактивный модуль
                  </p>
                </div>
                <Button className="w-full" onClick={handleMarkCompleted}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Завершить модуль
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with certification status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <GraduationCap className="h-6 w-6" />
            Обучение персонала
          </h2>
          <p className="text-muted-foreground">
            Станьте Амбассадором Честно
          </p>
        </div>

        {certification && (
          <div className="flex items-center gap-3">
            {certification.is_certified ? (
              <Badge className="bg-green-100 text-green-700">
                <Award className="mr-1 h-4 w-4" />
                Сертифицирован
              </Badge>
            ) : (
              <Badge variant="outline">
                {certification.modules_completed}/{certification.total_modules} модулей
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Overall progress */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Общий прогресс</p>
              <p className="text-3xl font-bold">{overallProgress}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Завершено модулей</p>
              <p className="text-lg font-semibold">
                {progress.filter((p) => p.status === 'completed').length} из {modules.length}
              </p>
            </div>
          </div>
          <Progress value={overallProgress} className="mt-4 h-3" />
        </CardContent>
      </Card>

      {/* Modules list */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const moduleProgress = getModuleProgress(module.id)
          const status = moduleProgress?.status || 'not_started'
          const statusConfig = STATUS_CONFIG[status]
          const StatusIcon = statusConfig.icon
          const available = isModuleAvailable(module)

          return (
            <Card
              key={module.id}
              className={`
                cursor-pointer transition-all hover:shadow-md
                ${!available ? 'opacity-60' : ''}
              `}
              onClick={() => available && setActiveModuleId(module.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{module.title}</CardTitle>
                  {!available ? (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                  )}
                </div>
                <CardDescription className="line-clamp-2">
                  {module.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {module.duration_minutes} мин
                  </div>
                  <span className={statusConfig.color}>
                    {statusConfig.label}
                  </span>
                </div>

                {moduleProgress && moduleProgress.progress_percent > 0 && status !== 'completed' && (
                  <Progress
                    value={moduleProgress.progress_percent}
                    className="mt-3 h-1"
                  />
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Certification info */}
      {certification && !certification.is_certified && overallProgress >= 80 && (
        <Alert>
          <Award className="h-4 w-4" />
          <AlertTitle>Почти готово!</AlertTitle>
          <AlertDescription>
            Завершите все модули и пройдите финальный тест, чтобы получить сертификат Амбассадора Честно.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default StaffTrainingPortal
