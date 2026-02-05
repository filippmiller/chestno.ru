# Chestno.ru Platform Features v4.0

## Overview

This document details the 9 major features implemented in the platform enhancement iteration. These features transform Chestno.ru from a basic verification platform into a comprehensive consumer trust ecosystem.

---

## Feature 1: Consumer Verification Challenges

### Purpose
Empowers consumers to challenge manufacturer claims and demand proof, creating accountability and transparency.

### How It Works
1. Consumer sees a claim (e.g., "100% organic", "Made in Russia")
2. Consumer creates a challenge questioning the claim
3. Challenge goes through moderation to prevent abuse
4. Once approved, organization has **7 days** to respond with evidence
5. If organization fails to respond, challenge expires (damages trust score)
6. Community can vote on whether the response was satisfactory

### Database Tables
- `verification_challenges` - Main challenge records
- `challenge_responses` - Organization responses with evidence
- `challenge_votes` - Community satisfaction votes

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/challenges` | Create new challenge |
| GET | `/api/challenges/categories` | List challenge categories |
| POST | `/api/challenges/{id}/vote` | Vote on challenge response |
| GET | `/api/public/challenges/organization/{org_id}` | Public challenges |
| GET | `/api/organizations/{org_id}/challenges` | Org dashboard |
| POST | `/api/organizations/{org_id}/challenges/{id}/respond` | Submit response |
| POST | `/api/moderation/challenges/{id}/approve` | Moderator approval |
| POST | `/api/moderation/challenges/{id}/reject` | Moderator rejection |

### Challenge Categories
- `organic` - Organic/natural claims
- `local` - Local sourcing claims
- `certified` - Certification claims
- `ingredients` - Ingredient accuracy
- `origin` - Country/region of origin
- `sustainability` - Environmental claims
- `health` - Health benefit claims
- `freshness` - Freshness/date claims
- `other` - General claims

### Business Value
- Creates manufacturer accountability
- Builds consumer trust through transparency
- Response rate affects trust score
- Differentiates verified manufacturers

---

## Feature 2: AI Photo Counterfeit Detection

### Purpose
Uses computer vision AI to compare consumer-submitted product photos against manufacturer reference images to detect potential counterfeits.

### How It Works
1. Manufacturer uploads reference images (packaging, logos, labels, holograms)
2. Consumer submits a photo of purchased product
3. System uses Claude Vision API to analyze and compare
4. Returns confidence score (0-100) and authenticity determination
5. If suspicious (<70% confidence), alerts manufacturer
6. Consumer can submit counterfeit report for investigation

### Database Tables
- `product_reference_images` - Manufacturer reference images
- `counterfeit_checks` - Check results and analysis
- `counterfeit_reports` - Consumer-submitted reports

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/public/counterfeit/check` | Check product authenticity |
| POST | `/api/public/counterfeit/report` | Submit counterfeit report |
| GET | `/api/public/counterfeit/product/{id}/references` | View reference images |
| POST | `/api/organizations/{org_id}/products/{id}/reference-images` | Upload reference |
| GET | `/api/organizations/{org_id}/counterfeit/stats` | Detection statistics |

### Image Types
- `packaging` - Product packaging
- `logo` - Brand logos
- `label` - Product labels
- `barcode` - Barcodes/QR codes
- `hologram` - Security holograms

### AI Analysis Factors
- Logo placement and quality
- Color accuracy
- Text/label clarity
- Packaging quality
- Overall appearance match

### Configuration
- Confidence threshold: 70%
- Fallback: Returns 75% if API key not configured
- Model: Claude 3 Haiku (fast, cost-effective)

---

## Feature 3: Open Trust Score Algorithm

### Purpose
Provides a transparent, verifiable trust score that anyone can understand and verify. The formula is public - no black box scoring.

### The Formula
```
Trust Score = Σ(signal_score × weight) / Σ(weights)
```

### Signal Weights (Public)
| Signal | Weight | Max Points | Formula |
|--------|--------|------------|---------|
| Review Rating | 1.5 | 100 | avg_rating × 20 |
| Review Count | 1.0 | 100 | min(count / 10, 100) |
| Response Rate | 1.2 | 100 | responses / reviews × 100 |
| Challenge Resolution | 1.3 | 100 | responded / (responded + expired) × 100 |
| Supply Chain Docs | 1.0 | 100 | verified_nodes / total_nodes × 100 |
| Platform Tenure | 0.8 | 100 | min(months × 2, 100) |
| Content Freshness | 0.7 | 100 | 100 - days_since_update |
| Verification Level | 1.0 | 100 | A=50, B=75, C=100 |

