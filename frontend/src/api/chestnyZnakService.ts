/**
 * Честный ЗНАК (True API) Integration Service
 *
 * This service provides client-side utilities for interacting with the
 * Честный ЗНАК verification system through our backend proxy.
 *
 * The actual API calls are made server-side to protect credentials.
 * This service handles:
 * - DataMatrix code parsing and normalization
 * - Verification request submission
 * - Response handling and validation
 *
 * @see https://markirovka.ru/community/developers/metody-true-api
 * @see https://github.com/jqxl/py_cz_api
 */

import { httpClient } from './httpClient'
import type {
  ChestnyZnakVerifyRequest,
  ChestnyZnakVerifyResult,
  ChestnyZnakResponse,
  ChestnyZnakStatus,
} from '@/types/verification'

// ============================================
// DataMatrix Code Parsing
// ============================================

/**
 * Parse a DataMatrix code from Честный ЗНАК
 *
 * DataMatrix format: 01[GTIN:14]21[Serial]
 * Example: 0104607144353175215lHP7W'PrBI!N
 *
 * GTIN (Global Trade Item Number) - 14 digits
 * Serial - variable length alphanumeric
 */
export interface ParsedDataMatrix {
  raw: string
  normalized: string
  gtin: string
  serial: string
  isValid: boolean
  errorMessage?: string
}

export function parseDataMatrixCode(code: string): ParsedDataMatrix {
  const result: ParsedDataMatrix = {
    raw: code,
    normalized: '',
    gtin: '',
    serial: '',
    isValid: false,
  }

  if (!code || code.length < 20) {
    result.errorMessage = 'Код слишком короткий'
    return result
  }

  // Remove brackets if present (API returns normalized codes without brackets since May 2025)
  let normalized = code.replace(/[\(\)\[\]]/g, '')

  // Handle different encoding formats
  // GS1 format uses Group Separator (ASCII 29) between elements
  normalized = normalized.replace(/\x1d/g, '')

  // Extract GTIN (starts with "01" followed by 14 digits)
  const gtinMatch = normalized.match(/01(\d{14})/)
  if (!gtinMatch) {
    result.errorMessage = 'Не удалось найти GTIN в коде'
    return result
  }

  result.gtin = gtinMatch[1]

  // Extract Serial (starts with "21")
  const serialMatch = normalized.match(/21([^\x1d]+)/)
  if (!serialMatch) {
    result.errorMessage = 'Не удалось найти серийный номер в коде'
    return result
  }

  result.serial = serialMatch[1]
  result.normalized = normalized
  result.isValid = true

  return result
}

/**
 * Validate GTIN checksum (Luhn-like algorithm)
 */
export function validateGTIN(gtin: string): boolean {
  if (!/^\d{14}$/.test(gtin)) return false

  const digits = gtin.split('').map(Number)
  let sum = 0

  for (let i = 0; i < 13; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3)
  }

  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === digits[13]
}

// ============================================
// QR Code Scanning Helpers
// ============================================

/**
 * Extract DataMatrix from various QR code formats
 * Честный ЗНАК products can have different QR types
 */
export function extractDataMatrixFromQR(qrContent: string): string | null {
  // Direct DataMatrix content
  if (qrContent.startsWith('01') && qrContent.length >= 31) {
    return qrContent
  }

  // URL format (some products have URLs)
  // Example: https://честныйзнак.рф/verify/01GTIN21Serial
  const urlMatch = qrContent.match(/verify\/(01\d{14}21.+)/)
  if (urlMatch) {
    return urlMatch[1]
  }

  // GS1 Digital Link format
  const gs1Match = qrContent.match(/\/01\/(\d{14})\/21\/([^\/\?]+)/)
  if (gs1Match) {
    return `01${gs1Match[1]}21${gs1Match[2]}`
  }

  return null
}

// ============================================
// API Service Methods
// ============================================

/**
 * Verify a product code through our backend proxy
 *
 * The backend handles:
 * 1. Authentication with Честный ЗНАК (GOST certificates)
 * 2. Rate limiting and caching
 * 3. Response parsing and error handling
 */
export async function verifyChestnyZnakCode(
  request: ChestnyZnakVerifyRequest
): Promise<ChestnyZnakVerifyResult> {
  const response = await httpClient.post<ChestnyZnakVerifyResult>(
    '/api/verification/chestny-znak/verify',
    request
  )
  return response.data
}

/**
 * Check if a product GTIN is known in our system
 * Useful for pre-validation before full API call
 */
