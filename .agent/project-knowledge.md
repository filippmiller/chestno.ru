# Project Knowledge Base
> **Auto-updating knowledge repository for AI agents**  
> Last updated: 2026-01-27

---

## 📋 How to Use This Document

### For AI Agents:
1. **READ THIS FIRST** at the start of every session
2. **FOLLOW** all documented solutions for known errors
3. **AUTO-UPDATE** this file when you solve a new error (use `/document-solution` skill)
4. **NEVER REPEAT** mistakes documented here

### For Humans:
- Review this file periodically to see what agents are learning
- Edit entries if needed to improve clarity
- Archive old/obsolete solutions

---

## 🎯 Project Overview

### Active Projects
- **Chestno.ru** - Main project (FastAPI backend + React frontend)
- **[Add other projects as discovered]**

### Infrastructure
- **Railway** - Deployment platform
- **PostgreSQL** - Primary database
- **Redis** - Caching/sessions
- **Cloudflare** - CDN/DNS

---

## ⚙️ Environment & Commands

### Chestno.ru

#### Backend (FastAPI - Python)
```bash
# Local dev server
cd c:\dev\Chestno.ru\backend
python -m uvicorn app.main:app --reload --port 8000

# Install dependencies
pip install -r requirements.txt

# Database migrations
alembic upgrade head

# Run scripts locally (NOT with Railway)
python scripts/script_name.py
```

**⚠️ KNOWN ISSUES:**
- ❌ **NEVER use `asyncio.run()` inside Railway commands** - event loop already running
  - **Solution**: Use `await` directly or create new script without `asyncio.run()`
- ❌ **DATABASE_URL from Railway** - Always use format: `postgresql+asyncpg://...`
  - **Command to check**: `railway variables --service backend 2>&1 | grep DATABASE_URL | head -1`

#### Frontend (React + Vite)
```bash
# Local dev server
cd c:\dev\Chestno.ru\frontend
npm run dev

# Install dependencies
npm install

# Build for production
npm run build
```

**⚠️ KNOWN ISSUES:**
- [To be documented as errors are discovered]

---

## 🐛 Known Errors & Solutions

### Category: Python / AsyncIO

#### Error: "asyncio.run() cannot be used when event loop is already running"
**When it happens:**
- Running Python scripts through Railway CLI
- Trying to seed data or run async functions via Railway

**Why it happens:**
- Railway already runs in an async context
- `asyncio.run()` tries to create a new event loop

**❌ WRONG approach:**
```bash
railway run --service backend python scripts/seed_demo_data.py
```

**✅ CORRECT approach:**
```python
# Option 1: Use await directly (if in async context)
await seed_demo_data()

# Option 2: Create endpoint and call via HTTP
# Create API endpoint /admin/seed-demo-data
# Then call: curl https://your-app.railway.app/admin/seed-demo-data

# Option 3: Run locally (not through Railway)
cd c:\dev\Chestno.ru\backend
python scripts/seed_demo_data.py
```

**Documented**: 2026-01-27  
**Occurrences**: Multiple

---

### Category: PHP / Framework Version Conflicts

#### Error: "Array and string offset access syntax with curly braces is no longer supported"
**Project**: Laravel/Yii legacy projects (site_demo)

**When it happens:**
- PHP 8.0+ with old framework versions
- Curly braces `{}` used instead of square brackets `[]`

**Why it happens:**
- PHP 7.4 → 8.0 deprecated curly brace syntax for array access
- Old vendor packages haven't been updated

**❌ WRONG approach:**
- Editing vendor files manually (changes will be overwritten)
- Patching config files

**✅ CORRECT approach:**
```bash
# Option 1: Update framework (PREFERRED)
composer update

# Option 2: Downgrade PHP (if framework can't be updated)
# Use PHP 7.4 instead of 8.0+

# Option 3: Check composer.json for PHP version requirements
cat composer.json | grep "php"
```

**Documented**: 2026-01-27  
**Occurrences**: Multiple

---

### Category: Git / Pre-commit Hooks

#### Error: "Pre-commit hook error" when editing files
**When it happens:**
- Making changes to files in repos with git hooks
- Pre-commit validation fails

**Why it happens:**
- Git pre-commit hooks enforce linting/formatting rules
- Changes don't pass validation

**❌ WRONG approach:**
- Ignoring and continuing to edit

**✅ CORRECT approach:**
```bash
# Option 1: Fix linting issues
npm run lint:fix  # or equivalent for project

# Option 2: Temporarily bypass hooks (USE SPARINGLY)
git commit --no-verify -m "message"

# Option 3: Check what hooks are configured
cat .git/hooks/pre-commit
```

**Documented**: 2026-01-27

---

### Category: Database / Connection Issues

#### Error: PostgreSQL connection failures
**When it happens:**
- [To be documented]

**Solutions:**
- [To be documented as errors are discovered]

---

### Category: Redis / Cache Issues

**To be documented as errors are discovered**

---

### Category: Cloudflare / DNS Issues

**To be documented as errors are discovered**

---

## 🔄 Auto-Documentation Template

### Category: [Error Type]

#### Error: "[Error Message]"
**When it happens:**
- [Context/triggers]

**Why it happens:**
- [Root cause]

**❌ WRONG approach:**
- [What doesn't work]

**✅ CORRECT approach:**
```bash
# Commands or code that solve it
```

**Documented**: [Date]  
**Occurrences**: [Count if known]

---

## 📊 Statistics

**Total documented errors**: 3  
**Last session**: 2026-01-27  
**Agent sessions logged**: 1

---

## 🧹 Archive

Obsolete solutions moved here after 90 days of no occurrences.

---

**⚡ Remember: Every error solved is knowledge gained. Document it!**
