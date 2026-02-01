/**
 * Moderation Queue Table
 * Displays queue items with priority indicators and quick actions.
 */
import type { ModerationQueueItem } from '../../types/moderation';
import {
  CONTENT_TYPE_LABELS,
  QUEUE_STATUS_LABELS,
  getPriorityColor,
} from '../../types/moderation';

interface ModerationQueueTableProps {
  items: ModerationQueueItem[];
  loading: boolean;
  onSelect: (item: ModerationQueueItem) => void;
  onAssign: (itemId: string) => void;
  selectedId?: string;
}

export function ModerationQueueTable({
  items,
  loading,
  onSelect,
  onAssign,
  selectedId,
}: ModerationQueueTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-gray-600">Загрузка очереди...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-4xl mb-4">🎉</div>
        <p className="text-gray-600">Очередь пуста. Отличная работа!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Приоритет
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Тип
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Источник
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Статус
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              AI-флаги
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Жалобы
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Модератор
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Дата
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Действия
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => (
            <tr
              key={item.id}
              className={`hover:bg-gray-50 cursor-pointer ${
                selectedId === item.id ? 'bg-blue-50' : ''
              }`}
              onClick={() => onSelect(item)}
            >
              {/* Priority */}
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-3 h-3 rounded-full ${getPriorityColor(item.priority_score)}`}
                    title={`${item.priority_score}/100`}
                  />
                  <span className="text-sm font-medium">
                    {item.priority_score}
                  </span>
                </div>
              </td>

              {/* Content Type */}
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm">
                  {CONTENT_TYPE_LABELS[item.content_type] || item.content_type}
                </span>
              </td>

              {/* Source */}
              <td className="px-4 py-3 whitespace-nowrap">
                <SourceBadge source={item.source} />
              </td>

              {/* Status */}
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusBadge status={item.status} />
              </td>

              {/* AI Flags */}
              <td className="px-4 py-3 whitespace-nowrap">
                {item.ai_flags?.flags && item.ai_flags.flags.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <span className="text-orange-600 text-sm font-medium">
                      {item.ai_flags.flags.length}
                    </span>
                    {item.ai_confidence_score && (
                      <span className="text-xs text-gray-500">
                        ({Math.round(item.ai_confidence_score * 100)}%)
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </td>

              {/* Report Count */}
              <td className="px-4 py-3 whitespace-nowrap">
                {item.report_count > 0 ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {item.report_count}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </td>

              {/* Assigned To */}
              <td className="px-4 py-3 whitespace-nowrap">
                {item.assigned_to_name ? (
                  <span className="text-sm text-gray-900">
                    {item.assigned_to_name}
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssign(item.id);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Взять
                  </button>
                )}
              </td>

              {/* Date */}
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {formatDate(item.created_at)}
              </td>

              {/* Quick Actions */}
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(item);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Открыть
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    auto_flag: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'AI' },
    user_report: { bg: 'bg-red-100', text: 'text-red-800', label: 'Жалоба' },
    new_content: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Новый' },
    edit: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Изменение' },
    appeal: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Апелляция' },
  };

  const style = config[source] || { bg: 'bg-gray-100', text: 'text-gray-800', label: source };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    in_review: { bg: 'bg-blue-100', text: 'text-blue-800' },
    approved: { bg: 'bg-green-100', text: 'text-green-800' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800' },
    escalated: { bg: 'bg-orange-100', text: 'text-orange-800' },
    appealed: { bg: 'bg-purple-100', text: 'text-purple-800' },
    resolved: { bg: 'bg-gray-100', text: 'text-gray-800' },
  };

  const style = config[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
  const label = QUEUE_STATUS_LABELS[status as keyof typeof QUEUE_STATUS_LABELS] || status;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Только что';
  if (hours < 24) return `${hours} ч назад`;
  if (days < 7) return `${days} дн назад`;
  
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}
