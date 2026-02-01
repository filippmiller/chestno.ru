// ComparisonChart.tsx - Radar chart visualization
// Shows multi-dimensional comparison using Recharts

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { ComparisonProduct } from '../../types/comparison';

interface ComparisonChartProps {
  products: ComparisonProduct[];
}

// Color palette for products
const COLORS = [
  '#8B1538', // burgundy
  '#3B82F6', // blue
  '#22C55E', // green
  '#F97316', // orange
];

// Metrics for radar chart
const RADAR_METRICS = [
  { key: 'journeyScore', label: 'Путь' },
  { key: 'certificationScore', label: 'Сертификаты' },
  { key: 'traceabilityScore', label: 'Отслеживание' },
  { key: 'documentationScore', label: 'Документы' },
  { key: 'overallScore', label: 'Общая' },
];

export function ComparisonChart({ products }: ComparisonChartProps) {
  // Transform data for radar chart
  const chartData = RADAR_METRICS.map((metric) => {
    const dataPoint: Record<string, string | number> = {
      metric: metric.label,
    };

    products.forEach((product, idx) => {
      const value = product[metric.key as keyof ComparisonProduct] as number;
      dataPoint[`product${idx}`] = value || 0;
      dataPoint[`name${idx}`] = product.productName;
    });

    return dataPoint;
  });

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <h3 className="font-display text-lg text-graphite mb-4">
        Визуальное сравнение
      </h3>
      <p className="text-sm text-graphite-light mb-6">
        Радарная диаграмма показывает сильные и слабые стороны каждого продукта
      </p>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid
              stroke="#e5e7eb"
              strokeDasharray="3 3"
            />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickCount={5}
            />

            {products.map((product, idx) => (
              <Radar
                key={product.productId}
                name={truncateName(product.productName, 20)}
                dataKey={`product${idx}`}
                stroke={COLORS[idx]}
                fill={COLORS[idx]}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}

            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => (
                <span className="text-sm text-graphite">{value}</span>
              )}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload) return null;

                return (
                  <div className="bg-white border border-border rounded-lg shadow-lg p-3">
                    <p className="font-medium text-graphite mb-2">{label}</p>
                    {payload.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-graphite-light">{entry.name}:</span>
                        <span className="font-medium text-graphite">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend explanation */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {RADAR_METRICS.map((metric) => (
            <div key={metric.key} className="flex items-start gap-1.5">
              <span className="font-medium text-graphite">{metric.label}:</span>
              <span className="text-graphite-light">
                {getMetricDescription(metric.key)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 3) + '...';
}

function getMetricDescription(key: string): string {
  const descriptions: Record<string, string> = {
    journeyScore: 'Полнота пути',
    certificationScore: 'Сертификация',
    traceabilityScore: 'Прослеживаемость',
    documentationScore: 'Фото и видео',
    overallScore: 'Итоговая оценка',
  };
  return descriptions[key] || '';
}

export default ComparisonChart;