### Grading Scale
| Grade | Score Range |
|-------|-------------|
| A | 90-100 |
| B | 80-89 |
| C | 70-79 |
| D | 60-69 |
| F | 0-59 |

### Database Tables
- `trust_score_signals` - Signal definitions
- `organization_trust_scores` - Current scores
- `trust_score_history` - Daily history for trends

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/trust-score/formula` | Get public formula |
| GET | `/api/public/trust-score/organization/{id}` | Get org score |
| GET | `/api/public/trust-score/organization/{id}/history` | Score history |
| GET | `/api/public/trust-score/leaderboard` | Top organizations |
| POST | `/api/organizations/{id}/trust-score/recalculate` | Request recalc |

### Key Principle
**Transparency**: Anyone can understand exactly why an organization has their score. No hidden factors.

---

## Feature 4: Telegram Bot Enhancement

### Purpose
Extends existing Telegram bot with product verification capabilities, allowing consumers to verify products without opening a browser.

### New Capabilities
1. **Product Scanning** - Scan QR codes and get instant verification
2. **Verification Results** - Rich formatted messages with status and trust score
3. **Portfolio Integration** - Add scanned products to personal portfolio
4. **Scan History** - Track previously scanned products

### Database Tables
- `telegram_scan_logs` - Scan history per user

### Key Functions
```python
handle_product_scan(telegram_id, qr_code) -> dict
send_product_verification_result(telegram_id, ...) -> bool
add_product_to_portfolio_from_telegram(telegram_id, product_id) -> dict
get_scan_history(telegram_id, limit) -> list
```

### Message Format
```
🔍 Результат проверки

📦 Product Name
🏭 Organization Name

✅ Статус: Верифицирован
🏆 Рейтинг доверия: 85/100

[Подробнее на Честно.ру]
```

---

## Feature 5: Personal Product Portfolio + Recall Alerts

### Purpose
Enables consumers to maintain a personal history of products they've purchased/scanned, and receive automatic alerts if any products are recalled.

### Portfolio Features
- Track scanned/purchased products
- Mark favorites
- Add personal notes
- Organize into categories
- Track scan counts and dates

### Recall Alert System
1. Admin creates product recall (manual entry)
2. System matches against user portfolios
3. Affected users receive push/email/in-app notifications
4. Users can acknowledge alerts

### Database Tables
- `consumer_product_portfolio` - User product history
- `product_recalls` - Recall announcements
- `consumer_recall_alerts` - User-specific alerts
- `portfolio_categories` - User-defined categories
- `portfolio_item_categories` - Item-category mapping

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/portfolio/products/{id}` | Add to portfolio |
| GET | `/api/portfolio` | Get portfolio items |
| PATCH | `/api/portfolio/items/{id}` | Update item |
| DELETE | `/api/portfolio/items/{id}` | Remove item |
| GET | `/api/portfolio/categories` | Get categories |
| POST | `/api/portfolio/categories` | Create category |
| GET | `/api/portfolio/recalls` | Get recall alerts |
| GET | `/api/portfolio/recalls/check` | Check for recalls |
| POST | `/api/portfolio/recalls/{id}/acknowledge` | Acknowledge alert |
| GET | `/api/public/recalls` | List active recalls |
| POST | `/api/admin/recalls` | Create recall (admin) |

### Recall Severity Levels
- `info` - Informational notice
- `warning` - Important safety notice
- `critical` - Immediate action required

---

## Feature 6: Manufacturing Defect Early Warning

### Purpose
Automatically analyzes review text to detect complaint patterns and alert manufacturers when issues spike above baseline levels.

### How It Works
1. Reviews are classified against 10 complaint topics using keyword matching
2. Daily statistics are aggregated per topic
3. System compares current day to 30-day baseline
4. If topic mentions spike 3x+ above baseline, alert is created
5. Manufacturer receives notification with affected reviews

### Complaint Topics (Russian Keywords)
| Topic Code | Name | Example Keywords |
|------------|------|------------------|
| `packaging` | Упаковка | упаковка, коробка, вмятина |
| `freshness` | Свежесть | просроченный, испорченный, свежесть |
| `taste` | Вкус | вкус, невкусно, горький |
| `quality` | Качество | качество, брак, дефект |
| `quantity` | Количество | мало, недовес, не хватает |
| `foreign_objects` | Посторонние предметы | посторонний, волос, насекомое |
| `labeling` | Маркировка | этикетка, дата, состав |
| `allergies` | Аллергены | аллергия, аллерген |
| `delivery` | Доставка | доставка, курьер, опоздал |
| `service` | Сервис | обслуживание, персонал, грубый |

