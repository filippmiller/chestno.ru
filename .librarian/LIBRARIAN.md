# Chestno.ru Knowledge Librarian

> Version: 1.0.0
> Last Updated: 2026-01-18

## Overview

The Librarian is an internal knowledge management system for the Chestno.ru platform.
It stores structured knowledge about the codebase, database, workflows, and decisions
to help Claude agents work more effectively.

---

## Directory Structure

```
.librarian/
├── index.json          # Master searchable index of all knowledge
├── config.json         # Librarian configuration and rules
├── LIBRARIAN.md        # This file - system overview
└── domains/            # Knowledge organized by domain
    ├── database/       # Database tables, schemas, migrations
    ├── backend/        # API routes, services, business logic
    ├── frontend/       # Pages, components, routing
    ├── auth/           # Authentication flows, sessions
    ├── organizations/  # Organization management, teams
    ├── products/       # Product catalog
    ├── posts/          # Blog posts, content
    ├── reviews/        # Customer reviews, moderation
    ├── qr/             # QR codes, analytics
    ├── notifications/  # Notification system
    ├── marketing/      # Marketing materials
    ├── integrations/   # External services (Supabase, etc.)
    ├── admin/          # Admin panel features
    ├── deployment/     # Infrastructure, Railway
    └── business/       # Business workflows
```

---

## How to Query the Librarian

### At Session Start

1. Identify 3-10 keywords related to your task
2. Read `.librarian/index.json`
3. Search entries by keywords
4. Load relevant domain files for context

### Query Example

**Task:** "Fix the QR code analytics"

**Keywords:** `["qr", "code", "analytics", "scan", "tracking"]`

**Search Process:**
1. Search `index.json` entries for keyword matches
2. Find entries: `db-qr_codes`, `db-qr_events`, `svc-qr`, `page-org-qr`
3. Read relevant domain files:
   - `.librarian/domains/qr/analytics.md`
   - `.librarian/domains/database/tables.md` (QR sections)
   - `.librarian/domains/backend/services.md` (qr.py section)
4. Use this context to understand the system before making changes

---

## How to Ingest New Knowledge

### When to Add Knowledge

- After implementing a new feature
- After discovering important patterns
- After making architectural decisions
- After fixing complex bugs (document root cause)

### Ingestion Process

1. **Identify the domain** - Which area does this knowledge belong to?
2. **Check if domain exists** - Create new domain if needed
3. **Add to domain file** - Update the relevant `.md` file in `domains/`
4. **Add to index** - Create entry in `index.json`

### Entry Format

```json
{
  "id": "unique-identifier",
  "domain": "domain-name",
  "type": "table|service|page|workflow|etc",
  "name": "Human-readable name",
  "keywords": ["keyword1", "keyword2", ...],
  "file": "domains/domain/file.md",
  "anchor": "#section-anchor",
  "summary": "Brief description (max 500 chars)",
  "references": {
    "backend": ["path/to/file.py"],
    "frontend": ["path/to/file.tsx"],
    "tables": ["table_name"]
  },
  "createdAt": "YYYY-MM-DD"
}
```

---

## Domain Creation Rules

Create a new domain when:

1. **New functional area** - A distinct feature set emerges
2. **Existing domain too large** - More than ~50 entries
3. **Low keyword overlap** - Less than 30% overlap with existing domains
4. **Clear separation** - The knowledge is distinct enough to warrant isolation

### Domain File Format

```markdown
# Domain Title

> Last updated: YYYY-MM-DD
> Domain: domain-name
> Keywords: keyword1, keyword2, keyword3

## Overview

Brief description of what this domain covers.

---

## Section 1

### Subsection

Content...

---

## Section 2

...
```

---

## Search Algorithm

The Librarian uses weighted search:

1. **Exact match** (weight: 1.0) - Keyword matches entry keyword exactly
2. **Partial match** (weight: 0.7) - Keyword is substring of entry keyword
3. **Domain match** (weight: 0.5) - Keyword matches domain name
4. **Related match** (weight: 0.3) - Keyword found in references

### Freshness Priority

Fresh knowledge is served first:
- Today: weight 1.0
- This week: weight 0.9
- This month: weight 0.7
- Older: weight 0.5

---

## Invalidation

Mark knowledge as invalidated when:

1. Code has been significantly refactored
2. Feature has been removed
3. API endpoints have changed
4. Database schema has changed

### Invalidation Format

Add to entry:
```json
{
  "invalidated": true,
  "invalidatedAt": "YYYY-MM-DD",
  "invalidationReason": "Feature removed in PR #123"
}
```

---

## Current Knowledge Summary

### Domains: 15
- database, backend, frontend, auth, organizations
- products, posts, reviews, qr, notifications
- marketing, integrations, admin, deployment, business

### Entries: 30+
- Database tables: 13
- Backend services: 5
- Backend routes: 1
- Frontend pages: 6
- Workflows: 3
- Integrations: 2

### Key Files Documented

**Backend:**
- All API routes in `backend/app/api/routes/`
- All services in `backend/app/services/`
- All schemas in `backend/app/schemas/`

**Frontend:**
- All pages in `frontend/src/pages/`
- Key components in `frontend/src/components/`
- All API services in `frontend/src/api/`

**Database:**
- All 23 migrations in `supabase/migrations/`
- All tables, relationships, and RLS policies

---

## Maintenance

### Weekly Review
- Check for outdated entries
- Add new knowledge from recent work
- Update summaries if needed

### After Major Changes
- Update affected domain files
- Add/update index entries
- Mark invalidated knowledge

---

## Integration with CLAUDE.md

See `CLAUDE.md` for the full agent protocol that includes:
1. Mandatory librarian query at session start
2. Knowledge ingestion after meaningful tasks
3. Search strategy guidelines
