// Product Comparison Service for chestno.ru
// Handles all comparison-related API calls to Supabase

import { supabase } from '../lib/supabase';
import type {
  ComparisonProduct,
  SimilarProduct,
  SavedComparison,
  ProductRecommendation,
  RecommendationPriority,
  ProductAttributes,
  CreateComparisonRequest,
} from '../types/comparison';

// =============================================================================
// Find Similar Products
// =============================================================================

export async function findSimilarProducts(
  productId: string,
  limit: number = 10
): Promise<SimilarProduct[]> {
  const { data, error } = await supabase.rpc('find_similar_products', {
    p_product_id: productId,
    p_limit: limit,
  });

  if (error) {
    console.error('Error finding similar products:', error);
    throw new Error('Не удалось найти похожие товары');
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    productId: row.product_id as string,
    productName: row.product_name as string,
    organizationName: row.organization_name as string,
    similarityScore: Number(row.similarity_score),
    transparencyScore: Number(row.transparency_score),
    priceCents: row.price_cents as number | undefined,
  }));
}

// =============================================================================
// Get Comparison Data
// =============================================================================

export async function getComparisonData(
  productIds: string[]
): Promise<ComparisonProduct[]> {
  if (productIds.length < 2 || productIds.length > 4) {
    throw new Error('Для сравнения необходимо от 2 до 4 товаров');
  }

  const { data, error } = await supabase.rpc('get_comparison_data', {
    p_product_ids: productIds,
  });

  if (error) {
    console.error('Error getting comparison data:', error);
    throw new Error('Не удалось загрузить данные для сравнения');
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    productId: row.product_id as string,
    productName: row.product_name as string,
    productSlug: row.product_slug as string,
    organizationName: row.organization_name as string,
    mainImageUrl: row.main_image_url as string | undefined,
    priceCents: row.price_cents as number | undefined,
    overallScore: Number(row.overall_score),
    journeyScore: Number(row.journey_score),
    certificationScore: Number(row.certification_score),
    traceabilityScore: Number(row.traceability_score),
    documentationScore: Number(row.documentation_score),
    journeyStepsCount: Number(row.journey_steps_count),
    verifiedStepsCount: Number(row.verified_steps_count),
    certificationsCount: Number(row.certifications_count),
    verifiedCertifications: Number(row.verified_certifications),
    pricePer100g: row.price_per_100g as number | undefined,
    qualityPriceRatio: row.quality_price_ratio
      ? Number(row.quality_price_ratio)
      : undefined,
    organic: Boolean(row.organic),
    localSourced: Boolean(row.local_sourced),
    originRegion: row.origin_region as string | undefined,
  }));
}

// =============================================================================
// Get Recommendation
// =============================================================================

export async function getRecommendation(
  productIds: string[],
  priority: RecommendationPriority = 'balanced'
): Promise<ProductRecommendation | null> {
  const { data, error } = await supabase.rpc('recommend_best_product', {
    p_product_ids: productIds,
    p_priority: priority,
  });

  if (error) {
    console.error('Error getting recommendation:', error);
    throw new Error('Не удалось получить рекомендацию');
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];
  return {
    productId: row.product_id,
    productName: row.product_name,
    recommendationScore: Number(row.recommendation_score),
    recommendationReason: row.recommendation_reason,
  };
}

// =============================================================================
// Saved Comparisons
// =============================================================================

export async function saveComparison(
  request: CreateComparisonRequest
): Promise<SavedComparison> {
  // Generate URL-friendly slug
  const slug = generateComparisonSlug(request.title);

  const { data, error } = await supabase
    .from('product_comparisons')
    .insert({
      slug,
      title: request.title,
      description: request.description,
      product_ids: request.productIds,
      is_public: request.isPublic ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving comparison:', error);
    throw new Error('Не удалось сохранить сравнение');
  }

  return mapSavedComparison(data);
}

export async function getComparisonBySlug(
  slug: string
): Promise<SavedComparison | null> {
  const { data, error } = await supabase
    .from('product_comparisons')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching comparison:', error);
    throw new Error('Не удалось загрузить сравнение');
  }

  // Increment view count
  await supabase
    .from('product_comparisons')
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq('id', data.id);

  return mapSavedComparison(data);
}

export async function getFeaturedComparisons(
  limit: number = 10
): Promise<SavedComparison[]> {
  const { data, error } = await supabase
    .from('product_comparisons')
    .select('*')
    .eq('is_public', true)
    .eq('is_featured', true)
    .order('view_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching featured comparisons:', error);
    throw new Error('Не удалось загрузить популярные сравнения');
  }

  return (data || []).map(mapSavedComparison);
}

