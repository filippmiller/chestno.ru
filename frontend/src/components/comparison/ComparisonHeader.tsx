// ComparisonHeader.tsx - Header component for comparison page
// Displays product cards with ability to remove

import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ComparisonProduct } from '../../types/comparison';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ComparisonHeaderProps {
  products: ComparisonProduct[];
  onRemoveProduct: (productId: string) => void;
  canAddMore: boolean;
  children?: ReactNode;
}

export function ComparisonHeader({
  products,
  onRemoveProduct,
  canAddMore,
  children,
}: ComparisonHeaderProps) {
  return (
    <header className="bg-white border-b border-border sticky top-0 z-40">
      <div className="container py-4">
        {/* Title and actions row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-display text-graphite">
              Сравнение товаров
            </h1>
            <p className="text-sm text-graphite-light">
              {products.length} товар{products.length === 1 ? '' : products.length < 5 ? 'а' : 'ов'} для сравнения
            </p>
          </div>
          {children}
        </div>

        {/* Product cards row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductHeaderCard
              key={product.productId}
              product={product}
              onRemove={() => onRemoveProduct(product.productId)}
              canRemove={products.length > 2}
            />
          ))}

          {/* Empty slots */}
          {canAddMore &&
            Array.from({ length: 4 - products.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="border-2 border-dashed border-border rounded-lg p-4 flex items-center justify-center min-h-[120px] bg-muted/30"
              >
                <span className="text-sm text-graphite-light">
                  + Добавить товар
                </span>
              </div>
            ))}
        </div>
      </div>
    </header>
  );
}

interface ProductHeaderCardProps {
  product: ComparisonProduct;
  onRemove: () => void;
  canRemove: boolean;
}

function ProductHeaderCard({
  product,
  onRemove,
  canRemove,
}: ProductHeaderCardProps) {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="relative bg-card border border-border rounded-lg p-3 group">
      {/* Remove button */}
      {canRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          aria-label="Удалить из сравнения"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex gap-3">
        {/* Product image */}
        <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
          {product.mainImageUrl ? (
            <img
              src={product.mainImageUrl}
              alt={product.productName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-graphite-light text-xs">
              Нет фото
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <Link
            to={`/product/${product.productSlug}`}
            className="text-sm font-medium text-graphite hover:text-burgundy line-clamp-2 flex items-start gap-1"
          >
            {product.productName}
            <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5" />
          </Link>
          <p className="text-xs text-graphite-light truncate mt-0.5">
            {product.organizationName}
          </p>

          <div className="flex items-center gap-2 mt-2">
            {/* Overall score badge */}
            <Badge
              variant={product.overallScore >= 70 ? 'default' : 'secondary'}
              className="text-xs"
            >
              {product.overallScore}/100
            </Badge>

            {/* Price */}
            {product.priceCents && (
              <span className="text-xs font-medium text-graphite">
                {formatPrice(product.priceCents)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick attributes */}
      <div className="flex gap-1 mt-2">
        {product.organic && (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
            Органик
          </span>
        )}
        {product.localSourced && (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
            Местное
          </span>
        )}
      </div>
    </div>
  );
}

export default ComparisonHeader;
