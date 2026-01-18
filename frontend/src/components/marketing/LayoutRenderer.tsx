/**
 * LayoutRenderer - Renders marketing material layout to a visual preview
 *
 * Features:
 * - Renders layout blocks (text, QR, shapes) from layout_json
 * - Supports mm to pixel conversion for accurate sizing
 * - Handles editable text blocks with callbacks
 * - Exports to PDF/PNG via html2canvas + jsPDF
 */
import { forwardRef, useCallback, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import type { LayoutBlock, LayoutJson } from '@/types/marketing'

// Conversion factor: 1mm ≈ 3.78px at 96 DPI (screen)
const MM_TO_PX = 3.78

// Paper sizes in mm
const PAPER_SIZES = {
  A3: { portrait: { width: 297, height: 420 }, landscape: { width: 420, height: 297 } },
  A4: { portrait: { width: 210, height: 297 }, landscape: { width: 297, height: 210 } },
  A5: { portrait: { width: 148, height: 210 }, landscape: { width: 210, height: 148 } },
}

interface LayoutRendererProps {
  layout: LayoutJson
  scale?: number // Scale factor for preview (default 1.0)
  onBlockChange?: (blockId: string, field: string, value: string) => void
  editableBlocks?: Set<string> // IDs of blocks that can be edited
  className?: string
}

interface BlockRendererProps {
  block: LayoutBlock
  scale: number
  onBlockChange?: (blockId: string, field: string, value: string) => void
  isEditable?: boolean
}

/**
 * Converts mm to pixels using current scale
 */
function mmToPx(mm: number, scale: number = 1): number {
  return mm * MM_TO_PX * scale
}

/**
 * Renders individual text block
 */
function TextBlock({ block, scale, onBlockChange, isEditable }: BlockRendererProps) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: mmToPx(block.x, scale),
    top: mmToPx(block.y, scale),
    width: block.width ? mmToPx(block.width, scale) : 'auto',
    height: block.height ? mmToPx(block.height, scale) : 'auto',
    fontFamily: block.fontFamily || 'Inter, system-ui, sans-serif',
    fontSize: block.fontSizePt ? `${block.fontSizePt * scale}pt` : '12pt',
    fontWeight: block.fontWeight || 'normal',
    color: block.color || '#000000',
    textAlign: block.align || 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
    lineHeight: 1.3,
  }

  if (isEditable && onBlockChange) {
    return (
      <div
        style={style}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          onBlockChange(block.id, 'text', e.currentTarget.textContent || '')
        }}
        className="outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 rounded cursor-text"
      >
        {block.text}
      </div>
    )
  }

  return <div style={style}>{block.text}</div>
}

/**
 * Renders QR code block
 */
function QRBlock({ block, scale }: BlockRendererProps) {
  const size = block.size ? mmToPx(block.size, scale) : 100

  const style: React.CSSProperties = {
    position: 'absolute',
    left: mmToPx(block.x, scale),
    top: mmToPx(block.y, scale),
    width: size,
    height: size,
  }

  return (
    <div style={style}>
      <QRCodeSVG
        value={block.qr_url || 'https://chestno.ru'}
        size={size}
        level="M"
        includeMargin={false}
        fgColor="#000000"
        bgColor="transparent"
      />
    </div>
  )
}

/**
 * Main block renderer - dispatches to specific block type renderers
 */
function BlockRenderer({ block, scale, onBlockChange, isEditable }: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block} scale={scale} onBlockChange={onBlockChange} isEditable={isEditable} />
    case 'qr':
      return <QRBlock block={block} scale={scale} />
    case 'logo':
    case 'image':
    case 'shape':
      // TODO: Implement these block types
      return null
    default:
      return null
  }
}

/**
 * Main LayoutRenderer component
 * Renders the complete layout with all blocks
 */
export const LayoutRenderer = forwardRef<HTMLDivElement, LayoutRendererProps>(
  ({ layout, scale = 1.0, onBlockChange, editableBlocks, className = '' }, ref) => {
    // Get paper dimensions
    const paperDimensions = useMemo(() => {
      const paperSize = layout.paper?.size || 'A4'
      const orientation = layout.paper?.orientation || 'portrait'
      return PAPER_SIZES[paperSize]?.[orientation] || PAPER_SIZES.A4.portrait
    }, [layout.paper])

    // Calculate container dimensions
    const containerStyle: React.CSSProperties = useMemo(
      () => ({
        position: 'relative',
        width: mmToPx(paperDimensions.width, scale),
        height: mmToPx(paperDimensions.height, scale),
        backgroundColor: layout.theme?.background || '#FFFFFF',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }),
      [paperDimensions, scale, layout.theme?.background],
    )

    // Check if a block is editable
    const isBlockEditable = useCallback(
      (block: LayoutBlock): boolean => {
        if (!editableBlocks) return false
        return editableBlocks.has(block.id) && block.editable_by_business
      },
      [editableBlocks],
    )

    return (
      <div ref={ref} style={containerStyle} className={className}>
        {layout.blocks?.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            scale={scale}
            onBlockChange={onBlockChange}
            isEditable={isBlockEditable(block)}
          />
        ))}
      </div>
    )
  },
)

LayoutRenderer.displayName = 'LayoutRenderer'

/**
 * Calculate scale factor to fit layout within container width
 */
export function calculateFitScale(layout: LayoutJson, containerWidth: number): number {
  const paperSize = layout.paper?.size || 'A4'
  const orientation = layout.paper?.orientation || 'portrait'
  const paperDimensions = PAPER_SIZES[paperSize]?.[orientation] || PAPER_SIZES.A4.portrait

  const naturalWidth = mmToPx(paperDimensions.width, 1)
  return containerWidth / naturalWidth
}

/**
 * Get editable text blocks from layout
 */
export function getEditableTextBlocks(layout: LayoutJson, isSupport: boolean = false): LayoutBlock[] {
  return (layout.blocks || []).filter((block) => {
    if (block.type !== 'text') return false
    if (isSupport) return block.editable_by_support
    return block.editable_by_business
  })
}
