---
name: document-solution
description: Automatically document error solutions in project knowledge base
---

# Document Solution Skill

## Purpose
This skill enables AI agents to automatically document errors and their solutions into the project knowledge base (`.agent/project-knowledge.md`), creating a self-learning system that prevents repeating the same mistakes.

## When to Use This Skill

### Automatic Triggers (MUST use):
1. ✅ **After solving a repeated error** (same error occurred 2+ times)
2. ✅ **After solving a significant error** (took multiple attempts to fix)
3. ✅ **After discovering project-specific workarounds** (non-obvious solutions)
4. ✅ **After figuring out infrastructure quirks** (Railway, Postgres, Redis, Cloudflare)

### Manual Triggers:
- User explicitly requests documentation: `/document-solution`
- End of session review: `/review-session`

## How to Use

### Step 1: Detect When Documentation is Needed

Monitor these signals:
- **Error repetition**: Same error message appears multiple times in conversation
- **Trial & error**: You tried 3+ different approaches before finding solution
- **Infrastructure-specific**: Problem relates to Railway, databases, deployment
- **Framework quirks**: Version conflicts, deprecated syntax, async issues

### Step 2: Extract Error Information

Gather these details:
```
- Error message (exact text)
- Error category (Python/AsyncIO, Git, Database, etc.)
- Context (when/why it happens)
- Root cause (why it happens)
- Wrong approaches tried (what didn't work)
- Correct solution (what worked)
- Project(s) affected
```

### Step 3: Document in Structured Format

Read the current knowledge base:
```
view_file: .agent/project-knowledge.md
```

Then add a new entry using this template:

```markdown
### Category: [Choose: Python/AsyncIO, PHP/Framework, Git, Database, Redis, Cloudflare, Build/Deploy, Dependencies, Environment, Other]

#### Error: "[Exact error message or short description]"
**When it happens:**
- [Specific triggers, contexts, commands that cause it]

**Why it happens:**
- [Root cause explanation]

**❌ WRONG approach:**
- [List approaches that don't work]
- [Include what you tried unsuccessfully]

**✅ CORRECT approach:**
```bash
# Show exact commands or code that solve it
# Include comments explaining why
```

**Documented**: [Current date YYYY-MM-DD]  
**Occurrences**: [Number of times seen, or "Multiple"]

---
```

### Step 4: Update the Knowledge Base

Use `replace_file_content` or `multi_replace_file_content` to add the entry:
- Find the appropriate category section
- Add the new error entry
- Update statistics at bottom (increment error count)
- Update "Last session" date

### Step 5: Confirm to User

After documenting, tell the user:
```
📝 **Documented solution** in `.agent/project-knowledge.md`
   → Category: [category]
   → Error: [short description]
   
   Future agents will now avoid this error automatically! ✅
```

## Examples

### Example 1: AsyncIO Error with Railway

**Detected signals:**
- Error appeared 3 times in conversation
- Tried multiple Railway commands
- Finally solved with local script execution

**Documentation created:**
```markdown
### Category: Python / AsyncIO

#### Error: "asyncio.run() cannot be used when event loop is already running"
**When it happens:**
- Running Python scripts through Railway CLI
- Trying to seed data or run async functions via Railway

**Why it happens:**
- Railway already runs in an async context
- `asyncio.run()` tries to create a new event loop

**❌ WRONG approach:**
- `railway run --service backend python scripts/seed.py`

**✅ CORRECT approach:**
```bash
# Option 1: Run locally (not through Railway)
cd backend && python scripts/seed.py

# Option 2: Create HTTP endpoint and call it
# /admin/seed-data endpoint → curl https://app/admin/seed-data
```

**Documented**: 2026-01-27  
**Occurrences**: 3
```

### Example 2: PHP Version Conflict

**Detected signals:**
- Same curly brace error repeated
- Agent wasted time editing vendor files
- Finally understood it's a version issue

**Documentation created:**
```markdown
### Category: PHP / Framework Version Conflicts

#### Error: "Array and string offset access syntax with curly braces is no longer supported"
**When it happens:**
- PHP 8.0+ with old framework versions (Laravel/Yii)

**Why it happens:**
- PHP deprecated curly braces `{}` syntax in 8.0
- Old vendor packages not updated

**❌ WRONG approach:**
- Editing vendor files (will be overwritten on next install)
- Patching framework files manually

**✅ CORRECT approach:**
```bash
# Update framework
composer update

# OR downgrade PHP to 7.4
# Check PHP version requirement
cat composer.json | grep "php"
```

**Documented**: 2026-01-27  
**Occurrences**: Multiple
```

## Important Rules

### DO:
✅ Document **after** finding the solution  
✅ Be specific with error messages (exact text)  
✅ Include both wrong and correct approaches  
✅ Update statistics at bottom of file  
✅ Use clear category labels  
✅ Include dates for tracking  
✅ Show exact commands/code that work  

### DON'T:
❌ Document before verifying the solution works  
❌ Use vague descriptions ("some database error")  
❌ Skip the "wrong approach" section (it helps future debugging)  
❌ Forget to update the error count  
❌ Document obvious errors (typos, simple syntax errors)  
❌ Document one-time user-specific issues  

## What Makes A Good Documentation Entry?

### ⭐ Good Entry Characteristics:
1. **Specific error message** - Future agents can search for it
2. **Clear reproduction steps** - When/how error occurs
3. **Root cause explanation** - Why it happens (educational)
4. **Explicit commands** - Copy-paste ready solutions
5. **Anti-patterns listed** - What NOT to do (saves time)

### 💩 Poor Entry Characteristics:
1. Vague: "Database didn't work"
2. No commands: "Just fix the config"
3. No context: "Error in backend"
4. No wrong approaches: Only shows solution

## Categories Reference

Choose the most relevant category:

| Category | Use For |
|----------|---------|
| **Python / AsyncIO** | Event loop, async/await, coroutine errors |
| **Python / Dependencies** | Import errors, package conflicts, version issues |
| **PHP / Framework** | Laravel, Yii, Symfony issues |
| **JavaScript / Node** | npm, TypeScript, React errors |
| **Git / Version Control** | Pre-commit hooks, merge conflicts, git commands |
| **Database / PostgreSQL** | Connection, query, migration errors |
| **Database / Redis** | Cache, connection, data type issues |
| **Infrastructure / Railway** | Deployment, environment, CLI issues |
| **Infrastructure / Cloudflare** | DNS, CDN, SSL issues |
| **Build / Compilation** | Webpack, Vite, build failures |
| **Environment / Config** | Environment variables, config files |
| **API / Integration** | External API errors, authentication |

## Integration with Agent Workflow

This skill should be **automatically considered** by agents when:

1. **Pattern recognition**: "I've seen this error before in this session" → Document after solving
2. **High effort**: "I tried 3+ different solutions" → Document the working one
3. **Infrastructure discovery**: "Learned something about Railway/Postgres/Redis" → Document it
4. **User frustration**: User says "agents always get stuck on this" → Document solution

## Maintenance

### Periodic Reviews (Humans):
- Review entries monthly
- Archive solutions for deprecated projects
- Consolidate duplicate entries
- Add clarifications based on agent feedback

### Metric Tracking:
- Count total documented errors
- Track occurrences per error
- Monitor which categories are most common
- Measure reduction in repeated errors over time

---

**Remember**: Every well-documented error is one less mistake future agents will make! 🚀
