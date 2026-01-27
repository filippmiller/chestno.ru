# Quick Start Prompts - Copy & Paste

**Choose your path and copy the prompt below into PowerShell**

---

## 🚀 OPTION 1: Parallel Execution (Recommended)

### Terminal 1 - Critical Path (2-3 days)
```
Implement Payments backend integration (Phase 1-4). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Payments_v1.md. Tasks: Database migration (create tables: payment_transactions with columns id/organization_id/amount/currency/status/yukassa_payment_id/created_at/updated_at, payment_webhooks_log with id/event_type/payload/processed_at/status, subscription_retry_attempts), YukassaProvider service (methods: create_payment, get_payment_status, refund_payment, create_preauth with 1₽ amount and auto_capture=false), PaymentService (methods: initiate_trial_with_preauth calls YukassaProvider.create_preauth then grants Level 0 status via status_levels.grant_status_level, charge_subscription charges recurring payment then calls status_levels.ensure_level_a on success, process_payment_success updates transaction status and grants appropriate level, process_payment_failure calls status_levels.start_grace_period with 14 days), WebhookService (process_webhook with signature verification, idempotency check via webhooks_log, calls PaymentService handlers), API endpoints (POST /payments/checkout/trial requires org_id returns payment_url, POST /payments/checkout/subscription requires org_id/plan_id, POST /webhooks/yukassa with signature header verification). Integration: Import status_levels service, call grant_status_level/revoke_status_level/handle_subscription_status_change as documented in backend/docs/STATUS_LEVELS_SUBSCRIPTION_INTEGRATION.md. Expected deliverables: 3 database tables, 3 service classes, 3 API endpoints, comprehensive error handling, webhook idempotency. Work as 2 parallel agents: Agent 1 (database + YukassaProvider + PaymentService), Agent 2 (WebhookService + API endpoints). Target: 16 hours (2 days with 2 devs).
```

### Terminal 2 - Quick Win (1 day)
```
Implement QR code improvements (all 3 phases). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_QR_Improvements_v1.md. Tasks: Phase 1 (time-series analytics: timeline endpoint GET /qr/codes/:id/timeline, QRTimelineChart component with Chart.js, period selector 7d/30d/90d/all), Phase 2 (QR customization: color picker component, logo upload with validation, contrast validation WCAG AA, QRCustomizer component), Phase 3 (batch operations: bulk create POST /qr/codes/batch, export ZIP endpoint, CSV upload parser, selection mode UI with checkboxes). Expected deliverables: 3 backend endpoints, 4 frontend components, unit tests for each phase, integration tests. Work autonomously through all 3 phases sequentially. Test each phase before moving to next. Target: 12-14 hours total.
```

---

## 🎯 OPTION 2: Sequential Execution

### Step 1: QR Improvements (1 day)
```
Implement QR code improvements (all 3 phases). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_QR_Improvements_v1.md. Tasks: Phase 1 (time-series analytics: timeline endpoint GET /qr/codes/:id/timeline, QRTimelineChart component with Chart.js, period selector 7d/30d/90d/all), Phase 2 (QR customization: color picker component, logo upload with validation, contrast validation WCAG AA, QRCustomizer component), Phase 3 (batch operations: bulk create POST /qr/codes/batch, export ZIP endpoint, CSV upload parser, selection mode UI with checkboxes). Expected deliverables: 3 backend endpoints, 4 frontend components, unit tests for each phase, integration tests. Work autonomously through all 3 phases sequentially. Test each phase before moving to next. Target: 12-14 hours total.
```

