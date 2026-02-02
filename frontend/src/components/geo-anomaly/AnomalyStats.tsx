import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import type { AnomalyStatistics, AnomalyTrendItem } from '@/types/geoAnomaly'

interface StatsCardProps {
  title: string
  value: number | string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

function StatsCard({ title, value, description, variant = 'default' }: StatsCardProps) {
  const colorClasses = {
    default: 'text-foreground',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold" style={{ color: colorClasses[variant] }}>
          {value}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

interface AnomalyStatsDashboardProps {
  stats: AnomalyStatistics
  trend: AnomalyTrendItem[]
  loading?: boolean
}

export function AnomalyStatsDashboard({ stats, trend, loading }: AnomalyStatsDashboardProps) {
  if (loading) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Загрузка статистики...
      </div>
    )
  }

  const criticalAndHigh = stats.by_severity.critical + stats.by_severity.high
  const needsAttention = stats.by_status.new + stats.by_status.under_review

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Всего аномалий"
          value={stats.total_anomalies}
          description={`За последние ${stats.period_days} дней`}
        />
        <StatsCard
          title="Требуют внимания"
          value={needsAttention}
          description="Новые и на рассмотрении"
          variant={needsAttention > 0 ? 'warning' : 'default'}
        />
        <StatsCard
          title="Критические/Высокие"
          value={criticalAndHigh}
          description="Серьезные нарушения"
          variant={criticalAndHigh > 0 ? 'danger' : 'success'}
        />
        <StatsCard
          title="Решено"
          value={stats.by_status.resolved}
          description="Закрытые инциденты"
          variant="success"
        />
      </div>

      {/* Trend Chart */}
      {trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Тренд аномалий</CardTitle>
            <CardDescription>
              Динамика обнаружения аномалий по дням
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => {
                    const d = new Date(date)
                    return `${d.getDate()}.${d.getMonth() + 1}`
                  }}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString('ru-RU')}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Всего"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="critical"
                  name="Критические"
                  stroke="#991b1b"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  name="Высокие"
                  stroke="#ef4444"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>По статусу</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatusBar
                label="Новые"
                value={stats.by_status.new}
                total={stats.total_anomalies}
                color="bg-blue-500"
              />
              <StatusBar
                label="На рассмотрении"
                value={stats.by_status.under_review}
                total={stats.total_anomalies}
                color="bg-purple-500"
              />
              <StatusBar
                label="Подтверждены"
                value={stats.by_status.confirmed}
                total={stats.total_anomalies}
                color="bg-red-500"
              />
              <StatusBar
                label="Ложные"
                value={stats.by_status.false_positive}
                total={stats.total_anomalies}
                color="bg-gray-400"
              />
              <StatusBar
                label="Решены"
                value={stats.by_status.resolved}
                total={stats.total_anomalies}
                color="bg-green-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Severity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>По критичности</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatusBar
                label="Критические"
                value={stats.by_severity.critical}
                total={stats.total_anomalies}
                color="bg-red-800"
              />
              <StatusBar
                label="Высокие"
                value={stats.by_severity.high}
                total={stats.total_anomalies}
                color="bg-red-500"
              />
              <StatusBar
                label="Средние"
                value={stats.by_severity.medium}
                total={stats.total_anomalies}
                color="bg-orange-500"
              />
              <StatusBar
                label="Низкие"
                value={stats.by_severity.low}
                total={stats.total_anomalies}
                color="bg-yellow-500"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Anomaly Regions */}
      {stats.top_anomaly_regions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Топ регионов с аномалиями</CardTitle>
            <CardDescription>
              Регионы с наибольшим количеством несанкционированных сканирований
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.top_anomaly_regions} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="region_name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" name="Аномалии" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface StatusBarProps {
  label: string
  value: number
  total: number
  color: string
}

function StatusBar({ label, value, total, color }: StatusBarProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface CompactStatsProps {
  stats: AnomalyStatistics
}

export function CompactAnomalyStats({ stats }: CompactStatsProps) {
  const criticalAndHigh = stats.by_severity.critical + stats.by_severity.high
  const needsAttention = stats.by_status.new + stats.by_status.under_review

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={stats.total_anomalies > 0 ? 'destructive' : 'secondary'}>
        {stats.total_anomalies} аномалий
      </Badge>
      {needsAttention > 0 && (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          {needsAttention} требуют внимания
        </Badge>
      )}
      {criticalAndHigh > 0 && (
        <Badge variant="destructive">
          {criticalAndHigh} критичных
        </Badge>
      )}
      {stats.by_status.resolved > 0 && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          {stats.by_status.resolved} решено
        </Badge>
      )}
    </div>
  )
}
