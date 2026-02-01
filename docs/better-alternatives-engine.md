# Better Alternatives Recommendation Engine

## Overview

The Better Alternatives engine suggests more transparent product alternatives when users view products with low transparency scores. This feature helps consumers make informed decisions while incentivizing producers to improve their transparency.

## Architecture

### Database Schema

```
product_transparency_scores    -- Pre-calculated transparency metrics
product_similarity_cache       -- Pre-computed product similarity pairs
sponsored_alternatives         -- Paid placements (clearly labeled)
recommendation_impressions     -- Analytics for A/B testing
ab_experiments                 -- A/B test configuration
```

### Key Components

1. **Transparency Score Calculator** - Computes product transparency based on 5 weighted factors
2. **Similarity Matcher** - Finds products in same category and price range
3. **Recommendation Function** - SQL function combining transparency and similarity
4. **Widget Component** - React component for displaying alternatives
5. **A/B Testing Infrastructure** - Experiment tracking and variant assignment

## Transparency Score Calculation

### Components (100 points total)

| Component | Weight | Description |
|-----------|--------|-------------|
| Journey Completeness | 25% | How complete is the product journey documentation |
| Certification Score | 20% | Valid certifications from recognized bodies |
| Claim Verification | 20% | Are producer claims backed by evidence |
| Producer Status | 20% | Organization's A/B/C status level |
| Review Authenticity | 15% | Assessment of review authenticity patterns |

### Tiers

- **Excellent** (80-100): Full transparency, all claims verified
- **Good** (60-79): Strong transparency with minor gaps
- **Fair** (40-59): Partial transparency, some verification
- **Low** (0-39): Limited transparency, alternatives recommended

## Recommendation Algorithm

### Pseudocode

```
function get_better_alternatives(product_id, limit=3):
    source = get_product(product_id)

    # Only show for low transparency products
    if source.transparency_score >= 60:
        return []

    # Find similar products with better transparency
    candidates = products
        .filter(status = 'published')
        .filter(category = source.category OR category IS NULL)
        .filter(price BETWEEN source.price * 0.5 AND source.price * 1.5)
        .filter(organization_id != source.organization_id)
        .filter(transparency_score >= 60)
        .order_by(transparency_score DESC, similarity DESC)
        .limit(limit + 2)  # Buffer for sponsored

    # Insert sponsored alternative if eligible
    sponsored = get_sponsored_alternative(source.category, source.price)
    if sponsored and sponsored.transparency_score >= 60:
        candidates.insert_at_end(sponsored)

    return candidates.take(limit)
```

### Similarity Calculation

```
similarity =
    category_match * 0.40 +      # Same category = 1.0
    price_similarity * 0.25 +    # Inverse of price difference
    region_overlap * 0.20 +      # Same country/city bonus
    tag_similarity * 0.15        # Jaccard coefficient of tags
```

## Widget Placement Options

### Position: `below-hero` (Recommended)
- Displays immediately below the product hero section
- High visibility without being intrusive
- Best for mobile and desktop

### Position: `sidebar`
- Desktop only, alongside product details
- Persistent visibility during scroll
- Lower click-through but constant presence

### Position: `after-journey`
- After the product journey timeline
- Context: "Want to see products with more complete journeys?"
- Educational placement

### Position: `modal`
- Triggered on exit intent or scroll threshold
- Higher engagement but more intrusive
- Use sparingly

## Edge Cases

### No Alternatives Available

```typescript
if (alternatives.length === 0) {
  // Widget doesn't render
  return null
}
```

Show nothing rather than "no alternatives found" to avoid confusion.

### Source Product Already Transparent

```typescript
if (sourceScore >= 60) {
  // Don't show alternatives for good products
  return null
}
```

### Sponsored Content Rules

1. **Minimum transparency**: Sponsored products MUST have score >= 60
2. **Clear labeling**: "Реклама" badge always visible
3. **Position**: Always shown last (position 3 of 3)
4. **Budget limits**: Automatically paused when depleted
5. **One per request**: Maximum one sponsored alternative shown

### Regional Availability

Products matched by:
1. Same country (required)
2. Same city (preferred, not required)
3. Organization's distribution regions (if defined)

## A/B Testing Plan

### Experiment: `alternatives-v1`

**Hypothesis**: Showing better alternatives increases platform engagement and trust.

**Variants**:
- `control`: No alternatives widget
- `treatment-basic`: Basic widget with 3 alternatives
- `treatment-comparison`: Widget with transparency comparison badge
- `treatment-expanded`: Widget with detailed transparency breakdown

**Metrics**:
1. **Primary**: Click-through rate to alternatives
2. **Secondary**: Follow rate on recommended products
3. **Tertiary**: Return visits, time on site

**Sample Size**: 10,000 impressions per variant
**Duration**: 2 weeks minimum
**Statistical Significance**: p < 0.05

### Running an Experiment

```typescript
// In product page
const { variant } = useABTest({
  experimentId: 'alternatives-v1',
  variants: ['control', 'treatment-basic', 'treatment-comparison'],
})

// Render based on variant
if (variant === 'control') {
  return null
}

return (
  <BetterAlternativesWidget
    productId={productId}
    experimentId="alternatives-v1"
    config={{
      showTransparencyComparison: variant === 'treatment-comparison',
    }}
  />
)
```

## API Reference

### `getBetterAlternatives(request)`

Fetches recommendations for a product.

**Request**:
```typescript
{
  productId: string
  limit?: number        // default: 3
  userId?: string       // for personalization (future)
  sessionId?: string    // for tracking
  experimentId?: string // A/B test ID
}
```

**Response**:
```typescript
{
  alternatives: ProductAlternative[]
  sourceProductScore: number | null
  showAlternatives: boolean
  experimentVariant?: string
}
```

### `recordImpression(sourceProductId, alternative, sessionId)`

Records when alternatives are displayed.

### `recordClick(impressionId)`

Records when a user clicks on an alternative.

## Monitoring

### Key Metrics Dashboard

1. **Widget Visibility Rate**: % of low-score products showing alternatives
2. **Click-Through Rate**: Clicks / Impressions
3. **Conversion Rate**: Follows / Clicks
4. **Sponsored Fill Rate**: % of requests with sponsored content
5. **Revenue**: Sponsored impressions * CPM + Clicks * CPC

### Alerts

- CTR drops below 2%
- No alternatives available for >10% of requests
- Sponsored budget utilization >90%
- Error rate in recommendation function >0.1%

## Future Improvements

1. **Personalization**: Use user's purchase history and preferences
2. **Machine Learning**: Train similarity model on click data
3. **Dynamic Pricing Tiers**: Adjust price range based on user behavior
4. **Cross-Category Recommendations**: "People who wanted transparent X bought Y"
5. **Real-time Score Updates**: Recalculate on content changes