### Step 2: Payments Backend (2 days)
**Copy after Step 1 complete:**
```
Implement Payments backend integration (Phase 1-4). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Payments_v1.md. Tasks: Database migration (create tables: payment_transactions with columns id/organization_id/amount/currency/status/yukassa_payment_id/created_at/updated_at, payment_webhooks_log with id/event_type/payload/processed_at/status, subscription_retry_attempts), YukassaProvider service (methods: create_payment, get_payment_status, refund_payment, create_preauth with 1₽ amount and auto_capture=false), PaymentService (methods: initiate_trial_with_preauth calls YukassaProvider.create_preauth then grants Level 0 status via status_levels.grant_status_level, charge_subscription charges recurring payment then calls status_levels.ensure_level_a on success, process_payment_success updates transaction status and grants appropriate level, process_payment_failure calls status_levels.start_grace_period with 14 days), WebhookService (process_webhook with signature verification, idempotency check via webhooks_log, calls PaymentService handlers), API endpoints (POST /payments/checkout/trial requires org_id returns payment_url, POST /payments/checkout/subscription requires org_id/plan_id, POST /webhooks/yukassa with signature header verification). Integration: Import status_levels service, call grant_status_level/revoke_status_level/handle_subscription_status_change as documented in backend/docs/STATUS_LEVELS_SUBSCRIPTION_INTEGRATION.md. Expected deliverables: 3 database tables, 3 service classes, 3 API endpoints, comprehensive error handling, webhook idempotency. Work as 2 parallel agents: Agent 1 (database + YukassaProvider + PaymentService), Agent 2 (WebhookService + API endpoints). Target: 16 hours (2 days with 2 devs).
```

### Step 3: Payments Testing (1-2 days)
**Copy after Step 2 complete:**
```
Implement Payments testing and deployment (Phase 5-7). Read C:\Dev\_OpsVault\Chestno.ru\Docs\checklists\IMPL_Payments_v1.md. Tasks: Unit tests (PaymentService: test_initiate_trial creates payment and grants Level 0, test_charge_subscription charges and grants Level A, test_payment_failure starts grace period; WebhookService: test_signature_verification, test_idempotency duplicate webhooks ignored, test_payment_success_webhook, test_payment_failure_webhook), Integration tests in sandbox mode (Trial flow: org signs up → 1₽ preauth created → Level 0 granted → verify in database, Payment success: mock webhook → Level A granted → verify, Payment failure: mock webhook → grace period started → verify 14 days, Webhook idempotency: send same webhook twice → processed once, Upgrade A→B: existing Level A → payment → Level B granted), Security tests (invalid signature rejected, SQL injection attempts blocked, rate limiting 100 req/min), Production deployment (Railway: add secrets YUKASSA_SHOP_ID/YUKASSA_SECRET_KEY/YUKASSA_WEBHOOK_SECRET, Supabase: run payment migrations 003x-003y, Register webhook URL with ЮKassa production account, verify SSL certificate), Monitoring (Sentry: track failed webhooks, Dashboard: track grace period expirations, Alert: revenue anomalies). Expected deliverables: 20+ unit tests, 5+ integration tests, security test suite, production deployment checklist, monitoring dashboards. Work as 2 parallel agents: Agent 1 (all testing), Agent 2 (deployment + monitoring). Target: 11 hours (1-2 days with 2 devs).
```

---

## 📊 WHAT COMES AFTER

After Payments complete, Stories MVP begins (4-5 weeks):

1. **Stories Week 1:** Database & Backend (60h)
2. **Stories Week 2:** Frontend Components (40h)
3. **Stories Week 3-4:** Pages & Testing (105h)
4. **Final Week:** Integration & Launch (40h)

*Full prompts available in IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md*

---

## ⏱️ ESTIMATED TIMELINE

### Option 1 (Parallel):
- **Day 1:** QR complete, Payments 50% done
- **Day 2-3:** Payments backend complete
- **Day 4-5:** Payments testing & deploy complete
- **Week 2+:** Stories begins

**Total to Payments complete:** 5 days

---

### Option 2 (Sequential):
- **Day 1:** QR complete
- **Day 2-3:** Payments backend complete
- **Day 4-5:** Payments testing & deploy complete
- **Week 2+:** Stories begins

**Total to Payments complete:** 5 days

---

## 📋 COMPLETION CHECKLIST

After each prompt completes, verify:

**QR Improvements:**
- [ ] Timeline chart displays scan data
- [ ] QR customization works (colors, logos)
- [ ] Batch operations create/export QR codes
- [ ] All tests passing

**Payments Backend:**
- [ ] Database migrations applied
- [ ] YukassaProvider service created
- [ ] PaymentService created
- [ ] WebhookService created
- [ ] All API endpoints working
- [ ] Integration with status_levels verified

**Payments Testing:**
- [ ] 20+ unit tests passing
- [ ] Sandbox integration tests passing
- [ ] Production deployment complete
- [ ] Monitoring dashboards live
- [ ] First test payment successful

---

**Ready to start?** Copy a prompt above and paste into PowerShell!

**Need more context?** Read IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md for full analysis.
