// RecommendationBanner.tsx - AI-powered product recommendation
// Shows the recommended best product based on selected priority

import type {
  ComparisonProduct,
  ProductRecommendation,
  RecommendationPriority,
} from '../../types/comparison';
import { cn } from '../../lib/utils';
import {
  Sparkles,
  Scale,
  Shield,
  Wallet,
  Award,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecommendationBannerProps {
  recommendation: ProductRecommendation;
  products: ComparisonProduct[];
  priority: RecommendationPriority;
  onPriorityChange: (priority: RecommendationPriority) => void;
}

const PRIORITY_OPTIONS: {
  value: RecommendationPriority;
  label: string;
  icon: typeof Scale;
  description: string;
}[] = [
  {
    value: 'balanced',
    label: 'Баланс',
    icon: Scale,
    description: 'Учитывает все факторы',
  },
  {
    value: 'transparency',
    label: 'Прозрачность',
    icon: Shield,
    description: 'Максимальная открытость',
  },
  {
    value: 'value',
    label: 'Выгода',
    icon: Wallet,
    description: 'Лучшее соотношение',
  },
  {
    value: 'certification',
    label: 'Сертификаты',
    icon: Award,
    description: 'Больше подтверждений',
  },
];

export function RecommendationBanner({
  recommendation,
  products,
  priority,
  onPriorityChange,
}: RecommendationBannerProps) {
  const recommendedProduct = products.find(
    (p) => p.productId === recommendation.productId
  );

  if (!recommendedProduct) return null;

  return (
    <div className="bg-gradient-to-r from-burgundy to-burgundy-dark text-white">
      <div className="container py-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Recommendation text */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-yellow-300" />
              <span className="text-sm font-medium text-burgundy-light uppercase tracking-wide">
                Рекомендация
              </span>
            </div>

            <h2 className="text-xl font-display mb-2">
              {recommendedProduct.productName}
            </h2>

            <p className="text-burgundy-light text-sm mb-3">
              {recommendation.recommendationReason}
            </p>

            <Link
              to={`/product/${recommendedProduct.productSlug}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-white hover:text-yellow-200 transition-colors"
            >
              Подробнее о товаре
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Priority selector */}
          <div className="flex-shrink-0">
            <p className="text-xs text-burgundy-light mb-2 uppercase tracking-wide">
              Приоритет выбора
            </p>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = priority === option.value;

                return (
                  <button
                    key={option.value}
                    onClick={() => onPriorityChange(option.value)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      isSelected
                        ? 'bg-white text-burgundy shadow-lg'
                        : 'bg-burgundy-dark/50 text-white/80 hover:bg-burgundy-dark hover:text-white'
                    )}
                    title={option.description}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex-shrink-0 hidden xl:block">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {recommendedProduct.overallScore}
                </div>
                <div className="text-xs text-burgundy-light">Прозрачность</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {recommendedProduct.certificationsCount}
                </div>
                <div className="text-xs text-burgundy-light">Сертификатов</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecommendationBanner;
