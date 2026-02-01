// ComparisonPage.tsx - Main comparison page layout
// Side-by-side supply chain transparency comparison

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getComparisonData,
  getRecommendation,
  findSimilarProducts,
  saveComparison,
} from '../../services/comparisonService';
import type {
  ComparisonProduct,
  ProductRecommendation,
  RecommendationPriority,
  SimilarProduct,
} from '../../types/comparison';
import { ComparisonHeader } from './ComparisonHeader';
import { ComparisonGrid } from './ComparisonGrid';
import { ComparisonChart } from './ComparisonChart';
import { RecommendationBanner } from './RecommendationBanner';
import { SimilarProductsSidebar } from './SimilarProductsSidebar';
import { ComparisonSeo } from './ComparisonSeo';
import { Button } from '../ui/button';
import {
  Share2,
  Download,
  Plus,
  Loader2,
  AlertCircle,
  Scale,
} from 'lucide-react';

export function ComparisonPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // State
  const [products, setProducts] = useState<ComparisonProduct[]>([]);
  const [recommendation, setRecommendation] =
    useState<ProductRecommendation | null>(null);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [priority, setPriority] = useState<RecommendationPriority>('balanced');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get product IDs from URL
  const productIds = searchParams.get('products')?.split(',') || [];

  // Load comparison data
  useEffect(() => {
    async function loadData() {
      if (productIds.length < 2) {
        setError('Для сравнения выберите минимум 2 товара');
        setIsLoading(false);
        return;
      }

      if (productIds.length > 4) {
        setError('Можно сравнить максимум 4 товара');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load comparison data and recommendation in parallel
        const [comparisonData, rec] = await Promise.all([
          getComparisonData(productIds),
          getRecommendation(productIds, priority),
        ]);

        setProducts(comparisonData);
        setRecommendation(rec);

        // Load similar products for the first product
        if (comparisonData.length > 0) {
          const similar = await findSimilarProducts(
            comparisonData[0].productId,
            6
          );
          // Filter out products already in comparison
          setSimilarProducts(
            similar.filter((s) => !productIds.includes(s.productId))
          );
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Ошибка загрузки данных'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [productIds.join(','), priority]);

  // Update recommendation when priority changes
  const handlePriorityChange = async (newPriority: RecommendationPriority) => {
    setPriority(newPriority);
    try {
      const rec = await getRecommendation(productIds, newPriority);
      setRecommendation(rec);
    } catch (err) {
      console.error('Failed to update recommendation:', err);
    }
  };

  // Add product to comparison
  const handleAddProduct = (productId: string) => {
    if (productIds.length >= 4) {
      return;
    }
    const newIds = [...productIds, productId];
    navigate(`/compare?products=${newIds.join(',')}`);
  };

  // Remove product from comparison
  const handleRemoveProduct = (productId: string) => {
    if (productIds.length <= 2) {
      return;
    }
    const newIds = productIds.filter((id) => id !== productId);
    navigate(`/compare?products=${newIds.join(',')}`);
  };

  // Save comparison
  const handleSave = async () => {
    if (products.length < 2) return;

    try {
      setIsSaving(true);
      const title = products.map((p) => p.productName).join(' vs ');
      const saved = await saveComparison({
        title,
        productIds: products.map((p) => p.productId),
        isPublic: true,
      });
      navigate(`/compare/${saved.slug}`);
    } catch (err) {
      console.error('Failed to save comparison:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Share comparison
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: 'Сравнение товаров | Честно.ру',
        text: `Сравните прозрачность: ${products.map((p) => p.productName).join(' vs ')}`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      // Show toast notification
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-burgundy mx-auto mb-4" />
          <p className="text-graphite">Загрузка сравнения...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-display text-graphite mb-2">
            Ошибка сравнения
          </h2>
          <p className="text-graphite-light mb-6">{error}</p>
          <Button onClick={() => navigate('/catalog')}>
            Вернуться в каталог
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center max-w-md">
          <Scale className="h-16 w-16 text-graphite-light mx-auto mb-4" />
          <h2 className="text-2xl font-display text-graphite mb-2">
            Сравнение товаров
          </h2>
          <p className="text-graphite-light mb-6">
            Выберите товары для сравнения прозрачности цепочки поставок
          </p>
          <Button onClick={() => navigate('/catalog')}>Перейти в каталог</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SEO metadata */}
      <ComparisonSeo products={products} />

      <div className="min-h-screen bg-cream">
        {/* Header with actions */}
        <ComparisonHeader
          products={products}
          onRemoveProduct={handleRemoveProduct}
          canAddMore={productIds.length < 4}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Поделиться</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Сохранить</span>
            </Button>
          </div>
        </ComparisonHeader>

        {/* Recommendation banner */}
        {recommendation && (
          <RecommendationBanner
            recommendation={recommendation}
            products={products}
            priority={priority}
            onPriorityChange={handlePriorityChange}
          />
        )}

        <div className="container py-8">
          <div className="grid lg:grid-cols-[1fr_280px] gap-8">
            {/* Main comparison content */}
            <div className="space-y-8">
              {/* Comparison grid */}
              <ComparisonGrid products={products} />

              {/* Radar chart comparison */}
              <ComparisonChart products={products} />
            </div>

            {/* Sidebar with similar products */}
            <aside className="space-y-6">
              {productIds.length < 4 && similarProducts.length > 0 && (
                <SimilarProductsSidebar
                  products={similarProducts}
                  onAddProduct={handleAddProduct}
                />
              )}

              {/* Quick add button */}
              {productIds.length < 4 && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate('/catalog?mode=compare')}
                >
                  <Plus className="h-4 w-4" />
                  Добавить товар
                </Button>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

export default ComparisonPage;
