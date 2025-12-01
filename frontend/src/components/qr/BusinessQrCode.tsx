import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import { Button } from '@/components/ui/button'
import { Download, Copy, Check } from 'lucide-react'

interface BusinessQrCodeProps {
  publicUrl: string
  businessName: string
  size?: number
  showDownload?: boolean
}

export const BusinessQrCode = ({ publicUrl, businessName, size = 256, showDownload = true }: BusinessQrCodeProps) => {
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  const handleDownloadPNG = () => {
    // Create canvas from SVG
    const svgElement = qrRef.current?.querySelector('svg')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    canvas.width = size
    canvas.height = size

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `qr-${businessName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          }
        })
      }
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const handleDownloadA4 = () => {
    // Create a larger canvas for A4 printing
    const svgElement = qrRef.current?.querySelector('svg')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    // A4 size at 300 DPI: 2480x3508 pixels
    // We'll create a poster with QR code centered
    const qrSize = 1200 // Large QR code
    canvas.width = 2480
    canvas.height = 3508

    img.onload = () => {
      if (ctx) {
        // White background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw QR code centered
        const x = (canvas.width - qrSize) / 2
        const y = (canvas.height - qrSize) / 2 - 200
        ctx.drawImage(img, x, y, qrSize, qrSize)

        // Add text
        ctx.fillStyle = 'black'
        ctx.font = 'bold 80px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(businessName, canvas.width / 2, y - 100)

        ctx.font = '60px Arial'
        ctx.fillText('Отсканируйте и оставьте отзыв', canvas.width / 2, y + qrSize + 150)

        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `qr-poster-${businessName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          }
        })
      }
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div ref={qrRef} className="flex flex-col items-center gap-4">
      <div className="rounded-lg border-4 border-white bg-white p-4 shadow-lg">
        <QRCodeSVG value={publicUrl} size={size} level="M" includeMargin={true} />
      </div>
      <div className="text-center">
        <p className="font-semibold text-lg">{businessName}</p>
        <p className="text-sm text-muted-foreground">Отсканируйте и оставьте отзыв</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyUrl}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? 'Скопировано' : 'Скопировать URL'}
        </Button>
        {showDownload && (
          <>
            <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
              <Download className="mr-2 h-4 w-4" />
              Скачать PNG
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadA4}>
              <Download className="mr-2 h-4 w-4" />
              Скачать для печати A4
            </Button>
          </>
        )}
      </div>
    </div>
  )
}


