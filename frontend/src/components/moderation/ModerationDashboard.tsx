/**
 * Moderation Dashboard
 * Main interface for content moderators with queue, stats, and tools.
 */
import { useState, useEffect } from 'react';
import type {
  ModerationQueueItem,
  ModerationStats,
  ModerationQueueFilters,
  ContentType,
  QueueStatus,
} from '../../types/moderation';
import {
  CONTENT_TYPE_LABELS,
  QUEUE_STATUS_LABELS,
} from '../../types/moderation';
import { ModerationQueueTable } from './ModerationQueueTable';
import { ModerationItemDetail } from './ModerationItemDetail';

interface ModerationDashboardProps {
  onError?: (error: string) => void;
}

export function ModerationDashboard({ onError }: ModerationDashboardProps) {
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [queueItems, setQueueItems] = useState<ModerationQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null);
  
  const [filters, setFilters] = useState<ModerationQueueFilters>({
    status: 'pending',
    order_by: 'priority',
    limit: 20,
    offset: 0,
  });

  // Fetch stats
  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch queue when filters change
  useEffect(() => {
    fetchQueue();
  }, [filters]);

  async function fetchStats() {
    try {
      const response = await fetch('/api/moderation/v2/queue/stats', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  async function fetchQueue() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.content_type) params.set('content_type', filters.content_type);
      if (filters.source) params.set('source', filters.source);
      if (filters.min_priority) params.set('min_priority', filters.min_priority.toString());
      if (filters.order_by) params.set('order_by', filters.order_by);
      params.set('limit', (filters.limit || 20).toString());
      params.set('offset', (filters.offset || 0).toString());

      const response = await fetch(`/api/moderation/v2/queue?${params}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setQueueItems(data.items);
        setTotal(data.total);
      } else {
        onError?.('Failed to load moderation queue');
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
      onError?.('Network error loading queue');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign(itemId: string) {
    try {
      const response = await fetch(`/api/moderation/v2/queue/${itemId}/assign`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        fetchQueue();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to assign item:', err);
    }
  }

  async function handleDecision(
    itemId: string, 
    action: string, 
    notes?: string,
    violationType?: string,
    guidelineCode?: string
  ) {
    try {
      const response = await fetch(`/api/moderation/v2/queue/${itemId}/decide`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes,
          violation_type: violationType,
          guideline_code: guidelineCode,
        }),
      });
      if (response.ok) {
        setSelectedItem(null);
        fetchQueue();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to make decision:', err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Модерация контента
        </h1>
        <p className="text-gray-600 mt-1">
          Очередь на проверку и инструменты модератора
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard 
            label="Ожидает" 
            value={stats.pending_count} 
            color="bg-yellow-100 text-yellow-800"
          />
          <StatCard 
            label="На рассмотрении" 
            value={stats.in_review_count} 
            color="bg-blue-100 text-blue-800"
          />
          <StatCard 
            label="Эскалировано" 
            value={stats.escalated_count} 
            color="bg-orange-100 text-orange-800"
          />
          <StatCard 
            label="Апелляции" 
            value={stats.appealed_count} 
            color="bg-purple-100 text-purple-800"
          />
          <StatCard 
            label="Решено сегодня" 
            value={stats.resolved_today} 
            color="bg-green-100 text-green-800"
          />
          <StatCard 
            label="Среднее время (ч)" 
            value={stats.avg_resolution_hours.toFixed(1)} 
            color="bg-gray-100 text-gray-800"
          />
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b flex flex-wrap gap-4 items-center">
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as QueueStatus || undefined, offset: 0 })}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          {Object.entries(QUEUE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={filters.content_type || ''}
          onChange={(e) => setFilters({ ...filters, content_type: e.target.value as ContentType || undefined, offset: 0 })}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Все типы</option>
          {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={filters.source || ''}
          onChange={(e) => setFilters({ ...filters, source: e.target.value as any || undefined, offset: 0 })}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Все источники</option>
          <option value="auto_flag">Авто-флаг</option>
          <option value="user_report">Жалоба</option>
          <option value="new_content">Новый контент</option>
          <option value="appeal">Апелляция</option>
        </select>

        <select
          value={filters.order_by || 'priority'}
          onChange={(e) => setFilters({ ...filters, order_by: e.target.value as any })}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="priority">По приоритету</option>
          <option value="created_at">По дате</option>
          <option value="updated_at">По обновлению</option>
        </select>

        <div className="flex-1" />

        <span className="text-sm text-gray-600">
          Всего: {total}
        </span>
      </div>

      {/* Queue Table */}
      <div className="px-6 py-4">
        <ModerationQueueTable
          items={queueItems}
          loading={loading}
          onSelect={setSelectedItem}
          onAssign={handleAssign}
          selectedId={selectedItem?.id}
        />

        {/* Pagination */}
        {total > (filters.limit || 20) && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setFilters({ ...filters, offset: Math.max(0, (filters.offset || 0) - (filters.limit || 20)) })}
              disabled={(filters.offset || 0) === 0}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              Назад
            </button>
            <span className="px-4 py-2">
              {Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1} / {Math.ceil(total / (filters.limit || 20))}
            </span>
            <button
              onClick={() => setFilters({ ...filters, offset: (filters.offset || 0) + (filters.limit || 20) })}
              disabled={(filters.offset || 0) + (filters.limit || 20) >= total}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              Вперед
            </button>
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ModerationItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDecision={handleDecision}
          onAssign={() => handleAssign(selectedItem.id)}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}
