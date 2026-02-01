/**
 * Report Content Button
 * Trigger button for opening the report submission modal.
 */
import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ReportContentModal } from './ReportContentModal'
import type { ContentType } from '@/types/moderation'
import { useAuthV2 } from '@/auth/AuthProviderV2'

interface ReportContentButtonProps {
  /** Type of content being reported */
  contentType: ContentType | 'user'
  /** ID of the content being reported */
  contentId: string
  /** Optional title for display in modal */
  contentTitle?: string
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline' | 'link' | 'icon'
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Custom class name */
  className?: string
  /** Callback when report is submitted successfully */
  onSuccess?: () => void
}

export function ReportContentButton({
  contentType,
  contentId,
  contentTitle,
  variant = 'ghost',
  size = 'sm',
  className,
  onSuccess,
}: ReportContentButtonProps) {
  const { isAuthenticated } = useAuthV2()
  const [showModal, setShowModal] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)

  const handleClick = () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true)
      setTimeout(() => setShowAuthPrompt(false), 3000)
      return
    }
    setShowModal(true)
  }

  const handleSuccess = () => {
    setShowModal(false)
    onSuccess?.()
  }

  // Icon-only variant
  if (variant === 'icon' || size === 'icon') {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={className}
                onClick={handleClick}
                aria-label="Пожаловаться"
              >
                <Flag className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showAuthPrompt ? (
                <p className="text-red-500">Войдите, чтобы отправить жалобу</p>
              ) : (
                <p>Пожаловаться</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {showModal && (
          <ReportContentModal
            contentType={contentType}
            contentId={contentId}
            contentTitle={contentTitle}
            onClose={() => setShowModal(false)}
            onSuccess={handleSuccess}
          />
        )}
      </>
    )
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
      >
        <Flag className="h-4 w-4 mr-2" />
        Пожаловаться
      </Button>

      {showAuthPrompt && (
        <div className="absolute z-50 bg-destructive text-destructive-foreground px-3 py-2 rounded-md text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
          Войдите, чтобы отправить жалобу
        </div>
      )}

      {showModal && (
        <ReportContentModal
          contentType={contentType}
          contentId={contentId}
          contentTitle={contentTitle}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}

/**
 * Compact report link for inline use
 */
export function ReportContentLink({
  contentType,
  contentId,
  contentTitle,
  className,
  onSuccess,
}: Omit<ReportContentButtonProps, 'variant' | 'size'>) {
  const { isAuthenticated } = useAuthV2()
  const [showModal, setShowModal] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      // Redirect to auth or show prompt
      return
    }
    setShowModal(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`text-xs text-muted-foreground hover:text-destructive transition-colors ${className}`}
      >
        Пожаловаться
      </button>

      {showModal && (
        <ReportContentModal
          contentType={contentType}
          contentId={contentId}
          contentTitle={contentTitle}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            onSuccess?.()
          }}
        />
      )}
    </>
  )
}
