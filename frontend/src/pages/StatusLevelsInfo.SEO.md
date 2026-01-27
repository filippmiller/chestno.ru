# SEO Metadata for Status Levels Info Page

## Meta Tags (to be added to head)

```html
<!-- Primary Meta Tags -->
<title>Система уровней доверия | Честно.ру - Прозрачная репутация для честного бизнеса</title>
<meta name="title" content="Система уровней доверия | Честно.ру - Прозрачная репутация для честного бизнеса" />
<meta name="description" content="Три уровня доверия для вашего бизнеса: A (Самодекларация), B (Проверено платформой), C (Высшая репутация). Начните с бесплатного trial на 14 дней." />
<meta name="keywords" content="уровни доверия, репутация бизнеса, статус организации, честный бизнес, верифицированный бизнес, рейтинг производителей, сделано в России" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:url" content="https://chestno.ru/levels" />
<meta property="og:title" content="Система уровней доверия | Честно.ру" />
<meta property="og:description" content="Три уровня доверия для вашего бизнеса: A, B, C. Покажите свою честность через действия." />
<meta property="og:image" content="https://chestno.ru/images/status-levels-og.jpg" />

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:url" content="https://chestno.ru/levels" />
<meta property="twitter:title" content="Система уровней доверия | Честно.ру" />
<meta property="twitter:description" content="Три уровня доверия для вашего бизнеса: A, B, C. Покажите свою честность через действия." />
<meta property="twitter:image" content="https://chestno.ru/images/status-levels-og.jpg" />

<!-- Additional -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="language" content="Russian" />
<meta name="author" content="Честно.ру" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="https://chestno.ru/levels" />
```

## Structured Data (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Система уровней доверия",
  "description": "Три уровня доверия для вашего бизнеса: A (Самодекларация), B (Проверено платформой), C (Высшая репутация)",
  "url": "https://chestno.ru/levels",
  "inLanguage": "ru-RU",
  "publisher": {
    "@type": "Organization",
    "name": "Честно.ру",
    "url": "https://chestno.ru"
  },
  "mainEntity": {
    "@type": "Service",
    "name": "Система уровней статуса организаций",
    "description": "Прозрачная репутация для честного бизнеса",
    "provider": {
      "@type": "Organization",
      "name": "Честно.ру"
    },
    "offers": [
      {
        "@type": "Offer",
        "name": "Уровень A - Самодекларация",
        "price": "2000",
        "priceCurrency": "RUB",
        "eligibleDuration": {
          "@type": "QuantitativeValue",
          "value": 1,
          "unitCode": "MON"
        }
      },
      {
        "@type": "Offer",
        "name": "Уровень B - Проверено платформой",
        "price": "5000",
        "priceCurrency": "RUB",
        "eligibleDuration": {
          "@type": "QuantitativeValue",
          "value": 1,
          "unitCode": "MON"
        }
      },
      {
        "@type": "Offer",
        "name": "Уровень C - Высшая репутация",
        "price": "0",
        "priceCurrency": "RUB",
        "description": "Заработанный статус, нельзя купить"
      }
    ]
  }
}
```

## Implementation Notes

To add these meta tags to the page, you can:

1. Use React Helmet or similar library
2. Update the index.html template
3. Use Next.js Head component (if migrating to Next.js)
4. Server-side rendering for dynamic meta tags

Example with React Helmet:

```tsx
import { Helmet } from 'react-helmet-async'

export const StatusLevelsInfo = () => {
  return (
    <>
      <Helmet>
        <title>Система уровней доверия | Честно.ру</title>
        <meta name="description" content="Три уровня доверия для вашего бизнеса: A, B, C. Начните с бесплатного trial на 14 дней." />
        <meta property="og:title" content="Система уровней доверия | Честно.ру" />
        <meta property="og:description" content="Три уровня доверия для вашего бизнеса: A, B, C." />
        <meta property="og:image" content="https://chestno.ru/images/status-levels-og.jpg" />
        <link rel="canonical" href="https://chestno.ru/levels" />
      </Helmet>

      {/* Page content */}
    </>
  )
}
```
