import { useState, useCallback } from 'react'
import { Check, Copy, Link2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** URL to share */
  url: string
  /** Title for the share */
  title: string
  /** Description for the share */
  description?: string
  /** Image URL for rich shares */
  imageUrl?: string
}

interface ShareOption {
  id: string
  name: string
  icon: React.ReactNode
  color: string
  hoverColor: string
  getShareUrl: (url: string, title: string, description?: string) => string
}

const shareOptions: ShareOption[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: <Send className="h-5 w-5" />,
    color: 'bg-[#0088cc]',
    hoverColor: 'hover:bg-[#0077b5]',
    getShareUrl: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: <MessageCircle className="h-5 w-5" />,
    color: 'bg-[#25D366]',
    hoverColor: 'hover:bg-[#20bd5a]',
    getShareUrl: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    id: 'vk',
    name: 'VK',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.576-1.496c.588-.19 1.341 1.26 2.14 1.818.605.422 1.064.33 1.064.33l2.137-.03s1.117-.071.588-.964c-.043-.073-.308-.661-1.588-1.87-1.34-1.264-1.16-1.059.453-3.246.983-1.332 1.376-2.145 1.253-2.493-.117-.332-.84-.244-.84-.244l-2.406.015s-.178-.025-.31.056c-.13.079-.212.262-.212.262s-.382 1.03-.89 1.907c-1.07 1.85-1.499 1.948-1.674 1.832-.407-.267-.305-1.075-.305-1.648 0-1.793.267-2.54-.521-2.733-.262-.065-.454-.107-1.123-.114-.858-.009-1.585.003-1.996.208-.274.136-.485.44-.356.457.159.022.519.099.71.363.246.341.237 1.107.237 1.107s.142 2.11-.33 2.371c-.325.18-.77-.187-1.725-1.865-.489-.859-.859-1.81-.859-1.81s-.07-.176-.198-.27c-.154-.114-.37-.151-.37-.151l-2.286.015s-.343.01-.469.163c-.112.136-.009.418-.009.418s1.796 4.258 3.83 6.404c1.865 1.968 3.984 1.839 3.984 1.839h.96z" />
      </svg>
    ),
    color: 'bg-[#4C75A3]',
    hoverColor: 'hover:bg-[#3d6085]',
    getShareUrl: (url, title, description) =>
      `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}${description ? `&description=${encodeURIComponent(description)}` : ''}`,
  },
]

export function ShareModal({
  open,
  onOpenChange,
  url,
  title,
  description,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }, [url])

  const handleShare = useCallback(
    (option: ShareOption) => {
      const shareUrl = option.getShareUrl(url, title, description)
      window.open(shareUrl, '_blank', 'width=600,height=400')
    },
    [url, title, description]
  )

  // Native share API support
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        })
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error)
        }
      }
    }
  }, [url, title, description])

  const supportsNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Поделиться</DialogTitle>
          <DialogDescription>
            Расскажите друзьям о честном производителе
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Social Share Buttons */}
          <div className="flex justify-center gap-4">
            {shareOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleShare(option)}
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-200',
                  option.color,
                  option.hoverColor,
                  'hover:scale-110 hover:shadow-lg active:scale-95'
                )}
                aria-label={`Поделиться в ${option.name}`}
              >
                {option.icon}
              </button>
            ))}
          </div>

          {/* Native Share Button (mobile) */}
          {supportsNativeShare && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleNativeShare}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Другие способы
            </Button>
          )}

          {/* Copy Link Section */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Или скопируйте ссылку
            </p>
            <div className="flex gap-2">
              <Input
                value={url}
                readOnly
                className="flex-1 bg-muted/50"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className={cn(
                  'shrink-0 transition-colors',
                  copied && 'bg-green-50 text-green-600 border-green-200'
                )}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
