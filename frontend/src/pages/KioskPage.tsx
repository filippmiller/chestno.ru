/**
 * KioskPage
 *
 * Full-screen kiosk mode page for in-store tablets.
 * Handles device code from URL params and renders the kiosk interface.
 */
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle, Settings, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KioskMode } from '@/components/kiosk/KioskMode'

export function KioskPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [deviceCode, setDeviceCode] = useState<string>(
    searchParams.get('device') || ''
  )
  const [isKioskMode, setIsKioskMode] = useState(false)
  const [inputCode, setInputCode] = useState('')

  // Check for device code in URL on mount
  useEffect(() => {
    const urlDeviceCode = searchParams.get('device')
    if (urlDeviceCode) {
      setDeviceCode(urlDeviceCode)
      setIsKioskMode(true)
    }
  }, [searchParams])

  // Enter kiosk mode
  const handleStartKiosk = () => {
    if (inputCode.trim()) {
      setDeviceCode(inputCode.trim())
      setIsKioskMode(true)
      // Update URL without navigation
      window.history.replaceState(null, '', `/kiosk?device=${inputCode.trim()}`)
    }
  }

  // Exit kiosk mode
  const handleExitKiosk = () => {
    // In production, this might require a PIN or admin authentication
    const confirmExit = window.confirm('Вы уверены, что хотите выйти из режима киоска?')
    if (confirmExit) {
      setIsKioskMode(false)
      setDeviceCode('')
      navigate('/kiosk')
    }
  }

  // Request fullscreen
  const requestFullscreen = () => {
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
    }
  }

  // If in kiosk mode, render the kiosk interface
  if (isKioskMode && deviceCode) {
    return <KioskMode deviceCode={deviceCode} onExit={handleExitKiosk} />
  }

  // Setup/configuration view
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Настройка киоска</CardTitle>
          <CardDescription>
            Введите код устройства для запуска режима киоска
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="deviceCode">Код устройства</Label>
            <Input
              id="deviceCode"
              placeholder="Например: KIOSK-001"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartKiosk()}
              className="text-center text-lg"
            />
            <p className="text-xs text-muted-foreground text-center">
              Код устройства можно найти в панели управления магазином
            </p>
          </div>

          <Button className="w-full" size="lg" onClick={handleStartKiosk}>
            Запустить киоск
          </Button>

          <div className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={requestFullscreen}
            >
              <Settings className="mr-2 h-4 w-4" />
              Включить полноэкранный режим
            </Button>
          </div>

          {/* Help section */}
          <div className="rounded-lg bg-muted p-4 text-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">Как настроить киоск?</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Зарегистрируйте устройство в панели управления</li>
                  <li>Получите код устройства</li>
                  <li>Введите код выше и нажмите "Запустить"</li>
                  <li>Включите полноэкранный режим</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Demo mode */}
          <div className="text-center">
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setInputCode('DEMO-001')
                setDeviceCode('DEMO-001')
                setIsKioskMode(true)
              }}
            >
              Запустить демо-режим
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default KioskPage