export async function checkGTINExists(gtin: string): Promise<{
  exists: boolean
  product_id?: string
  product_name?: string
}> {
  const response = await httpClient.get<{
    exists: boolean
    product_id?: string
    product_name?: string
  }>(`/api/verification/gtin/${gtin}`)
  return response.data
}

/**
 * Get product categories supported by Честный ЗНАК
 * Different categories have different verification requirements
 */
export const CHESTNY_ZNAK_CATEGORIES = [
  { code: 'tobacco', name: 'Табачная продукция', enabled: true },
  { code: 'shoes', name: 'Обувь', enabled: true },
  { code: 'medicines', name: 'Лекарства', enabled: true },
  { code: 'perfumery', name: 'Парфюмерия', enabled: true },
  { code: 'tires', name: 'Шины', enabled: true },
  { code: 'clothes', name: 'Одежда', enabled: true },
  { code: 'photo', name: 'Фотоаппараты', enabled: true },
  { code: 'milk', name: 'Молочная продукция', enabled: true },
  { code: 'water', name: 'Вода', enabled: true },
  { code: 'beer', name: 'Пиво', enabled: true },
  { code: 'antiseptic', name: 'Антисептики', enabled: true },
  { code: 'bicycles', name: 'Велосипеды', enabled: true },
  { code: 'wheelchairs', name: 'Кресла-коляски', enabled: true },
  { code: 'snacks', name: 'Снеки', enabled: true },  // Since May 2025
  { code: 'sauces', name: 'Соусы и специи', enabled: true },  // Since July 2025
] as const

// ============================================
// Status Helpers
// ============================================

export function getStatusLabel(status: ChestnyZnakStatus): string {
  const labels: Record<ChestnyZnakStatus, string> = {
    EMITTED: 'Эмитирован',
    APPLIED: 'Нанесен',
    INTRODUCED: 'Введен в оборот',
    IN_CIRCULATION: 'В обороте',
    RETIRED: 'Выбыл из оборота',
    WRITTEN_OFF: 'Списан',
    DISAGGREGATION: 'Расформирован',
  }
  return labels[status] || status
}

export function isValidForPurchaseVerification(status: ChestnyZnakStatus): boolean {
  // Only products that are in circulation or have been sold can verify purchase
  return ['INTRODUCED', 'IN_CIRCULATION', 'RETIRED'].includes(status)
}

export function getStatusColor(status: ChestnyZnakStatus): string {
  switch (status) {
    case 'IN_CIRCULATION':
    case 'INTRODUCED':
      return 'text-green-600'
    case 'RETIRED':
      return 'text-blue-600'
    case 'EMITTED':
    case 'APPLIED':
      return 'text-yellow-600'
    case 'WRITTEN_OFF':
    case 'DISAGGREGATION':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

// ============================================
// Error Handling
// ============================================

export interface ChestnyZnakError {
  code: string
  message: string
  isRetryable: boolean
}

export function parseChestnyZnakError(errorResponse: unknown): ChestnyZnakError {
  // Default error
  const defaultError: ChestnyZnakError = {
    code: 'UNKNOWN',
    message: 'Произошла неизвестная ошибка',
    isRetryable: true,
  }

  if (!errorResponse || typeof errorResponse !== 'object') {
    return defaultError
  }

  const err = errorResponse as Record<string, unknown>

  // Known error codes from Честный ЗНАК
  const errorCodes: Record<string, { message: string; isRetryable: boolean }> = {
    'CIS_NOT_FOUND': {
      message: 'Код маркировки не найден в системе',
      isRetryable: false,
    },
    'INVALID_CIS': {
      message: 'Неверный формат кода маркировки',
      isRetryable: false,
    },
    'AUTH_FAILED': {
      message: 'Ошибка авторизации в системе',
      isRetryable: true,
    },
    'RATE_LIMIT': {
      message: 'Превышен лимит запросов, попробуйте позже',
      isRetryable: true,
    },
    'SERVICE_UNAVAILABLE': {
      message: 'Сервис временно недоступен',
      isRetryable: true,
    },
    'CERTIFICATE_ERROR': {
      message: 'Ошибка сертификата ГОСТ',
      isRetryable: false,
    },
  }

  const code = String(err.code || err.error_code || 'UNKNOWN')
  const known = errorCodes[code]

  if (known) {
    return {
      code,
      message: known.message,
      isRetryable: known.isRetryable,
    }
  }

  return {
    code,
    message: String(err.message || err.error_message || defaultError.message),
    isRetryable: defaultError.isRetryable,
  }
}
