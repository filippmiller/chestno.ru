/**
 * INTEGRATION EXAMPLE: How to use UpgradeRequestForm in your dashboard
 *
 * This file demonstrates how to integrate the UpgradeRequestForm component
 * into an OrganizationStatus page or dashboard.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, CheckCircle, Clock, XCircle } from 'lucide-react';
import { UpgradeRequestForm } from '@/components/UpgradeRequestForm';
import { getOrganizationStatus } from '@/api/organizationsService';
import type { OrganizationStatus } from '@/types/organizations';

/**
 * Example: Organization Status Dashboard
 * Shows current status and provides upgrade request functionality
 */
export const OrganizationStatusPage: React.FC<{ organizationId: string }> = ({
  organizationId,
}) => {
  const [status, setStatus] = useState<OrganizationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeFormOpen, setUpgradeFormOpen] = useState(false);

  // Load organization status
  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await getOrganizationStatus(organizationId);
      setStatus(data);
    } catch (error) {
      console.error('Failed to load organization status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [organizationId]);

  // Handle successful upgrade request submission
  const handleUpgradeSuccess = () => {
    // Refresh status after successful submission
    loadStatus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-8 text-center text-gray-500">
        Не удалось загрузить статус организации
      </div>
    );
  }

  // Helper to get level badge
  const getLevelBadge = (level: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      A: 'default',
      B: 'secondary',
      C: 'destructive',
    };
    return <Badge variant={variants[level] || 'default'}>Уровень {level}</Badge>;
  };

  // Helper to get status badge
  const getStatusBadge = (requestStatus: string) => {
    switch (requestStatus) {
      case 'pending':
        return (
          <Badge variant="default" className="bg-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            На рассмотрении
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Одобрен
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Отклонен
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Статус организации</h1>
        {getLevelBadge(status.current_level)}
      </div>

      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Текущий статус</CardTitle>
          <CardDescription>Информация о уровне вашей организации</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Текущий уровень</p>
              <p className="text-2xl font-bold">Уровень {status.current_level}</p>
            </div>
            {status.can_request_upgrade && !status.active_request && (
              <Button onClick={() => setUpgradeFormOpen(true)}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Запросить повышение
              </Button>
            )}
          </div>

          {/* Rate limit info */}
          {!status.can_request_upgrade && status.days_until_next_request !== undefined && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-700">
                Вы можете подать следующий запрос через {status.days_until_next_request} дн.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Request Card */}
      {status.active_request && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Активный запрос</span>
              {getStatusBadge(status.active_request.status)}
            </CardTitle>
            <CardDescription>Информация о текущем запросе на повышение</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Целевой уровень</p>
                <p className="font-semibold">Уровень {status.active_request.target_level}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Дата подачи</p>
                <p className="font-semibold">
                  {new Date(status.active_request.submitted_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">Сообщение</p>
              <p className="text-sm bg-gray-50 p-3 rounded-md">{status.active_request.message}</p>
            </div>

            {status.active_request.evidence_urls &&
              status.active_request.evidence_urls.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Приложенные материалы</p>
                  <ul className="space-y-1">
                    {status.active_request.evidence_urls.map((url, index) => (
                      <li key={index}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {status.active_request.status === 'rejected' && status.active_request.admin_notes && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm font-semibold text-red-700 mb-1">Причина отклонения</p>
                <p className="text-sm text-red-600">{status.active_request.admin_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upgrade Request Form Dialog */}
      <UpgradeRequestForm
        organizationId={organizationId}
        currentLevel={status.current_level}
        open={upgradeFormOpen}
        onOpenChange={setUpgradeFormOpen}
        onSuccess={handleUpgradeSuccess}
      />
    </div>
  );
};

/**
 * Alternative: Minimal integration in existing dashboard
 */
export const MinimalIntegration: React.FC<{
  organizationId: string;
  currentLevel: 'A' | 'B' | 'C';
}> = ({ organizationId, currentLevel }) => {
  const [upgradeFormOpen, setUpgradeFormOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setUpgradeFormOpen(true)} variant="outline">
        Запросить повышение статуса
      </Button>

      <UpgradeRequestForm
        organizationId={organizationId}
        currentLevel={currentLevel}
        open={upgradeFormOpen}
        onOpenChange={setUpgradeFormOpen}
        onSuccess={() => {
          // Handle success - e.g., show notification, refresh data
          console.log('Upgrade request submitted successfully');
        }}
      />
    </>
  );
};
