# Content Service Example with x402 Paywall

This example demonstrates how to implement a content service with x402 paywall integration using the NANDA SDK. Perfect for blogs, news sites, research platforms, or any content-based service.

## Overview

A content service that offers:
- **Free content**: Accessible without payment (previews, free articles)
- **Premium content**: Full articles requiring NANDA Points payment
- **Subscription model**: Time-based unlimited access to premium content
- **Preview functionality**: Free previews of premium content

## Features

- **Flexible Content Tiers**: Free and premium content with different pricing
- **Preview System**: Free previews to encourage premium purchases
- **Subscription Options**: Time-based unlimited access (daily/hourly)
- **Category Organization**: Content organized by categories
- **Payment Integration**: Seamless x402 payment verification and settlement

## API Endpoints

### Public Endpoints
- `GET /` - Service overview
- `GET /articles` - List all articles with previews
- `GET /articles/category/:category` - Articles by category
- `GET /articles/:id/preview` - Free preview of any article
- `GET /categories` - Available categories with statistics

### Premium Endpoints (Require Payment)
- `GET /articles/:id` - Full article content (premium articles only)
- `POST /subscription/daily` - Purchase time-based unlimited access

## Content Structure

### Article Tiers
- **Free Articles**: Full content accessible without payment
- **Premium Articles**: Require individual payment for full access

### Pricing Model
- **Individual Articles**: 2.50 - 4.00 NP per article
- **Daily Subscription**: 0.50 NP per hour of unlimited access

## Setup

```bash
# Install dependencies
npm install

# Set environment variables
export FACILITATOR_URL=http://localhost:8080
export PORT=3004

# Run development server
npm run dev

# Or build and run production
npm run build
npm start
```

## Usage Examples

### Browse Free Content
```bash
# List all articles
curl http://localhost:3004/articles

# Get article preview
curl http://localhost:3004/articles/premium-001/preview

# Browse by category
curl http://localhost:3004/articles/category/technology
```

### Access Premium Content

#### Without Payment (returns 402)
```bash
curl http://localhost:3004/articles/premium-001
```

Response:
```json
{
  "error": "Payment Required",
  "article": {
    "id": "premium-001",
    "title": "Advanced x402 Payment Integration Patterns",
    "preview": "Deep dive into sophisticated x402 integration patterns...",
    "wordCount": 2200
  },
  "x402": {
    "cost": 250,
    "description": "Access to full article: \"Advanced x402 Payment Integration Patterns\"",
    "currency": "NP",
    "facilitatorUrl": "http://localhost:8080"
  }
}
```

#### With Payment
```bash
curl http://localhost:3004/articles/premium-001 \
  -H "x-payment: {\"paymentPayload\": {...}, \"paymentRequirements\": {...}}"
```

### Subscription Access

#### Purchase Daily Subscription
```bash
curl -X POST http://localhost:3004/subscription/daily \
  -H "Content-Type: application/json" \
  -H "x-payment: {\"paymentPayload\": {...}}" \
  -d '{"duration_hours": 4}'
```

## Integration Patterns

### 1. Content Access Control
```typescript
const requireContentPayment = (articleId: string) => {
  return async (c: any, next: any) => {
    const article = findArticle(articleId);

    if (article.tier === 'free') {
      return next(); // Free access
    }

    // Check for payment or subscription
    const payment = checkPayment(c.req.header('x-payment'));
    const subscription = checkSubscription(c.req.header('authorization'));

    if (!payment && !subscription) {
      return c.json({ error: 'Payment Required', x402: {...} }, 402);
    }

    await next();
  };
};
```

### 2. Preview Generation
```typescript
const generatePreview = (content: string, maxLength: number = 150) => {
  const sentences = content.split(/[.!?]+/);
  let preview = '';

  for (const sentence of sentences) {
    if (preview.length + sentence.length > maxLength) break;
    preview += sentence + '.';
  }

  return preview + '...';
};
```

### 3. Subscription Management
```typescript
const validateSubscription = (token: string) => {
  // In production, verify JWT or check database
  const subscription = parseSubscriptionToken(token);
  return subscription && new Date() < new Date(subscription.expires_at);
};
```

## Business Models

### Pay-Per-Article
- Individual pricing for each premium article
- Good for high-value, specialized content
- Users pay only for content they consume

### Subscription Tiers
- Time-based unlimited access (hourly/daily/weekly)
- Predictable pricing for frequent readers
- Higher user engagement and retention

### Freemium
- Free previews and selected free articles
- Premium content behind paywall
- Balanced approach to user acquisition and monetization

## Content Management

### Article Structure
```typescript
interface Article {
  id: string;
  title: string;
  category: string;
  tier: 'free' | 'premium';
  cost?: number; // Cost in minor units (NP cents)
  preview: string;
  content: string;
  wordCount: number;
  publishedAt: string;
}
```

### Dynamic Pricing
Articles can have different pricing based on:
- Content length and complexity
- Category and specialization
- Publication date and relevance
- Author reputation and expertise

## Environment Variables

- `FACILITATOR_URL` - URL of the NANDA facilitator service
- `PORT` - Port to run the service on (default: 3004)

## Developer Benefits

- **Monetize content immediately** without complex subscription systems
- **Flexible pricing models** per article or time-based access
- **Free preview system** to drive conversions
- **Category organization** for better user experience
- **Standard HTTP 402** implementation for web compatibility

This example shows how content creators and publishers can quickly monetize their work using the NANDA x402 ecosystem while maintaining user-friendly access patterns.