export async function getRecentPublicComparisons(
  limit: number = 10
): Promise<SavedComparison[]> {
  const { data, error } = await supabase
    .from('product_comparisons')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent comparisons:', error);
    throw new Error('Не удалось загрузить последние сравнения');
  }

  return (data || []).map(mapSavedComparison);
}

// =============================================================================
// Product Attributes
// =============================================================================

export async function getProductAttributes(
  productId: string
): Promise<ProductAttributes | null> {
  const { data, error } = await supabase
    .from('product_attributes')
    .select('*')
    .eq('product_id', productId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching product attributes:', error);
    throw new Error('Не удалось загрузить атрибуты товара');
  }

  return mapProductAttributes(data);
}

export async function updateProductAttributes(
  productId: string,
  attributes: Partial<ProductAttributes>
): Promise<ProductAttributes> {
  const payload = {
    product_id: productId,
    primary_category: attributes.primaryCategory,
    subcategory: attributes.subcategory,
    product_type: attributes.productType,
    weight_grams: attributes.weightGrams,
    volume_ml: attributes.volumeMl,
    unit_count: attributes.unitCount,
    organic: attributes.organic,
    local_sourced: attributes.localSourced,
    handmade: attributes.handmade,
    seasonal: attributes.seasonal,
    vegan: attributes.vegan,
    vegetarian: attributes.vegetarian,
    gluten_free: attributes.glutenFree,
    lactose_free: attributes.lactoseFree,
    halal: attributes.halal,
    kosher: attributes.kosher,
    origin_country: attributes.originCountry,
    origin_region: attributes.originRegion,
  };

  const { data, error } = await supabase
    .from('product_attributes')
    .upsert(payload, { onConflict: 'product_id' })
    .select()
    .single();

  if (error) {
    console.error('Error updating product attributes:', error);
    throw new Error('Не удалось обновить атрибуты товара');
  }

  return mapProductAttributes(data);
}

// =============================================================================
// Trigger Transparency Score Recomputation
// =============================================================================

export async function recomputeTransparencyScore(productId: string): Promise<void> {
  const { error } = await supabase.rpc('compute_transparency_score', {
    p_product_id: productId,
  });

  if (error) {
    console.error('Error recomputing transparency score:', error);
    throw new Error('Не удалось пересчитать показатель прозрачности');
  }
}

// =============================================================================
// Log Comparison View
// =============================================================================

export async function logComparisonView(
  comparisonId: string,
  clickedProductId?: string
): Promise<void> {
  const { error } = await supabase.from('comparison_view_logs').insert({
    comparison_id: comparisonId,
    clicked_product_id: clickedProductId,
    clicked_at: clickedProductId ? new Date().toISOString() : null,
  });

  if (error) {
    // Don't throw - logging should not break the user experience
    console.warn('Failed to log comparison view:', error);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateComparisonSlug(title: string): string {
  const timestamp = Date.now().toString(36);
  const baseSlug = title
    .toLowerCase()
    .replace(/[а-яё]/gi, (char) => transliterate(char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  return `${baseSlug}-${timestamp}`;
}

function transliterate(char: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
    ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
    ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '',
    ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const lower = char.toLowerCase();
  return map[lower] || char;
}

function mapSavedComparison(row: Record<string, unknown>): SavedComparison {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string | undefined,
    productIds: row.product_ids as string[],
    createdBy: row.created_by as string | undefined,
    isPublic: Boolean(row.is_public),
    isFeatured: Boolean(row.is_featured),
    viewCount: Number(row.view_count),
    metaTitle: row.meta_title as string | undefined,
    metaDescription: row.meta_description as string | undefined,
    canonicalUrl: row.canonical_url as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapProductAttributes(row: Record<string, unknown>): ProductAttributes {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    primaryCategory: row.primary_category as ProductAttributes['primaryCategory'],
    subcategory: row.subcategory as string | undefined,
    productType: row.product_type as string | undefined,
    weightGrams: row.weight_grams as number | undefined,
    volumeMl: row.volume_ml as number | undefined,
    unitCount: row.unit_count as number | undefined,
    organic: Boolean(row.organic),
    localSourced: Boolean(row.local_sourced),
    handmade: Boolean(row.handmade),
    seasonal: Boolean(row.seasonal),
    vegan: Boolean(row.vegan),
    vegetarian: Boolean(row.vegetarian),
    glutenFree: Boolean(row.gluten_free),
    lactoseFree: Boolean(row.lactose_free),
    halal: Boolean(row.halal),
    kosher: Boolean(row.kosher),
    originCountry: row.origin_country as string,
    originRegion: row.origin_region as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
