import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit2,
  GripVertical,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  SupplyChainJourney,
  SupplyChainNode,
  SupplyChainNodeCreate,
  SupplyChainNodeType,
  SupplyChainNodeUpdate,
} from '@/types/supply-chain'
import { NODE_TYPE_CONFIGS } from '@/types/supply-chain'
import * as supplyChainService from '@/api/supplyChainService'
import { NodeColors, NodeIcons, NodeLabels } from './SupplyChainNode'

export interface SupplyChainEditorProps {
  organizationId: string
  productId: string
  journey: SupplyChainJourney
  onUpdate: () => void
  className?: string
}

type EditingNode = SupplyChainNodeCreate & { id?: string }

const NODE_TYPES: SupplyChainNodeType[] = [
  'PRODUCER',
  'PROCESSOR',
  'WAREHOUSE',
  'DISTRIBUTOR',
  'RETAILER',
  'CONSUMER',
]

/**
 * Admin editor for managing supply chain nodes and steps.
 * Allows creating, editing, deleting, and reordering nodes.
 */
export function SupplyChainEditor({
  organizationId,
  productId,
  journey,
  onUpdate,
  className,
}: SupplyChainEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<EditingNode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const nodes = journey.nodes.map((jn) => jn.node)

  // Open dialog for new node
  const handleAddNode = () => {
    setEditingNode({
      product_id: productId,
      node_type: 'PRODUCER',
      name: '',
      description: null,
      location: null,
      coordinates: null,
      order_index: nodes.length,
    })
    setError(null)
    setIsDialogOpen(true)
  }

  // Open dialog for editing existing node
  const handleEditNode = (node: SupplyChainNode) => {
    setEditingNode({
      id: node.id,
      product_id: node.product_id,
      node_type: node.node_type,
      name: node.name,
      description: node.description,
      location: node.location,
      coordinates: node.coordinates,
      order_index: node.order_index,
      image_url: node.image_url,
    })
    setError(null)
    setIsDialogOpen(true)
  }

  // Save node (create or update)
  const handleSaveNode = async () => {
    if (!editingNode || !editingNode.name.trim()) {
      setError('Название обязательно')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (editingNode.id) {
        // Update existing node
        const update: SupplyChainNodeUpdate = {
          node_type: editingNode.node_type,
          name: editingNode.name,
          description: editingNode.description,
          location: editingNode.location,
          coordinates: editingNode.coordinates,
          order_index: editingNode.order_index ?? undefined,
        }
        await supplyChainService.updateNode(editingNode.id, update)
      } else {
        // Create new node
        const create: SupplyChainNodeCreate = {
          product_id: productId,
          node_type: editingNode.node_type,
          name: editingNode.name,
          description: editingNode.description,
          location: editingNode.location,
          coordinates: editingNode.coordinates,
          order_index: editingNode.order_index,
        }
        await supplyChainService.createNode(organizationId, create)
      }

      setIsDialogOpen(false)
      setEditingNode(null)
      onUpdate()
    } catch (err) {
      console.error('Failed to save node:', err)
      setError('Не удалось сохранить. Попробуйте еще раз.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete node
  const handleDeleteNode = async (nodeId: string) => {
    if (deleteConfirm !== nodeId) {
      setDeleteConfirm(nodeId)
      return
    }

    try {
      await supplyChainService.deleteNode(nodeId)
      setDeleteConfirm(null)
      onUpdate()
    } catch (err) {
      console.error('Failed to delete node:', err)
      setError('Не удалось удалить узел')
    }
  }

  // Move node up/down
  const handleMoveNode = async (node: SupplyChainNode, direction: 'up' | 'down') => {
    const currentIdx = nodes.findIndex((n) => n.id === node.id)
    const newIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1

    if (newIdx < 0 || newIdx >= nodes.length) return

    try {
      // Swap order indices
      const otherNode = nodes[newIdx]
      await supplyChainService.updateNode(node.id, { order_index: newIdx })
      await supplyChainService.updateNode(otherNode.id, { order_index: currentIdx })
      onUpdate()
    } catch (err) {
      console.error('Failed to move node:', err)
    }
  }

  // Verify node
  const handleVerifyNode = async (nodeId: string) => {
    try {
      await supplyChainService.verifyNode(nodeId)
      onUpdate()
    } catch (err) {
      console.error('Failed to verify node:', err)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Управление цепочкой поставок</CardTitle>
            <CardDescription>
              Добавляйте и редактируйте узлы в цепочке поставок продукта
            </CardDescription>
          </div>
          <Button onClick={handleAddNode}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить узел
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && !isDialogOpen && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {nodes.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50">
            <MapPin className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-muted-foreground">Цепочка поставок пуста</p>
            <Button onClick={handleAddNode} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Добавить первый узел
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {nodes.map((node, idx) => {
              const Icon = NodeIcons[node.node_type]
              const colors = NodeColors[node.node_type]
              const isDeleting = deleteConfirm === node.id

              return (
                <div
                  key={node.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                    isDeleting && 'border-destructive bg-destructive/5'
                  )}
                >
                  {/* Drag handle */}
                  <GripVertical className="h-5 w-5 cursor-move text-muted-foreground" />

                  {/* Order number */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {idx + 1}
                  </div>

                  {/* Node icon */}
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colors.bg)}>
                    <Icon className={cn('h-5 w-5', colors.text)} />
                  </div>

                  {/* Node info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{node.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {NodeLabels[node.node_type]}
                      </Badge>
                      {node.is_verified && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    {node.location && (
                      <p className="truncate text-xs text-muted-foreground">{node.location}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={idx === 0}
                      onClick={() => handleMoveNode(node, 'up')}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={idx === nodes.length - 1}
                      onClick={() => handleMoveNode(node, 'down')}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    {!node.is_verified && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleVerifyNode(node.id)}
                        title="Верифицировать"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditNode(node)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={isDeleting ? 'text-destructive' : ''}
                      onClick={() => handleDeleteNode(node.id)}
                    >
                      {isDeleting ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingNode?.id ? 'Редактировать узел' : 'Добавить узел'}
            </DialogTitle>
            <DialogDescription>
              Укажите информацию о точке в цепочке поставок
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            {/* Node Type */}
            <div className="grid gap-2">
              <Label htmlFor="node_type">Тип узла</Label>
              <Select
                value={editingNode?.node_type}
                onValueChange={(value) =>
                  setEditingNode((prev) =>
                    prev ? { ...prev, node_type: value as SupplyChainNodeType } : null
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  {NODE_TYPES.map((type) => {
                    const config = NODE_TYPE_CONFIGS[type]
                    return (
                      <SelectItem key={type} value={type}>
                        {config.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={editingNode?.name || ''}
                onChange={(e) =>
                  setEditingNode((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                placeholder="Например: Ферма Иванова"
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={editingNode?.description || ''}
                onChange={(e) =>
                  setEditingNode((prev) =>
                    prev ? { ...prev, description: e.target.value || null } : null
                  )
                }
                placeholder="Краткое описание этой точки"
                rows={2}
              />
            </div>

            {/* Location */}
            <div className="grid gap-2">
              <Label htmlFor="location">Местоположение</Label>
              <Input
                id="location"
                value={editingNode?.location || ''}
                onChange={(e) =>
                  setEditingNode((prev) =>
                    prev ? { ...prev, location: e.target.value || null } : null
                  )
                }
                placeholder="Например: Краснодарский край, Россия"
              />
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lat">Широта</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.000001"
                  value={editingNode?.coordinates?.lat || ''}
                  onChange={(e) => {
                    const lat = parseFloat(e.target.value)
                    setEditingNode((prev) =>
                      prev
                        ? {
                            ...prev,
                            coordinates: isNaN(lat)
                              ? null
                              : { lat, lng: prev.coordinates?.lng || 0 },
                          }
                        : null
                    )
                  }}
                  placeholder="45.0355"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lng">Долгота</Label>
                <Input
                  id="lng"
                  type="number"
                  step="0.000001"
                  value={editingNode?.coordinates?.lng || ''}
                  onChange={(e) => {
                    const lng = parseFloat(e.target.value)
                    setEditingNode((prev) =>
                      prev
                        ? {
                            ...prev,
                            coordinates: isNaN(lng)
                              ? null
                              : { lat: prev.coordinates?.lat || 0, lng },
                          }
                        : null
                    )
                  }}
                  placeholder="38.9753"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveNode} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Сохранить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
