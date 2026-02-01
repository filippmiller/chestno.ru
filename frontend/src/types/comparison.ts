// Product Comparison Types for chestno.ru
// Supports side-by-side supply chain transparency comparison

// =============================================================================
// Product Attributes (for matching similar products)
// =============================================================================

export type ProductCategory =
  | 'dairy'
  | 'meat'
  | 'produce'
  | 'bakery'
  | 'beverages'
  | 'seafood'
  | 'grains'
  | 'confectionery'
  | 'condiments'
  | 'other';

export interface ProductAttributes {
  id: string;
  productId: string;
  // Classification
  primaryCategory: ProductCategory;
  subcategory?: string;
  productType?: string;
  // Physical
  weightGrams?: number;
  volumeMl?: number;
  unitCount?: number;
  // Quality indicators
  organic: boolean;
  localSourced: boolean;
  handmade: boolean;
  seasonal: boolean;
  // Dietary
  vegan: boolean;
  vegetarian: boolean;
  glutenFree: boolean;
  lactoseFree: boolean;
  halal: boolean;
  kosher: boolean;
  // Origin
  originCountry: string;
  originRegion?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Transparency Scores
// =============================================================================

export interface TransparencyScores {
  id: string;
  productId: string;
  // Journey completeness (0-100)
  journeyCompletenessScore: number;
  journeyStepsCount: number;
  journeyVerifiedSteps: number;
  // Certification (0-100)
  certificationScore: number;
  certificationsCount: number;
  verifiedCertifications: number;
  // Transit metrics
  totalTransitDays?: number;
  storageConditionsTracked: boolean;
  coldChainVerified: boolean;
  // Traceability (0-100)
  traceabilityScore: number;
  originVerified: boolean;
  supplierDisclosed: boolean;
  // Documentation (0-100)
  documentationScore: number;
  hasPhotos: boolean;
  hasVideos: boolean;
  hasCertificates: boolean;
  // Overall (0-100)
  overallTransparencyScore: number;
  // Price metrics
  pricePer100g?: number;
  qualityPriceRatio?: number;
  // Computed timestamp
  computedAt: string;
}

// =============================================================================
// Comparison Data
// =============================================================================

export interface ComparisonProduct {
  productId: string;
  productName: string;
  productSlug: string;
  organizationName: string;
  mainImageUrl?: string;
  priceCents?: number;
  // Transparency scores
  overallScore: number;
  journeyScore: number;
  certificationScore: number;
  traceabilityScore: number;
  documentationScore: number;
  // Journey details
  journeyStepsCount: number;
  verifiedStepsCount: number;
  // Certification details
  certificationsCount: number;
  verifiedCertifications: number;
  // Price metrics
  pricePer100g?: number;
  qualityPriceRatio?: number;
  // Attributes
  organic: boolean;
  localSourced: boolean;
  originRegion?: string;
}

export interface SavedComparison {
  id: string;
  slug: string;
  title: string;
  description?: string;
  productIds: string[];
  createdBy?: string;
  isPublic: boolean;
  isFeatured: boolean;
  viewCount: number;
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface SimilarProduct {
  productId: string;
  productName: string;
  organizationName: string;
  similarityScore: number;
  transparencyScore: number;
  priceCents?: number;
}

// =============================================================================
// Recommendation
// =============================================================================

export type RecommendationPriority =
  | 'balanced'
  | 'transparency'
  | 'value'
  | 'certification';

export interface ProductRecommendation {
  productId: string;
  productName: string;
  recommendationScore: number;
  recommendationReason: string;
}

// =============================================================================
// Comparison Metrics (for UI display)
// =============================================================================

export interface ComparisonMetric {
  key: string;
  labelRu: string;
  labelEn: string;
  icon: string;
  unit?: string;
  description: string;
  higherIsBetter: boolean;
}

export const COMPARISON_METRICS: ComparisonMetric[] = [
  {
    key: 'overallScore',
    labelRu: 'Общая прозрачность',
    labelEn: 'Overall Transparency',
    icon: 'Shield',
    description: 'Комплексная оценка прозрачности цепочки поставок',
    higherIsBetter: true,
  },
  {
    key: 'journeyScore',
    labelRu: 'Полнота пути',
    labelEn: 'Journey Completeness',
    icon: 'Route',
    description: 'Насколько полно документирован путь продукта',
    higherIsBetter: true,
  },
  {
    key: 'certificationScore',
    labelRu: 'Сертификация',
    labelEn: 'Certifications',
    icon: 'Award',
    description: 'Наличие и верификация сертификатов',
    higherIsBetter: true,
  },
  {
    key: 'traceabilityScore',
    labelRu: 'Отслеживаемость',
    labelEn: 'Traceability',
    icon: 'MapPin',
    description: 'Возможность проследить происхождение',
    higherIsBetter: true,
  },
  {
    key: 'documentationScore',
    labelRu: 'Документация',
    labelEn: 'Documentation',
    icon: 'FileText',
    description: 'Наличие фото, видео и документов',
    higherIsBetter: true,
  },
  {
    key: 'pricePer100g',
    labelRu: 'Цена за 100г',
    labelEn: 'Price per 100g',
    icon: 'Wallet',
    unit: 'p.',
    description: 'Стоимость за стандартную единицу',
    higherIsBetter: false,
  },
  {
    key: 'qualityPriceRatio',
    labelRu: 'Цена/качество',
    labelEn: 'Value Score',
    icon: 'Scale',
    description: 'Соотношение прозрачности к цене',
    higherIsBetter: true,
  },
];

// =============================================================================
// UI State Types
// =============================================================================

export interface ComparisonState {
  products: ComparisonProduct[];
  isLoading: boolean;
  error?: string;
  recommendation?: ProductRecommendation;
  recommendationPriority: RecommendationPriority;
}

export interface ComparisonFilters {
  category?: ProductCategory;
  organic?: boolean;
  localSourced?: boolean;
  minScore?: number;
  maxPrice?: number;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface FindSimilarProductsRequest {
  productId: string;
  limit?: number;
}

export interface GetComparisonDataRequest {
  productIds: string[];
}

export interface CreateComparisonRequest {
  title: string;
  description?: string;
  productIds: string[];
  isPublic?: boolean;
}

export interface GetRecommendationRequest {
  productIds: string[];
  priority?: RecommendationPriority;
}

// =============================================================================
// SEO Types
// =============================================================================

export interface ComparisonSeoData {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  structuredData: {
    '@context': 'https://schema.org';
    '@type': 'Product';
    name: string;
    description: string;
    offers?: {
      '@type': 'AggregateOffer';
      lowPrice: number;
      highPrice: number;
      priceCurrency: string;
    };
  }[];
}

export function generateComparisonSeo(
  products: ComparisonProduct[],
  comparisonTitle: string
): ComparisonSeoData {
  const productNames = products.map((p) => p.productName).join(' vs ');
  const prices = products
    .filter((p) => p.priceCents)
    .map((p) => p.priceCents!);

  return {
    title: `${comparisonTitle} | Сравнение товаров | Честно.ру`,
    description: `Сравните прозрачность цепочки поставок: ${productNames}. Оценка сертификации, отслеживаемости и документации.`,
    canonicalUrl: `/compare/${products.map((p) => p.productSlug).join('-vs-')}`,
    structuredData: products.map((p) => ({
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: p.productName,
      description: `${p.organizationName} - Оценка прозрачности: ${p.overallScore}/100`,
      offers:
        prices.length > 0
          ? {
              '@type': 'AggregateOffer' as const,
              lowPrice: Math.min(...prices) / 100,
              highPrice: Math.max(...prices) / 100,
              priceCurrency: 'RUB',
            }
          : undefined,
    })),
  };
}
