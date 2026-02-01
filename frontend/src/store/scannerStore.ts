import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type {
  CachedProduct,
  CameraPermissionStatus,
  ScanHistoryEntry,
  ScannerConfig,
  ScannerError,
  ScannerState,
  ScanResult,
  ScannedProduct,
} from '@/types/scanner'

// Default scanner configuration optimized for retail barcodes
const DEFAULT_CONFIG: ScannerConfig = {
  fps: 10,
  qrbox: { width: 280, height: 120 },
  aspectRatio: 1.777778,
  formatsToSupport: ['QR_CODE', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128'],
  disableFlip: true,
  showTorchButton: true,
  rememberLastUsedCamera: true,
}

// Cache expiration time: 7 days
const CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000

interface ScannerStore {
  // Scanner state
  state: ScannerState
  permissionStatus: CameraPermissionStatus
  lastScanResult: ScanResult | null
  lastScannedProduct: ScannedProduct | null
  error: ScannerError | null
  config: ScannerConfig
  
  // Camera controls
  isTorchEnabled: boolean
  zoomLevel: number
  
  // Offline cache
  productCache: Record<string, CachedProduct>
  
  // Scan history
  scanHistory: ScanHistoryEntry[]
  
  // Actions
  setState: (state: ScannerState) => void
  setPermissionStatus: (status: CameraPermissionStatus) => void
  setScanResult: (result: ScanResult | null) => void
  setScannedProduct: (product: ScannedProduct | null) => void
  setError: (error: ScannerError | null) => void
  setConfig: (config: Partial<ScannerConfig>) => void
  
  // Camera control actions
  setTorchEnabled: (enabled: boolean) => void
  setZoomLevel: (level: number) => void
  
  // Cache actions
  cacheProduct: (barcode: string, product: ScannedProduct) => void
  getCachedProduct: (barcode: string) => CachedProduct | null
  clearExpiredCache: () => void
  clearAllCache: () => void
  
  // History actions
  addToHistory: (entry: Omit<ScanHistoryEntry, 'id'>) => void
  clearHistory: () => void
  
  // Reset
  reset: () => void
}

export const useScannerStore = create<ScannerStore>()(
  persist(
    (set, get) => ({
      // Initial state
      state: 'idle',
      permissionStatus: 'prompt',
      lastScanResult: null,
      lastScannedProduct: null,
      error: null,
      config: DEFAULT_CONFIG,
      isTorchEnabled: false,
      zoomLevel: 1,
      productCache: {},
      scanHistory: [],
      
      // State setters
      setState: (state) => set({ state }),
      setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
      setScanResult: (lastScanResult) => set({ lastScanResult }),
      setScannedProduct: (lastScannedProduct) => set({ lastScannedProduct }),
      setError: (error) => set({ error }),
      setConfig: (configUpdate) =>
        set((s) => ({ config: { ...s.config, ...configUpdate } })),
      
      // Camera controls
      setTorchEnabled: (isTorchEnabled) => set({ isTorchEnabled }),
      setZoomLevel: (zoomLevel) => set({ zoomLevel }),
      
      // Cache management
      cacheProduct: (barcode, product) => {
        const now = Date.now()
        const cachedProduct: CachedProduct = {
          ...product,
          cachedAt: now,
          expiresAt: now + CACHE_EXPIRATION_MS,
        }
        set((s) => ({
          productCache: {
            ...s.productCache,
            [barcode]: cachedProduct,
          },
        }))
      },
      
      getCachedProduct: (barcode) => {
        const { productCache } = get()
        const cached = productCache[barcode]
        if (!cached) return null
        
        // Check if expired
        if (Date.now() > cached.expiresAt) {
          // Remove expired entry
          set((s) => {
            const newCache = { ...s.productCache }
            delete newCache[barcode]
            return { productCache: newCache }
          })
          return null
        }
        
        return cached
      },
      
      clearExpiredCache: () => {
        const now = Date.now()
        set((s) => {
          const newCache: Record<string, CachedProduct> = {}
          for (const [barcode, product] of Object.entries(s.productCache)) {
            if (product.expiresAt > now) {
              newCache[barcode] = product
            }
          }
          return { productCache: newCache }
        })
      },
      
      clearAllCache: () => set({ productCache: {} }),
      
      // History management
      addToHistory: (entry) => {
        const id = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        set((s) => ({
          scanHistory: [{ ...entry, id }, ...s.scanHistory].slice(0, 100), // Keep last 100 scans
        }))
      },
      
      clearHistory: () => set({ scanHistory: [] }),
      
      // Reset scanner state (but keep cache and history)
      reset: () =>
        set({
          state: 'idle',
          lastScanResult: null,
          lastScannedProduct: null,
          error: null,
          isTorchEnabled: false,
          zoomLevel: 1,
        }),
    }),
    {
      name: 'chestno-scanner-storage',
      partialize: (state) => ({
        // Only persist these fields
        permissionStatus: state.permissionStatus,
        config: state.config,
        productCache: state.productCache,
        scanHistory: state.scanHistory,
      }),
    },
  ),
)