### Alert Severity
| Spike Factor | Severity |
|--------------|----------|
| 5x+ | Critical |
| 4x-5x | High |
| 3x-4x | Medium |
| <3x | Low |

### Database Tables
- `complaint_topics` - Topic definitions with keywords
- `review_topic_classifications` - Review-topic mappings
- `daily_topic_stats` - Aggregated daily statistics
- `defect_alerts` - Generated alerts

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/defects/topics` | List complaint topics |
| GET | `/api/organizations/{id}/defect-alerts` | Get alerts |
| PATCH | `/api/organizations/{id}/defect-alerts/{id}` | Update alert status |
| GET | `/api/organizations/{id}/defect-trends` | Topic trend data |
| POST | `/api/organizations/{id}/defect-detection/run` | Manual trigger |

### Alert Statuses
- `new` - Just created
- `acknowledged` - Seen by org
- `investigating` - Under investigation
- `resolved` - Issue fixed
- `dismissed` - False positive

---

## Feature 7: Interactive Supply Chain Journey (Enhanced)

### Purpose
Extends existing supply chain visualization with carbon footprint calculation and environmental scoring.

### New Features
1. **Carbon Footprint Calculation** - CO2 emissions by transport method
2. **Environmental Score** - Combined rating based on multiple factors
3. **Relatable Comparisons** - "Equivalent to X km by car"

### CO2 Emissions by Transport (kg CO2 per ton-km)
| Method | Emission Factor |
|--------|-----------------|
| Air | 0.602 |
| Truck | 0.062 |
| Local | 0.050 |
| Rail | 0.022 |
| Sea | 0.008 |
| Pipeline | 0.003 |

### Environmental Score Components
| Component | Weight | Description |
|-----------|--------|-------------|
| Verification Score | 30% | % of nodes verified |
| Carbon Score | 40% | Rating based on emissions |
| Distance Score | 30% | Penalty for long distances |

### Carbon Rating
- `excellent` - <0.02 kg CO2/km
- `good` - 0.02-0.04 kg CO2/km
- `average` - 0.04-0.06 kg CO2/km
- `high` - >0.06 kg CO2/km

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/supply-chain/product/{id}/carbon` | Carbon footprint |
| GET | `/api/supply-chain/product/{id}/journey-enhanced` | Journey with carbon data |

### Comparison Metrics
- Equivalent car kilometers
- Tree absorption days
- Smartphone charges

---

## Feature 8: Trust Circles

### Purpose
Enables users to create private groups where they share product recommendations with friends and family - word-of-mouth trust at scale.

### Features
1. **Circle Management** - Create, join via code, invite by email
2. **Product Sharing** - Share products with recommendations/ratings
3. **Social Features** - Like and comment on shared products
4. **Activity Feed** - See what circle members are sharing

### Limits
- Maximum 30 members per circle
- Invite code: 8 characters (uppercase + digits)
- Invite expiration: 7 days

### Database Tables
- `trust_circles` - Circle definitions
- `trust_circle_members` - Membership records
- `trust_circle_invites` - Pending invitations
- `circle_shared_products` - Shared product records
- `circle_product_comments` - Comments
- `circle_product_likes` - Likes
- `circle_activity` - Activity log

