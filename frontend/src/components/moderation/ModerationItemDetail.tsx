/**
 * Moderation Item Detail
 * Full view of a moderation queue item with decision tools.
 */
import { useState, useEffect } from 'react';
import type {
  ModerationQueueItem,
  ModeratorNote,
  ViolationRecord,
} from '../../types/moderation';
import {
  CONTENT_TYPE_LABELS,
  getPriorityColor,
  getPriorityLabel,
  SEVERITY_COLORS,
} from '../../types/moderation';

interface ModerationItemDetailProps {
  item: ModerationQueueItem;
  onClose: () => void;
  onDecision: (
    itemId: string,
    action: string,
    notes?: string,
    violationType?: string,
    guidelineCode?: string
  ) => void;
  onAssign: () => void;
}

export function ModerationItemDetail({
  item,
  onClose,
  onDecision,
  onAssign,
}: ModerationItemDetailProps) {
  const [notes, setNotes] = useState('');
  const [selectedViolation, setSelectedViolation] = useState('');
  const [selectedGuideline, setSelectedGuideline] = useState('');
  const [moderatorNotes, setModeratorNotes] = useState<ModeratorNote[]>([]);
  const [violationHistory, setViolationHistory] = useState<ViolationRecord[]>([]);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'history' | 'notes'>('content');

  useEffect(() => {
    fetchNotes();
    fetchViolationHistory();
  }, [item.id]);

  async function fetchNotes() {
    try {
      const response = await fetch(
        `/api/moderation/v2/notes/${item.content_type}/${item.content_id}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setModeratorNotes(data);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  }

  async function fetchViolationHistory() {
    try {
      // Get organization ID from content if available
      const orgId = item.content_type === 'organization' 
        ? item.content_id 
        : item.content_snapshot?.organization_id as string;
      
      if (orgId) {
        const response = await fetch(
          `/api/moderation/v2/violations/organization/${orgId}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setViolationHistory(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch violation history:', err);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    
    try {
      const response = await fetch('/api/moderation/v2/notes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_type: item.content_type,
          subject_id: item.content_id,
          note_type: 'observation',
          content: newNote,
        }),
      });
      
      if (response.ok) {
        setNewNote('');
        fetchNotes();
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  }

  function handleQuickAction(action: 'approve' | 'reject' | 'escalate') {
    if (action === 'reject' && !notes) {
      alert('Please provide a reason for rejection');
      return;
    }
    onDecision(item.id, action, notes, selectedViolation, selectedGuideline);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {CONTENT_TYPE_LABELS[item.content_type] || item.content_type}
            </h2>
            <p className="text-sm text-gray-500">
              ID: {item.content_id}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div 
                className={`w-4 h-4 rounded-full ${getPriorityColor(item.priority_score)}`}
              />
              <span className="font-medium">
                {getPriorityLabel(item.priority_score)} ({item.priority_score})
              </span>
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
        </div>

        {/* Tabs */}
        <div className="border-b px-6">
          <div className="flex gap-6">
            <TabButton 
              active={activeTab === 'content'} 
              onClick={() => setActiveTab('content')}
            >
              Контент
            </TabButton>
            <TabButton 
              active={activeTab === 'history'} 
              onClick={() => setActiveTab('history')}
            >
              История нарушений ({violationHistory.length})
            </TabButton>
            <TabButton 
              active={activeTab === 'notes'} 
              onClick={() => setActiveTab('notes')}
            >
              Заметки ({moderatorNotes.length})
            </TabButton>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'content' && (
            <ContentView item={item} />
          )}
          
          {activeTab === 'history' && (
            <ViolationHistoryView violations={violationHistory} />
          )}
          
          {activeTab === 'notes' && (
            <NotesView 
              notes={moderatorNotes}
              newNote={newNote}
              onNewNoteChange={setNewNote}
              onAddNote={addNote}
            />
          )}
        </div>

        {/* Decision Panel */}
        <div className="border-t px-6 py-4 bg-gray-50">
          {/* AI Flags Warning */}
          {item.ai_flags?.flags && item.ai_flags.flags.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm font-medium text-orange-800 mb-2">
                AI обнаружил потенциальные проблемы:
              </p>
              <ul className="text-sm text-orange-700 list-disc list-inside">
                {item.ai_flags.flags.map((flag, i) => (
                  <li key={i}>{flag.pattern_name}: {flag.detects}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Decision Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Заметка / Причина
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Добавьте заметку или причину решения..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={2}
              />
            </div>

            <div className="flex gap-4">
              <select
                value={selectedViolation}
                onChange={(e) => setSelectedViolation(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Тип нарушения (опционально)</option>
                <option value="fake_business">Поддельный бизнес</option>
                <option value="misleading_claims">Вводящие в заблуждение заявления</option>
                <option value="counterfeit_cert">Поддельные сертификаты</option>
                <option value="offensive_content">Оскорбительный контент</option>
                <option value="spam">Спам</option>
                <option value="competitor_attack">Атака конкурента</option>
              </select>

              <select
                value={selectedGuideline}
                onChange={(e) => setSelectedGuideline(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Нарушенное правило (опционально)</option>
                <option value="AUTH_FAKE_BUSINESS">Поддельный бизнес</option>
                <option value="AUTH_COUNTERFEIT_CERT">Поддельные сертификаты</option>
                <option value="ACC_MISLEADING_HEALTH">Вводящие в заблуждение заявления о здоровье</option>
                <option value="SAFE_OFFENSIVE">Оскорбительный контент</option>
                <option value="COMM_SPAM">Спам</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              {!item.assigned_to && (
                <button
                  onClick={onAssign}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Взять на себя
                </button>
              )}
              
              <button
                onClick={() => handleQuickAction('escalate')}
                className="px-4 py-2 bg-orange-100 text-orange-800 rounded-lg text-sm hover:bg-orange-200"
              >
                Эскалировать
              </button>
              
              <button
                onClick={() => handleQuickAction('reject')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Отклонить
              </button>
              
              <button
                onClick={() => handleQuickAction('approve')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                Одобрить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-3 border-b-2 text-sm font-medium transition-colors ${
        active 
          ? 'border-blue-500 text-blue-600' 
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function ContentView({ item }: { item: ModerationQueueItem }) {
  const snapshot = item.content_snapshot;

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-500">Источник</label>
          <p className="font-medium capitalize">{item.source.replace('_', ' ')}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Создано</label>
          <p className="font-medium">{new Date(item.created_at).toLocaleString('ru-RU')}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Жалобы</label>
          <p className="font-medium">{item.report_count}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Уровень эскалации</label>
          <p className="font-medium">{item.escalation_level}</p>
        </div>
      </div>

      {/* Priority Reasons */}
      {item.priority_reason && item.priority_reason.length > 0 && (
        <div>
          <label className="text-sm text-gray-500 block mb-2">Причины приоритета</label>
          <div className="flex flex-wrap gap-2">
            {item.priority_reason.map((reason, i) => (
              <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm">
                {reason}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content Snapshot */}
      {snapshot && (
        <div>
          <label className="text-sm text-gray-500 block mb-2">Содержимое</label>
          <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ViolationHistoryView({ violations }: { violations: ViolationRecord[] }) {
  if (violations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        История нарушений пуста
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {violations.map((v) => (
        <div key={v.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${SEVERITY_COLORS[v.severity]}`}>
              {v.severity.toUpperCase()}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(v.created_at).toLocaleDateString('ru-RU')}
            </span>
          </div>
          <p className="font-medium">{v.violation_type}</p>
          {v.guideline_title && (
            <p className="text-sm text-gray-600">{v.guideline_title}</p>
          )}
          {v.notes && (
            <p className="text-sm text-gray-500 mt-2">{v.notes}</p>
          )}
          {v.consequence && (
            <p className="text-sm text-red-600 mt-1">
              Последствие: {v.consequence.replace('_', ' ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function NotesView({
  notes,
  newNote,
  onNewNoteChange,
  onAddNote,
}: {
  notes: ModeratorNote[];
  newNote: string;
  onNewNoteChange: (value: string) => void;
  onAddNote: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => onNewNoteChange(e.target.value)}
          placeholder="Добавить заметку..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={onAddNote}
          disabled={!newNote.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Добавить
        </button>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Заметок пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {note.author_name || 'Модератор'}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(note.created_at).toLocaleString('ru-RU')}
                </span>
              </div>
              <p className="text-sm text-gray-700">{note.content}</p>
              <span className="text-xs text-gray-400 capitalize">
                {note.note_type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
