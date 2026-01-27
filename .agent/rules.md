# Agent Rules for Chestno.ru Project

## 🎯 Core Principles

1. **Learn from the past**: Read project knowledge before starting work
2. **Document solutions**: Automatically document significant errors after solving them
3. **Avoid repetition**: Never repeat mistakes already documented
4. **Be proactive**: Auto-invoke documentation skill when appropriate

---

## 📚 Mandatory: Read Knowledge Base First

### At the START of EVERY session:

**BEFORE doing any work**, you MUST:

```
1. Read: .agent/project-knowledge.md
2. Understand: All documented errors and their solutions
3. Follow: All documented project-specific patterns
```

**Why**: This file contains accumulated learnings from previous agent sessions. Reading it prevents repeating known errors and saves massive amounts of time.

**How**:
```
view_file: c:\dev\Chestno.ru\.agent\project-knowledge.md
```

**What to extract**:
- ✅ Project start commands (backend/frontend)
- ✅ Known error patterns and their solutions
- ✅ Infrastructure quirks (Railway, Postgres, Redis)
- ✅ Wrong approaches to avoid

---

## 🤖 Automatic Error Documentation

### When to Auto-Document

You MUST automatically invoke the `/document-solution` skill when:

1. **Repeated Error**: Same error occurred 2+ times in current session
   - Example: "AsyncIO event loop error" appeared 3 times before solving

2. **High Effort Resolution**: Took 3+ different approaches before finding solution
   - Example: Tried Railway command → local script → API endpoint → finally worked

3. **Infrastructure Discovery**: Learned something non-obvious about:
   - Railway deployment/CLI quirks
   - PostgreSQL connection patterns
   - Redis behavior
   - Cloudflare configuration

4. **Framework-Specific Patterns**: Discovered workarounds for:
   - Version conflicts (PHP 8.0 curly braces)
   - Async/await patterns in Python
   - Build tool configurations

### How to Auto-Document

```
1. Recognize pattern: "I've seen this error before" or "This took many attempts"
2. Read skill: view_file: .agent/skills/document-solution/SKILL.md
3. Follow template: Extract error info, categorize, format
4. Update knowledge base: Replace/add entry to .agent/project-knowledge.md
5. Inform user: "📝 Documented solution in knowledge base"
```

### What NOT to Document

Don't waste time documenting:
- ❌ One-time typos or syntax errors
- ❌ User-specific environment setup (unless project-wide pattern)
- ❌ Already documented errors (check first!)
- ❌ Obvious errors with self-evident solutions

---

## 🔄 Error Handling Protocol

### Standard Flow

```
1. Encounter error
   ↓
2. Check if documented in .agent/project-knowledge.md
   ↓
3a. If DOCUMENTED → Apply documented solution immediately ✅
   ↓
3b. If NOT documented → Debug and solve ⚙️
   ↓
4. If solved after 2+ attempts OR repeated occurrence
   → Auto-invoke /document-solution skill 📝
   ↓
5. Continue work
```

### Example

**Scenario**: Agent runs into PostgreSQL connection error

```
❌ Error: "asyncpg connection failed"

1. Check knowledge base first:
   → view_file: .agent/project-knowledge.md
   → Search for "postgres" or "asyncpg"

2a. If FOUND:
   → "Ah, Railway uses postgresql+asyncpg:// format"
   → Apply solution immediately
   → Tell user: "Applied known solution from knowledge base ✅"
   → Continue work

2b. If NOT FOUND:
   → Debug the issue
   → Try different connection strings
   → Eventually solve it
   → Auto-document: "This was non-obvious, documenting for future"
   → Update .agent/project-knowledge.md
   → Continue work
```

---

## 📂 Project-Specific Rules

### File Locations

- **Backend**: `c:\dev\Chestno.ru\backend`
- **Frontend**: `c:\dev\Chestno.ru\frontend`
- **Knowledge Base**: `c:\dev\Chestno.ru\.agent\project-knowledge.md`
- **Skills**: `c:\dev\Chestno.ru\.agent\skills\`
- **Workflows**: `c:\dev\Chestno.ru\.agent\workflows\`

### Default Commands

**Always check `.agent/project-knowledge.md` first**, but defaults are:

```bash
# Backend dev server
cd c:\dev\Chestno.ru\backend
python -m uvicorn app.main:app --reload --port 8000

# Frontend dev server
cd c:\dev\Chestno.ru\frontend
npm run dev
```

### Infrastructure

- **Railway**: Used for deployment
  - ⚠️ Don't use `asyncio.run()` in Railway commands (event loop already running)
  - ⚠️ Check DATABASE_URL format: `postgresql+asyncpg://...`

- **Postgres**: Primary database
  - Connection via asyncpg driver
  
- **Redis**: Cache/sessions
  - [Details to be documented as patterns emerge]

---

## 🛠️ Available Skills & Workflows

### Skills

**`/document-solution`**: Document error solutions in knowledge base
- **When**: After solving repeated/complex errors
- **Usage**: Auto-invoked by agent OR manually by user
- **Location**: `.agent/skills/document-solution/SKILL.md`

### Workflows

**`/review-session`**: Review all errors at end of session
- **When**: End of work session, user requests, or after solving many errors
- **Usage**: Manual invocation
- **Location**: `.agent/workflows/review-session.md`

---

## 💡 Best Practices

### DO:
✅ Read `.agent/project-knowledge.md` at session start  
✅ Apply documented solutions immediately when encountering known errors  
✅ Document solutions after 2+ error occurrences or 3+ failed attempts  
✅ Use specific error messages in documentation  
✅ Include both wrong and correct approaches  
✅ Update error occurrence counts  

### DON'T:
❌ Skip reading the knowledge base  
❌ Repeat documented mistakes  
❌ Document before verifying solution works  
❌ Document one-time user-specific issues  
❌ Forget to update statistics in knowledge base  
❌ Use vague descriptions in documentation  

---

## 📊 Success Metrics

Track these to measure learning effectiveness:

- **Error repetition rate**: Should decrease over time
- **Time to solve known errors**: Should approach zero
- **Knowledge base entries**: Should grow steadily
- **Context bloat**: Should reduce as errors are prevented

---

## 🔄 Maintenance

### Weekly (Automated by Agents):
- Increment error occurrence counts when encountering documented errors
- Add new entries for novel errors
- Update "Last session" date

### Monthly (Human Review):
- Review documentation quality
- Archive obsolete entries
- Consolidate duplicate patterns
- Update commands if project structure changes

---

**⚡ Remember**: The knowledge base is a living document. Every session makes it stronger! 🚀