### Member Roles
- `owner` - Creator, full control
- `admin` - Can manage members and invites
- `moderator` - Can remove content
- `member` - Can share and interact

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/circles` | Create circle |
| GET | `/api/circles` | List my circles |
| GET | `/api/circles/{id}` | Get circle details |
| GET | `/api/circles/{id}/members` | List members |
| POST | `/api/circles/{id}/leave` | Leave circle |
| POST | `/api/circles/join?code=X` | Join by code |
| POST | `/api/circles/{id}/invites` | Create invite |
| POST | `/api/circles/invites/{token}/accept` | Accept invite |
| POST | `/api/circles/{id}/products` | Share product |
| GET | `/api/circles/{id}/products` | List shared products |
| POST | `/api/circles/products/{id}/like` | Like product |
| DELETE | `/api/circles/products/{id}/like` | Unlike |
| POST | `/api/circles/products/{id}/comments` | Add comment |
| GET | `/api/circles/products/{id}/comments` | Get comments |
| GET | `/api/circles/{id}/activity` | Activity feed |

---

## Feature 10: Review Intelligence Dashboard

### Purpose
Provides manufacturers with AI-powered insights from their reviews, including keyword trends, sentiment analysis, and actionable improvement suggestions.

### Analytics Features
1. **Keyword Extraction** - Top words from positive/negative reviews
2. **Sentiment Timeline** - Daily positive/neutral/negative breakdown
3. **Trend Analysis** - Keyword frequency over time
4. **Improvement Suggestions** - Actionable recommendations
5. **Benchmarking** - Compare to category averages

### Russian Stop Words
The system filters common Russian words (и, в, не, что, etc.) and common review words (товар, качество, доставка) to surface meaningful keywords.

### Suggestion Types
| Type | Priority | Example |
|------|----------|---------|
| `response_rate` | High | "Increase response rate to 80%+" |
| `negative_reviews` | High | "X negative reviews this month" |
| `rating` | Medium | "Improve average rating to 4.0+" |
| `keyword_issue` | Medium | "Frequent complaint: packaging" |

### Database Tables
- `review_intelligence_reports` - Generated reports
- `review_keywords` - Extracted keywords per period
- `category_benchmarks` - Industry benchmarks
- `improvement_suggestions` - Active suggestions

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organizations/{id}/intelligence/report` | Get latest report |
| POST | `/api/organizations/{id}/intelligence/report/generate` | Generate new report |
| GET | `/api/organizations/{id}/intelligence/keywords/{kw}/trends` | Keyword trends |
| GET | `/api/organizations/{id}/intelligence/suggestions` | Active suggestions |
| POST | `/api/organizations/{id}/intelligence/suggestions/generate` | Generate new |
| POST | `/api/organizations/{id}/intelligence/suggestions/{id}/dismiss` | Dismiss |
| GET | `/api/organizations/{id}/intelligence/sentiment` | Sentiment timeline |
| GET | `/api/intelligence/benchmarks/{category}` | Category benchmarks |

### Report Contents
- Period statistics (total reviews, avg rating, response rate)
- Rating distribution
- Daily trend data
- Keywords (overall, positive, negative)
- Top reviewed products
- Period-over-period comparison

---

## Database Migration Summary

| Migration | Feature | Tables Created |
|-----------|---------|----------------|
| 0112 | Verification Challenges | 3 tables, 2 types |
| 0113 | Counterfeit Detection | 3 tables, 1 function |
| 0114 | Trust Score | 3 tables, 1 function |
| 0115 | Product Portfolio | 4 tables, 2 functions |
| 0116 | Defect Early Warning | 4 tables, 2 functions |
| 0117 | Trust Circles | 7 tables, 2 functions |
| 0118 | Review Intelligence | 4 tables, 2 functions |
| 0119 | Telegram Scan Logs | 1 table |

---

## Integration Points

### Notification System
All features integrate with the existing notification system:
- `business.new_challenge` - New challenge for org
- `business.defect_alert` - Defect spike detected
- `business.counterfeit_alert` - Potential counterfeit
- `consumer.challenge_response` - Org responded to challenge
- `consumer.recall_alert` - Product recall affects user
- `consumer.circle_invite` - Invited to trust circle

### Trust Score Impact
Several features affect the trust score:
- Challenge response rate → `challenge_resolution` signal
- Supply chain verification → `supply_chain_docs` signal
- Review responses → `response_rate` signal

### Scheduled Jobs
Features requiring daily processing:
- `run_daily_detection()` - Defect spike detection
- `recalculate_all_trust_scores()` - Trust score updates
- `expire_old_challenges()` - Challenge expiration
- `run_daily_intelligence()` - Review intelligence reports

---

## Frontend Implementation Notes

### Required Components
Each feature needs frontend implementation:

1. **Challenges**: Challenge creation form, challenge list, voting UI
2. **Counterfeit**: Photo upload, results display, report form
3. **Trust Score**: Score card, signal breakdown, history chart
4. **Portfolio**: Product list, category management, recall alerts
5. **Defect Detection**: Alert dashboard, trend charts, topic visualization
6. **Supply Chain**: Carbon footprint display, environmental score badge
7. **Trust Circles**: Circle management, product sharing, activity feed
8. **Review Intelligence**: Dashboard with charts, suggestions list

### Design Recommendations
- Use existing design system components
- Trust Score: Circular gauge with grade badge
- Challenges: Timeline view with countdown
- Carbon Footprint: Progress bar with comparisons
- Trust Circles: Card-based product grid

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.0 | 2026-02-05 | Initial implementation of 9 features |
