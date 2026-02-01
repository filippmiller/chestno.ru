// SimilarProductsSidebar.tsx - Sidebar showing similar products
// Allows adding more products to comparison

import type { SimilarProduct } from '../../types/comparison';
import { Button } from '../ui/button';
import { Plus, TrendingUp } from 'lucide-react';

interface SimilarProductsSidebarProps {
  products: SimilarProduct[];
  onAddProduct: (productId: string) => void;
}

export function SimilarProductsSidebar({
  products,
  onAddProduct,
}: SimilarProductsSidebarProps) {
  if (products.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-display text-graphite flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-burgundy" />
          Похожие товары
        </h3>
        <p className="text-xs text-graphite-light mt-1">
          Добавьте для сравнения
        </p>
      </div>

      <div className="divide-y divide-border">
        {products.map((product) => (
          <SimilarProductCard
            key={product.productId}
            product={product}
            onAdd={() => onAddProduct(product.productId)}
          />
        ))}
      </div>
    </div>
  );
}

interface SimilarProductCardProps {
  product: SimilarProduct;
  onAdd: () => void;
}

function SimilarProductCard({ product, onAdd }: SimilarProductCardProps) {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="p-3 hover:bg-muted/30 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-graphite line-clamp-2">
            {product.productName}
          </h4>
          <p className="text-xs text-graphite-light truncate mt-0.5">
            {product.organizationName}
          </p>

          <div className="flex items-center gap-3 mt-2">
            {/* Transparency score */}
            <div className="flex items-center gap-1">
              <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-burgundy rounded-full"
                  style={{ width: `${product.transparencyScore}%` }}
                />
              </div>
              <span className="text-xs text-graphite-light">
                {product.transparencyScore}
              </span>
            </div>

            {/* Price */}
            {product.priceCents && (
              <span className="text-xs font-medium text-graphite">
                {formatPrice(product.priceCents)}
              </span>
            )}
          </div>

          {/* Similarity indicator */}
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] text-graphite-light">Схожесть:</span>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full mx-0.5 ${
                    i < Math.round(product.similarityScore / 20)
                      ? 'bg-burgundy'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Add button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className="flex-shrink-0 h-8 w-8 p-0 opacity-50 group-hover:opacity-100"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default SimilarProductsSidebar;
