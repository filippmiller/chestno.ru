---
description: Review session and document all significant errors
---

# Session Review Workflow

**Purpose**: At the end of a work session, review all errors encountered and ensure important ones are documented in the project knowledge base.

---

## When to Run

- End of a significant work session (30+ minutes)
- After solving complex issues with multiple errors
- User explicitly requests: `/review-session`
- Agent notices repeated errors during session

---

## Steps

### 1. Review Conversation History

Look back at the current conversation and identify:
- ❌ All errors that occurred
- 🔄 Errors that repeated (2+ times)
- ✅ Solutions that were successfully found
- ⏱️ Issues that took significant time to resolve (3+ attempts)

### 2. Filter for Documentation-Worthy Errors

An error is worth documenting if it meets ANY of these criteria:

**Must document:**
- ✅ Error occurred 2+ times in this session
- ✅ Error took 3+ attempts to solve
- ✅ Error relates to infrastructure (Railway, Postgres, Redis, Cloudflare)
- ✅ Error reveals project-specific pattern/workaround
- ✅ User expressed frustration about recurring nature

**Don't document:**
- ❌ One-time typos or syntax errors
- ❌ User-specific environment issues (not project-related)
- ❌ Already documented in `.agent/project-knowledge.md`
- ❌ Self-evident errors (obvious solutions)

### 3. Check Existing Documentation

Read the current knowledge base:
```
view_file: .agent/project-knowledge.md
```

For each error worthy of documentation:
- Check if already documented
- Check if needs updating (new information learned)

### 4. Document New Errors

For each undocumented error, use the `/document-solution` skill:

1. Read the skill instructions:
   ```
   view_file: .agent/skills/document-solution/SKILL.md
   ```

2. Follow the documentation template

3. Update `.agent/project-knowledge.md` with each entry

### 5. Update Session Statistics

At the bottom of `.agent/project-knowledge.md`, update:
```markdown
## 📊 Statistics

**Total documented errors**: [INCREMENT]
**Last session**: [TODAY'S DATE]
**Agent sessions logged**: [INCREMENT if new session]
```

### 6. Summary Report

Provide the user with a summary:

```markdown
## 🏁 Session Review Complete

### Errors Encountered: [N]
- [Brief description of each]

### Newly Documented: [N]
- [Category]: "[Error name]" → `.agent/project-knowledge.md`
- [Category]: "[Error name]" → `.agent/project-knowledge.md`

### Already Documented: [N]
- [Error name] (no action needed)

### Not Documented: [N]
- [Brief reason why - e.g., "one-time typo", "user-specific issue"]

---

📚 **Knowledge base updated**: `.agent/project-knowledge.md`

Future agents will benefit from these learnings! ✅
```

---

## Example Session Review

**Scenario**: Agent spent 1 hour debugging Railway deployment issues.

**Errors encountered**:
1. AsyncIO event loop error (occurred 3 times) ✅ Document
2. Missing environment variable (occurred 1 time, obvious fix) ❌ Skip
3. PostgreSQL connection string format (occurred 2 times) ✅ Document
4. Typo in function name (occurred 1 time) ❌ Skip

**Actions taken**:
- ✅ Documented AsyncIO error under "Python / AsyncIO"
- ✅ Documented PostgreSQL connection under "Database / PostgreSQL"
- ❌ Skipped environment variable (one-time, user added it)
- ❌ Skipped typo (developer error, not systematic)

**Result**:
```
## 🏁 Session Review Complete

### Errors Encountered: 4
- AsyncIO event loop when using Railway CLI
- Missing DATABASE_URL environment variable  
- PostgreSQL connection string format issue
- Typo in function name

### Newly Documented: 2
- Python / AsyncIO: "asyncio.run() cannot be used when event loop is already running"
- Database / PostgreSQL: "Incorrect connection string format for asyncpg"

### Not Documented: 2
- Missing env var (one-time user setup issue)
- Typo (developer error, not systematic)

---

📚 **Knowledge base updated**: `.agent/project-knowledge.md`
```

---

## Tips for Effective Reviews

1. **Be selective**: Not every error needs documentation
2. **Think future-proof**: Will this help future agents/developers?
3. **Check duplicates**: Don't re-document existing entries
4. **Update counts**: If error already exists, increment occurrence count
5. **Use categories**: Proper categorization makes knowledge searchable

---

**⚡ Good documentation today saves hours tomorrow!**
