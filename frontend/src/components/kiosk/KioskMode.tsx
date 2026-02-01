/**
 * KioskMode Component
 *
 * Full-screen kiosk interface for in-store tablets where customers can scan
 * products and view detailed trust information without needing the mobile app.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { QrCode, RefreshCw, ArrowLeft, Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { authenticateKiosk, processKioskScan, sendHeartbeat } from '@/api/kioskService'
import { KioskProductDisplay } from './KioskProductDisplay'
import type { KioskConfig, KioskScanResult, KioskState } from '@/types/retail'

interface KioskModeProps {
  deviceCode: string
  onExit?: () => void
}

const IDLE_TIMEOUT_MS = 30000 // 30 seconds before returning to idle
const HEARTBEAT_INTERVAL_MS = 60000 // 1 minute heartbeat

export function KioskMode({ deviceCode, onExit }: KioskModeProps) {
  const [state, setState] = useState<KioskState>('idle')
  const [config, setConfig] = useState<KioskConfig | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<KioskScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  // Clear idle timeout
  const clearIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
  }, [])

  // Start idle timeout
  const startIdleTimeout = useCallback(() => {
    clearIdleTimeout()
    idleTimeoutRef.current = setTimeout(() => {
      setState('idle')
      setScanResult(null)
      setError(null)
    }, IDLE_TIMEOUT_MS)
  }, [clearIdleTimeout])

  // Authenticate kiosk on mount
  useEffect(() => {
    const authenticate = async () => {
      try {
        const response = await authenticateKiosk(deviceCode)
        if (response.success && response.session_token && response.config) {
          setSessionToken(response.session_token)
          setConfig(response.config)
        } else {
          setError(response.error || 'Ошибка аутентификации киоска')
        }
      } catch (err) {
        console.error('Kiosk authentication failed:', err)
        setError('Не удалось подключиться к серверу')
      }
    }

    authenticate()
  }, [deviceCode])

  // Heartbeat interval
  useEffect(() => {
    if (!sessionToken) return

    const sendHeartbeatRequest = async () => {
      try {
        await sendHeartbeat(sessionToken)
      } catch (err) {
        console.error('Heartbeat failed:', err)
      }
    }

    heartbeatIntervalRef.current = setInterval(sendHeartbeatRequest, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [sessionToken])

  // Focus scan input when idle
  useEffect(() => {
    if (state === 'idle' && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearIdleTimeout()
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [clearIdleTimeout])

  // Handle barcode scan
  const handleScan = useCallback(async (barcode: string) => {
    if (!sessionToken || !barcode.trim()) return

    setState('loading')
    clearIdleTimeout()

    try {
      const result = await processKioskScan(sessionToken, barcode.trim())
      setScanResult(result)
      setState('result')
      startIdleTimeout()

      // Play success sound
      if (soundEnabled) {
        const audio = new Audio('/sounds/scan-success.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      }
    } catch (err) {
      console.error('Scan failed:', err)
      setState('error')
      setError('Товар не найден или ошибка сканирования')
      startIdleTimeout()

      // Play error sound
      if (soundEnabled) {
        const audio = new Audio('/sounds/scan-error.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      }
    }
  }, [sessionToken, soundEnabled, clearIdleTimeout, startIdleTimeout])

  // Handle scan input
  const handleScanInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget
      handleScan(input.value)
      input.value = ''
    }
  }, [handleScan])

  // Return to idle
  const returnToIdle = useCallback(() => {
    clearIdleTimeout()
    setState('idle')
    setScanResult(null)
    setError(null)
  }, [clearIdleTimeout])

  // Authentication error state
  if (error && !config) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
            <RefreshCw className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold">Ошибка подключения</h1>
          <p className="mt-2 text-gray-400">{error}</p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (!config) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-gray-400">Подключение киоска...</p>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        backgroundColor: config.brandingColor ? `${config.brandingColor}10` : '#f8fafc',
      }}
    >
      {/* Hidden scan input for barcode scanner */}
      <input
        ref={scanInputRef}
        type="text"
        className="sr-only"
        onKeyDown={handleScanInput}
        autoFocus
      />

      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ backgroundColor: config.brandingColor || '#1e293b' }}
      >
        <div className="flex items-center gap-4">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt={config.storeName} className="h-12 w-auto" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
              <QrCode className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="text-white">
            <h1 className="text-lg font-bold">{config.storeName}</h1>
            <p className="text-sm opacity-75">Проверка товаров Честно</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          {onExit && (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={onExit}
            >
              Выход
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* IDLE STATE */}
        {state === 'idle' && (
          <div className="flex h-full flex-col items-center justify-center p-8">
            <div className="max-w-md text-center">
              {/* Animated QR icon */}
              <div className="relative mx-auto mb-8">
                <div className="h-48 w-48 animate-pulse rounded-3xl bg-primary/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrCode className="h-24 w-24 text-primary" />
                </div>
                {/* Scan line animation */}
                <div className="absolute inset-x-0 top-1/2 h-1 animate-bounce bg-primary/50" />
              </div>

              <h2 className="text-3xl font-bold text-gray-900">
                Отсканируйте товар
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Поднесите штрих-код или QR-код товара к сканеру,
                чтобы проверить его качество и происхождение
              </p>

              {/* Demo button for testing */}
              <Button
                className="mt-8"
                size="lg"
                onClick={() => handleScan('4600000000001')}
              >
                Демо сканирование
              </Button>
            </div>

            {/* Idle video/animation placeholder */}
            {config.idleVideoUrl && (
              <div className="absolute bottom-8 right-8 opacity-50">
                <video
                  src={config.idleVideoUrl}
                  autoPlay
                  loop
                  muted
                  className="h-32 w-auto rounded-lg"
                />
              </div>
            )}
          </div>
        )}

        {/* LOADING STATE */}
        {state === 'loading' && (
          <div className="flex h-full flex-col items-center justify-center p-8">
            <div className="relative">
              {/* Trust badge animation */}
              <div className="h-32 w-32 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-24 animate-pulse rounded-full bg-primary/20" />
              </div>
            </div>
            <p className="mt-6 text-xl text-gray-600">Проверяем товар...</p>
          </div>
        )}

        {/* RESULT STATE */}
        {state === 'result' && scanResult && (
          <div className="h-full p-6">
            <Button
              variant="ghost"
              size="lg"
              className="mb-4"
              onClick={returnToIdle}
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Сканировать другой товар
            </Button>

            <KioskProductDisplay
              result={scanResult}
              config={config}
              sessionToken={sessionToken!}
              onClose={returnToIdle}
            />
          </div>
        )}

        {/* ERROR STATE */}
        {state === 'error' && (
          <div className="flex h-full flex-col items-center justify-center p-8">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
              <QrCode className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Товар не найден
            </h2>
            <p className="mt-2 text-gray-600">{error}</p>
            <Button className="mt-6" size="lg" onClick={returnToIdle}>
              Попробовать снова
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white px-6 py-4">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Powered by Честно.ru</span>
          <span>
            {config.language === 'ru' ? 'Русский' : 'English'}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default KioskMode
