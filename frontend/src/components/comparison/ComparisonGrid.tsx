// ComparisonGrid.tsx - Side-by-side metrics comparison grid
// Visual comparison of transparency metrics

import type { ComparisonProduct } from '../../types/comparison';
import { COMPARISON_METRICS } from '../../types/comparison';
import {
  Shield,
  Route,
  Award,
  MapPin,
  FileText,
  Wallet,
  Scale,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

interface ComparisonGridProps {
  products: ComparisonProduct[];
}

const iconMap: Record<string, typeof Shield> = {
  Shield,
  Route,
  Award,
  MapPin,
  FileText,
  Wallet,
  Scale,
};

export function ComparisonGrid({ products }: ComparisonGridProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['transparency', 'journey', 'attributes'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Find best value for each metric
  const findBestIndex = (
    key: keyof ComparisonProduct,
    higherIsBetter: boolean
  ) => {
    const values = products.map((p) => p[key] as number | undefined);
    const validValues = values.filter((v) => v !== undefined && v !== null);
    if (validValues.length === 0) return -1;

    const bestValue = higherIsBetter
      ? Math.max(...(validValues as number[]))
      : Math.min(...(validValues as number[]));

    return values.findIndex((v) => v === bestValue);
  };

  const formatValue = (
    value: number | undefined | null,
    unit?: string
  ): string => {
    if (value === undefined || value === null) return '-';
    if (unit) return `${value}${unit}`;
    return value.toString();
  };

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Section: Transparency Scores */}
      <ComparisonSection
        title="Показатели прозрачности"
        isExpanded={expandedSections.has('transparency')}
        onToggle={() => toggleSection('transparency')}
      >
        <div className="divide-y divide-border">
          {COMPARISON_METRICS.filter((m) =>
            ['overallScore', 'journeyScore', 'certificationScore', 'traceabilityScore', 'documentationScore'].includes(m.key)
          ).map((metric) => {
            const Icon = iconMap[metric.icon] || Shield;
            const bestIdx = findBestIndex(
              metric.key as keyof ComparisonProduct,
              metric.higherIsBetter
            );

            return (
              <div key={metric.key} className="grid grid-cols-[200px_1fr] divide-x divide-border">
                {/* Metric label */}
                <div className="p-4 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-burgundy" />
                    <span className="font-medium text-sm text-graphite">
                      {metric.labelRu}
                    </span>
                  </div>
                  <p className="text-xs text-graphite-light mt-1">
                    {metric.description}
                  </p>
                </div>

                {/* Values */}
                <div className="grid" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
                  {products.map((product, idx) => {
                    const value = product[metric.key as keyof ComparisonProduct] as number | undefined;
                    const isBest = idx === bestIdx && value !== undefined;

                    return (
                      <div
                        key={product.productId}
                        className={cn(
                          'p-4 flex flex-col items-center justify-center',
                          isBest && 'bg-green-50',
                          idx < products.length - 1 && 'border-r border-border'
                        )}
                      >
                        {/* Score bar */}
                        <div className="w-full max-w-[120px] mb-2">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                isBest ? 'bg-green-500' : 'bg-burgundy'
                              )}
                              style={{ width: `${value || 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Value */}
                        <span
                          className={cn(
                            'text-lg font-semibold',
                            isBest ? 'text-green-600' : 'text-graphite'
                          )}
                        >
                          {formatValue(value, metric.unit)}
                        </span>

                        {isBest && (
                          <span className="text-xs text-green-600 mt-1">
                            Лучший
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ComparisonSection>

      {/* Section: Journey Details */}
      <ComparisonSection
        title="Детали пути продукта"
        isExpanded={expandedSections.has('journey')}
        onToggle={() => toggleSection('journey')}
      >
        <div className="divide-y divide-border">
          {/* Journey steps count */}
          <ComparisonRow
            label="Этапов в пути"
            description="Количество задокументированных этапов"
            products={products}
            valueKey="journeyStepsCount"
            higherIsBetter={true}
          />

          {/* Verified steps */}
          <ComparisonRow
            label="Верифицировано"
            description="Этапы с подтверждением"
            products={products}
            valueKey="verifiedStepsCount"
            higherIsBetter={true}
          />

          {/* Certifications count */}
          <ComparisonRow
            label="Сертификатов"
            description="Общее количество сертификатов"
            products={products}
            valueKey="certificationsCount"
            higherIsBetter={true}
          />

          {/* Verified certifications */}
          <ComparisonRow
            label="Подтверждено"
            description="Верифицированные сертификаты"
            products={products}
            valueKey="verifiedCertifications"
            higherIsBetter={true}
          />
        </div>
      </ComparisonSection>

      {/* Section: Price Metrics */}
      <ComparisonSection
        title="Ценовые показатели"
        isExpanded={expandedSections.has('price')}
        onToggle={() => toggleSection('price')}
      >
        <div className="divide-y divide-border">
          {/* Price per 100g */}
          <ComparisonRow
            label="Цена за 100г"
            description="Стоимость стандартной единицы"
            products={products}
            valueKey="pricePer100g"
            higherIsBetter={false}
            formatFn={(v) => v ? `${(v / 100).toFixed(0)} p.` : '-'}
          />

          {/* Quality/price ratio */}
          <ComparisonRow
            label="Цена/качество"
            description="Соотношение прозрачности к цене"
            products={products}
            valueKey="qualityPriceRatio"
            higherIsBetter={true}
            formatFn={(v) => v ? v.toFixed(2) : '-'}
          />
        </div>
      </ComparisonSection>

      {/* Section: Attributes */}
      <ComparisonSection
        title="Характеристики"
        isExpanded={expandedSections.has('attributes')}
        onToggle={() => toggleSection('attributes')}
      >
        <div className="divide-y divide-border">
          {/* Organic */}
          <ComparisonBooleanRow
            label="Органический"
            products={products}
            valueKey="organic"
          />

          {/* Local sourced */}
          <ComparisonBooleanRow
            label="Местное производство"
            products={products}
            valueKey="localSourced"
          />

          {/* Origin region */}
          <div className="grid grid-cols-[200px_1fr] divide-x divide-border">
            <div className="p-4 bg-muted/30">
              <span className="font-medium text-sm text-graphite">Регион</span>
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}
            >
              {products.map((product, idx) => (
                <div
                  key={product.productId}
                  className={cn(
                    'p-4 flex items-center justify-center text-sm text-graphite',
                    idx < products.length - 1 && 'border-r border-border'
                  )}
                >
                  {product.originRegion || '-'}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ComparisonSection>
    </div>
  );
}

// Collapsible section component
interface ComparisonSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ComparisonSection({
  title,
  isExpanded,
  onToggle,
  children,
}: ComparisonSectionProps) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
      >
        <span className="font-display text-graphite">{title}</span>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-graphite-light" />
        ) : (
          <ChevronDown className="h-5 w-5 text-graphite-light" />
        )}
      </button>
      {isExpanded && children}
    </div>
  );
}

// Generic comparison row
interface ComparisonRowProps {
  label: string;
  description?: string;
  products: ComparisonProduct[];
  valueKey: keyof ComparisonProduct;
  higherIsBetter: boolean;
  formatFn?: (value: number | undefined) => string;
}

function ComparisonRow({
  label,
  description,
  products,
  valueKey,
  higherIsBetter,
  formatFn,
}: ComparisonRowProps) {
  const values = products.map((p) => p[valueKey] as number | undefined);
  const validValues = values.filter((v) => v !== undefined && v !== null) as number[];
  const bestValue =
    validValues.length > 0
      ? higherIsBetter
        ? Math.max(...validValues)
        : Math.min(...validValues)
      : null;

  return (
    <div className="grid grid-cols-[200px_1fr] divide-x divide-border">
      <div className="p-4 bg-muted/30">
        <span className="font-medium text-sm text-graphite">{label}</span>
        {description && (
          <p className="text-xs text-graphite-light mt-0.5">{description}</p>
        )}
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}
      >
        {products.map((product, idx) => {
          const value = product[valueKey] as number | undefined;
          const isBest = value === bestValue && value !== undefined;

          return (
            <div
              key={product.productId}
              className={cn(
                'p-4 flex items-center justify-center',
                isBest && 'bg-green-50',
                idx < products.length - 1 && 'border-r border-border'
              )}
            >
              <span
                className={cn(
                  'font-semibold',
                  isBest ? 'text-green-600' : 'text-graphite'
                )}
              >
                {formatFn
                  ? formatFn(value)
                  : value !== undefined
                    ? value
                    : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Boolean comparison row
interface ComparisonBooleanRowProps {
  label: string;
  products: ComparisonProduct[];
  valueKey: keyof ComparisonProduct;
}

function ComparisonBooleanRow({
  label,
  products,
  valueKey,
}: ComparisonBooleanRowProps) {
  return (
    <div className="grid grid-cols-[200px_1fr] divide-x divide-border">
      <div className="p-4 bg-muted/30">
        <span className="font-medium text-sm text-graphite">{label}</span>
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}
      >
        {products.map((product, idx) => {
          const value = product[valueKey] as boolean;

          return (
            <div
              key={product.productId}
              className={cn(
                'p-4 flex items-center justify-center',
                value && 'bg-green-50',
                idx < products.length - 1 && 'border-r border-border'
              )}
            >
              {value ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <X className="h-5 w-5 text-graphite-light" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ComparisonGrid;
