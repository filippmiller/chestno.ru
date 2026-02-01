/**
 * Report Content Modal
 * Allows users to report problematic content for moderation review.
 */
import { useState } from 'react';
import type {
  ContentType,
  ReportReason,
  ContentReportCreate,
} from '../../types/moderation';
import {
  REPORT_REASON_LABELS,
} from '../../types/moderation';

interface ReportContentModalProps {
  contentType: ContentType | 'user';
  contentId: string;
  contentTitle?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReportContentModal({
  contentType,
  contentId,
  contentTitle,
  onClose,
  onSuccess,
}: ReportContentModalProps) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!reason) {
      setError('Пожалуйста, выберите причину жалобы');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: ContentReportCreate = {
        content_type: contentType,
        content_id: contentId,
        reason: reason as ReportReason,
        reason_details: details || undefined,
        evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      };

      const response = await fetch('/api/moderation/v2/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSuccess(true);
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.detail || 'Не удалось отправить жалобу');
      }
    } catch (err) {
      setError('Ошибка сети. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  }

  function addEvidence() {
    if (evidenceUrl && !evidenceUrls.includes(evidenceUrl)) {
      setEvidenceUrls([...evidenceUrls, evidenceUrl]);
      setEvidenceUrl('');
    }
  }

  function removeEvidence(url: string) {
    setEvidenceUrls(evidenceUrls.filter(u => u !== url));
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">✓</div>
          <h3 className="text-xl font-bold text-green-600 mb-2">
            Жалоба отправлена
          </h3>
          <p className="text-gray-600">
            Спасибо за вашу помощь в поддержании качества платформы.
            Мы рассмотрим вашу жалобу в ближайшее время.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Пожаловаться на контент
            </h2>
            {contentTitle && (
              <p className="text-sm text-gray-500 mt-1 truncate max-w-sm">
                {contentTitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Причина жалобы *
            </label>
            <div className="space-y-2">
              {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    reason === value 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={(e) => setReason(e.target.value as ReportReason)}
                    className="mr-3"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Подробности (опционально)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Опишите проблему подробнее..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-gray-500 mt-1">
              {details.length}/1000 символов
            </p>
          </div>

          {/* Evidence URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ссылки на доказательства (опционально)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addEvidence}
                disabled={!evidenceUrl}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
              >
                Добавить
              </button>
            </div>
            {evidenceUrls.length > 0 && (
              <ul className="space-y-1">
                {evidenceUrls.map((url, i) => (
                  <li 
                    key={i} 
                    className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded"
                  >
                    <span className="flex-1 truncate">{url}</span>
                    <button
                      type="button"
                      onClick={() => removeEvidence(url)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Warning */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <p className="font-medium mb-1">Важно:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Ложные жалобы могут привести к ограничению вашего аккаунта</li>
              <li>Мы серьезно относимся к каждой жалобе и проверяем их вручную</li>
              <li>Решение модератора будет принято в течение 48 часов</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting || !reason}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Отправка...' : 'Отправить жалобу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
