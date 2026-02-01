/**
 * Moderation Actions
 * Approve/reject/escalate action buttons and decision form.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { DecisionAction, ViolationSeverity } from '@/types/moderation'

interface ModerationActionsProps {
  isAssigned?: boolean
  onAssign?: () => void
  onDecision: (
    action: DecisionAction,
    data: {
      notes?: string
      violationType?: string
      guidelineCode?: string
      severity?: ViolationSeverity
    }
  ) => void
  isSubmitting?: boolean
  aiFlags?: { pattern_name: string; detects: string }[]
  compact?: boolean
}

const VIOLATION_TYPES = [
  { value: 'fake_business', label: 'Поддельный бизнес' },
  { value: 'misleading_claims', label: 'Вводящие в заблуждение заявления' },
  { value: 'counterfeit_cert', label: 'Поддельные сертификаты' },
  { value: 'offensive_content', label: 'Оскорбительный контент' },
  { value: 'spam', label: 'Спам' },
  { value: 'competitor_attack', label: 'Атака конкурента' },
  { value: 'copyright', label: 'Нарушение авторских прав' },
  { value: 'privacy_violation', label: 'Нарушение конфиденциальности' },
]

const GUIDELINE_CODES = [
  { value: 'AUTH_FAKE_BUSINESS', label: 'Поддельный бизнес' },
  { value: 'AUTH_COUNTERFEIT_CERT', label: 'Поддельные сертификаты' },
  { value: 'ACC_MISLEADING_HEALTH', label: 'Вводящие в заблуждение заявления о здоровье' },
  { value: 'ACC_FALSE_ORIGIN', label: 'Ложная информация о происхождении' },
  { value: 'QUAL_LOW_PHOTO', label: 'Низкое качество фото' },
  { value: 'SAFE_OFFENSIVE', label: 'Оскорбительный контент' },
  { value: 'COMM_COMPETITOR_ATTACK', label: 'Атака конкурента' },
  { value: 'COMM_SPAM', label: 'Спам' },
  { value: 'LEGAL_COPYRIGHT', label: 'Нарушение авторских прав' },
]

export function ModerationActions({
  isAssigned,
  onAssign,
  onDecision,
  isSubmitting,
  aiFlags,
  compact = false,
}: ModerationActionsProps) {
  const [notes, setNotes] = useState('')
  const [violationType, setViolationType] = useState('')
  const [guidelineCode, setGuidelineCode] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<DecisionAction | null>(null)

  const handleAction = (action: DecisionAction) => {
    if (action === 'reject' && !notes.trim()) {
      setPendingAction(action)
      setShowRejectDialog(true)
      return
    }

    onDecision(action, {
      notes: notes.trim() || undefined,
      violationType: violationType || undefined,
      guidelineCode: guidelineCode || undefined,
    })
  }

  const confirmReject = () => {
    if (pendingAction) {
      onDecision(pendingAction, {
        notes: notes.trim() || undefined,
        violationType: violationType || undefined,
        guidelineCode: guidelineCode || undefined,
      })
    }
    setShowRejectDialog(false)
    setPendingAction(null)
  }

  if (compact) {
    return (
      <div className="flex gap-2">
        {!isAssigned && onAssign && (
          <Button variant="outline" size="sm" onClick={onAssign} disabled={isSubmitting}>
            Взять
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-orange-600 border-orange-300 hover:bg-orange-50"
          onClick={() => handleAction('escalate')}
          disabled={isSubmitting || !isAssigned}
        >
          Эскалировать
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleAction('reject')}
          disabled={isSubmitting || !isAssigned}
        >
          Отклонить
        </Button>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700"
          onClick={() => handleAction('approve')}
          disabled={isSubmitting || !isAssigned}
        >
          Одобрить
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* AI Flags Warning */}
      {aiFlags && aiFlags.length > 0 && (
        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
            AI обнаружил потенциальные проблемы:
          </p>
          <ul className="text-sm text-orange-700 dark:text-orange-400 list-disc list-inside">
            {aiFlags.map((flag, i) => (
              <li key={i}>
                {flag.pattern_name}: {flag.detects}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decision Form */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="mod-notes">Заметка / Причина</Label>
          <Textarea
            id="mod-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Добавьте заметку или причину решения..."
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Тип нарушения</Label>
            <Select value={violationType} onValueChange={setViolationType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Не указано</SelectItem>
                {VIOLATION_TYPES.map((vt) => (
                  <SelectItem key={vt.value} value={vt.value}>
                    {vt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Нарушенное правило</Label>
            <Select value={guidelineCode} onValueChange={setGuidelineCode}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Не указано</SelectItem>
                {GUIDELINE_CODES.map((gc) => (
                  <SelectItem key={gc.value} value={gc.value}>
                    {gc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-2">
        {!isAssigned && onAssign && (
          <Button variant="outline" onClick={onAssign} disabled={isSubmitting}>
            Взять на себя
          </Button>
        )}

        <Button
          variant="outline"
          className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
          onClick={() => handleAction('escalate')}
          disabled={isSubmitting || !isAssigned}
        >
          Эскалировать
        </Button>

        <Button
          variant="destructive"
          onClick={() => handleAction('reject')}
          disabled={isSubmitting || !isAssigned}
        >
          Отклонить
        </Button>

        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => handleAction('approve')}
          disabled={isSubmitting || !isAssigned}
        >
          Одобрить
        </Button>
      </div>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить без причины?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы не указали причину отклонения. Рекомендуется добавить заметку для аудита и
              возможных апелляций.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject}>Отклонить без причины</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
