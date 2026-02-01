"""
Certification & Compliance Hub Service.

Handles all certification-related business logic including:
- Certification CRUD operations
- Document upload and verification
- Expiry tracking and alerts
- External verification API integration
- Consumer verification portal
"""
import asyncio
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from ..core.supabase import get_supabase_client
from ..schemas.certifications import (
    CertificationCategory,
    VerificationStatus,
    ProducerCertificationCreate,
    ProducerCertificationUpdate,
    ProducerCertification,
    ProducerCertificationPublic,
    CertificationType,
    CertificationTypePublic,
    OrganizationCertificationSummary,
    ExpiryAlert,
    VerificationLogEntry,
    DocumentVerificationResult,
    VerifyExternalResponse,
    CertificationSearchFilters,
    CertificationSearchResult,
    CertificationSearchResponse,
    CertificationAdminStats,
    PendingVerificationItem,
)


class CertificationService:
    """Service for managing certifications."""

    def __init__(self):
        self.supabase = get_supabase_client()

    # =========================================================================
    # Certification Types (Reference Data)
    # =========================================================================

    async def list_certification_types(
        self,
        category: Optional[CertificationCategory] = None,
        active_only: bool = True,
    ) -> list[CertificationType]:
        """List available certification types."""
        query = self.supabase.table("certification_types").select("*")

        if active_only:
            query = query.eq("is_active", True)

        if category:
            query = query.eq("category", category.value)

        query = query.order("display_order").order("name_ru")
        result = query.execute()

        return [CertificationType(**row) for row in result.data]

    async def get_certification_type(self, type_id: str) -> Optional[CertificationType]:
        """Get a specific certification type."""
        result = (
            self.supabase.table("certification_types")
            .select("*")
            .eq("id", type_id)
            .single()
            .execute()
        )
        return CertificationType(**result.data) if result.data else None

    async def get_certification_type_by_code(
        self, code: str
    ) -> Optional[CertificationType]:
        """Get certification type by code."""
        result = (
            self.supabase.table("certification_types")
            .select("*")
            .eq("code", code)
            .single()
            .execute()
        )
        return CertificationType(**result.data) if result.data else None

    # =========================================================================
    # Producer Certifications CRUD
    # =========================================================================

    async def create_certification(
        self,
        organization_id: str,
        data: ProducerCertificationCreate,
        user_id: str,
    ) -> ProducerCertification:
        """Create a new certification for an organization."""
        insert_data = {
            "organization_id": organization_id,
            "certification_type_id": data.certification_type_id,
            "certificate_number": data.certificate_number,
            "issued_by": data.issued_by,
            "issued_date": data.issued_date.isoformat() if data.issued_date else None,
            "expiry_date": data.expiry_date.isoformat() if data.expiry_date else None,
            "scope_description": data.scope_description,
            "product_ids": data.product_ids,
            "is_public": data.is_public,
            "display_on_products": data.display_on_products,
            "verification_status": VerificationStatus.PENDING.value,
        }

        result = (
            self.supabase.table("producer_certifications")
            .insert(insert_data)
            .execute()
        )
        certification = result.data[0]

        # Log the submission
        await self._log_verification_action(
            certification_id=certification["id"],
            action="submitted",
            previous_status=None,
            new_status=VerificationStatus.PENDING.value,
            performed_by=user_id,
        )

        # Schedule expiry alerts if expiry date is set
        if data.expiry_date:
            await self._schedule_expiry_alerts(
                certification_id=certification["id"],
                organization_id=organization_id,
                expiry_date=data.expiry_date,
            )

        return await self.get_certification(certification["id"])

    async def get_certification(
        self, certification_id: str
    ) -> Optional[ProducerCertification]:
        """Get a certification by ID with type info."""
        result = (
            self.supabase.table("producer_certifications")
            .select("*, certification_types(*)")
            .eq("id", certification_id)
            .single()
            .execute()
        )

        if not result.data:
            return None

        return self._map_certification(result.data)

    async def list_organization_certifications(
        self,
        organization_id: str,
        include_expired: bool = True,
        status_filter: Optional[list[VerificationStatus]] = None,
    ) -> list[ProducerCertification]:
        """List all certifications for an organization."""
        query = (
            self.supabase.table("producer_certifications")
            .select("*, certification_types(*)")
            .eq("organization_id", organization_id)
        )

        if not include_expired:
            query = query.neq("verification_status", VerificationStatus.EXPIRED.value)

        if status_filter:
            query = query.in_(
                "verification_status", [s.value for s in status_filter]
            )

        query = query.order("created_at", desc=True)
        result = query.execute()

        return [self._map_certification(row) for row in result.data]

    async def update_certification(
        self,
        certification_id: str,
        data: ProducerCertificationUpdate,
        user_id: str,
    ) -> ProducerCertification:
        """Update a certification."""
        update_data = {}

        if data.certificate_number is not None:
            update_data["certificate_number"] = data.certificate_number
        if data.issued_by is not None:
            update_data["issued_by"] = data.issued_by
        if data.issued_date is not None:
            update_data["issued_date"] = data.issued_date.isoformat()
        if data.expiry_date is not None:
            update_data["expiry_date"] = data.expiry_date.isoformat()
        if data.scope_description is not None:
            update_data["scope_description"] = data.scope_description
        if data.product_ids is not None:
            update_data["product_ids"] = data.product_ids
        if data.is_public is not None:
            update_data["is_public"] = data.is_public
        if data.display_on_products is not None:
            update_data["display_on_products"] = data.display_on_products

        update_data["updated_at"] = datetime.utcnow().isoformat()

        self.supabase.table("producer_certifications").update(update_data).eq(
            "id", certification_id
        ).execute()

        return await self.get_certification(certification_id)

    async def delete_certification(
        self, certification_id: str, user_id: str
    ) -> bool:
        """Delete a certification."""
        self.supabase.table("producer_certifications").delete().eq(
            "id", certification_id
        ).execute()
        return True

    # =========================================================================
    # Document Management
    # =========================================================================

    async def upload_document(
        self,
        certification_id: str,
        file_content: bytes,
        file_name: str,
        content_type: str,
        user_id: str,
    ) -> str:
        """Upload a certification document to storage."""
        # Generate storage path
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        storage_path = f"certifications/{certification_id}/{timestamp}_{file_name}"

        # Upload to Supabase Storage
        self.supabase.storage.from_("documents").upload(
            storage_path, file_content, {"content-type": content_type}
        )

        # Get public URL
        document_url = self.supabase.storage.from_("documents").get_public_url(
            storage_path
        )

        # Update certification record
        self.supabase.table("producer_certifications").update(
            {
                "document_url": document_url,
                "document_original_name": file_name,
                "document_uploaded_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", certification_id).execute()

        return document_url

    async def verify_document_ocr(
        self, document_url: str
    ) -> DocumentVerificationResult:
        """
        Verify document using OCR and extract data.

        This is a placeholder for integration with document verification services.
        In production, this would integrate with:
        - Google Document AI
        - AWS Textract
        - Custom OCR models
        """
        # Placeholder - would integrate with actual OCR service
        return DocumentVerificationResult(
            is_valid=True,
            confidence_score=0.0,
            extracted_data={},
            warnings=["OCR verification not yet implemented"],
            errors=[],
        )

    # =========================================================================
    # Verification System
    # =========================================================================

    async def verify_with_external_api(
        self,
        certification_id: str,
        certificate_number: str,
        cert_type_code: str,
    ) -> VerifyExternalResponse:
        """
        Verify certification with external API.

        Supports:
        - Rosstandart (GOST certificates)
        - Roskachestvo (quality marks)
        - Rosaccreditation (declarations)

        This is a placeholder - actual implementation would call real APIs.
        """
        # Get API endpoint based on cert type
        api_endpoints = {
            "gost_r": "https://api.rosstandart.ru/verify",  # Placeholder
            "gost_iso": "https://api.rosstandart.ru/verify",
            "roskachestvo": "https://api.roskachestvo.gov.ru/verify",
            "declaration_conformity": "https://pub.fsa.gov.ru/api/verify",
        }

        endpoint = api_endpoints.get(cert_type_code)
        if not endpoint:
            return VerifyExternalResponse(
                is_verified=False,
                verification_source="none",
                verification_date=datetime.utcnow(),
                details={"error": "No external API available for this certification type"},
            )

        # Placeholder for actual API call
        # In production: async with httpx.AsyncClient() as client: ...

        return VerifyExternalResponse(
            is_verified=False,
            verification_source=f"{cert_type_code}_api",
            verification_date=datetime.utcnow(),
            details={"message": "External verification API integration pending"},
        )

    async def manually_verify(
        self,
        certification_id: str,
        action: str,  # 'verify', 'reject', 'revoke'
        notes: Optional[str],
        admin_user_id: str,
    ) -> ProducerCertification:
        """Manually verify, reject, or revoke a certification."""
        # Get current status
        current = await self.get_certification(certification_id)
        if not current:
            raise ValueError("Certification not found")

        # Determine new status
        status_map = {
            "verify": VerificationStatus.VERIFIED,
            "reject": VerificationStatus.REJECTED,
            "revoke": VerificationStatus.REVOKED,
        }
        new_status = status_map.get(action)
        if not new_status:
            raise ValueError(f"Invalid action: {action}")

        # Update certification
        update_data = {
            "verification_status": new_status.value,
            "verification_notes": notes,
            "verified_by": admin_user_id,
            "verified_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        self.supabase.table("producer_certifications").update(update_data).eq(
            "id", certification_id
        ).execute()

        # Log the action
        await self._log_verification_action(
            certification_id=certification_id,
            action=f"manual_{action}d",
            previous_status=current.verification_status.value,
            new_status=new_status.value,
            notes=notes,
            performed_by=admin_user_id,
        )

        return await self.get_certification(certification_id)

    async def get_verification_log(
        self, certification_id: str
    ) -> list[VerificationLogEntry]:
        """Get verification history for a certification."""
        result = (
            self.supabase.table("certification_verification_log")
            .select("*")
            .eq("certification_id", certification_id)
            .order("performed_at", desc=True)
            .execute()
        )

        return [VerificationLogEntry(**row) for row in result.data]

    async def _log_verification_action(
        self,
        certification_id: str,
        action: str,
        previous_status: Optional[str],
        new_status: str,
        notes: Optional[str] = None,
        performed_by: Optional[str] = None,
    ):
        """Log a verification action."""
        self.supabase.table("certification_verification_log").insert(
            {
                "certification_id": certification_id,
                "action": action,
                "previous_status": previous_status,
                "new_status": new_status,
                "notes": notes,
                "performed_by": performed_by,
            }
        ).execute()

    # =========================================================================
    # Expiry Tracking & Alerts
    # =========================================================================

    async def check_expiring_certifications(
        self, days_ahead: int = 30
    ) -> list[ProducerCertification]:
        """Get certifications expiring within N days."""
        cutoff_date = (date.today() + timedelta(days=days_ahead)).isoformat()

        result = (
            self.supabase.table("producer_certifications")
            .select("*, certification_types(*)")
            .lte("expiry_date", cutoff_date)
            .gte("expiry_date", date.today().isoformat())
            .in_("verification_status", ["verified", "auto_verified"])
            .order("expiry_date")
            .execute()
        )

        return [self._map_certification(row) for row in result.data]

    async def get_pending_expiry_alerts(
        self, organization_id: Optional[str] = None
    ) -> list[ExpiryAlert]:
        """Get pending expiry alerts."""
        query = (
            self.supabase.table("certification_expiry_alerts")
            .select("*, producer_certifications!inner(*, certification_types(*))")
            .is_("sent_at", "null")
            .lte("scheduled_at", datetime.utcnow().isoformat())
        )

        if organization_id:
            query = query.eq("organization_id", organization_id)

        query = query.order("scheduled_at")
        result = query.execute()

        alerts = []
        for row in result.data:
            cert = row.get("producer_certifications", {})
            cert_type = cert.get("certification_types", {})
            alerts.append(
                ExpiryAlert(
                    id=row["id"],
                    certification_id=row["certification_id"],
                    organization_id=row["organization_id"],
                    certification_type_name=cert_type.get("name_ru", ""),
                    certificate_number=cert.get("certificate_number"),
                    expiry_date=cert.get("expiry_date"),
                    alert_days_before=row["alert_days_before"],
                    scheduled_at=row["scheduled_at"],
                    sent_at=row.get("sent_at"),
                    acknowledged_at=row.get("acknowledged_at"),
                )
            )

        return alerts

    async def mark_alert_sent(self, alert_id: str):
        """Mark an expiry alert as sent."""
        self.supabase.table("certification_expiry_alerts").update(
            {"sent_at": datetime.utcnow().isoformat()}
        ).eq("id", alert_id).execute()

    async def acknowledge_alert(self, alert_id: str, user_id: str):
        """Acknowledge an expiry alert."""
        self.supabase.table("certification_expiry_alerts").update(
            {"acknowledged_at": datetime.utcnow().isoformat()}
        ).eq("id", alert_id).execute()

    async def _schedule_expiry_alerts(
        self,
        certification_id: str,
        organization_id: str,
        expiry_date: date,
    ):
        """Schedule expiry alerts for a certification."""
        alert_days = [90, 60, 30, 14, 7, 1]

        for days in alert_days:
            scheduled_at = expiry_date - timedelta(days=days)
            if scheduled_at > date.today():
                self.supabase.table("certification_expiry_alerts").insert(
                    {
                        "certification_id": certification_id,
                        "organization_id": organization_id,
                        "alert_days_before": days,
                        "alert_type": "both",
                        "scheduled_at": datetime.combine(
                            scheduled_at, datetime.min.time()
                        ).isoformat(),
                    }
                ).execute()

    # =========================================================================
    # Consumer Verification Portal
    # =========================================================================

    async def get_public_certifications(
        self, organization_id: str
    ) -> list[ProducerCertificationPublic]:
        """Get public certifications for consumer view."""
        result = (
            self.supabase.table("producer_certifications")
            .select("*, certification_types(*)")
            .eq("organization_id", organization_id)
            .eq("is_public", True)
            .in_("verification_status", ["verified", "auto_verified"])
            .execute()
        )

        return [self._map_certification_public(row) for row in result.data]

    async def get_product_certifications(
        self, product_id: str
    ) -> list[ProducerCertificationPublic]:
        """Get certifications for a specific product."""
        # First get explicit product-certification mappings
        mappings = (
            self.supabase.table("product_certifications")
            .select("certification_id")
            .eq("product_id", product_id)
            .execute()
        )
        cert_ids = [m["certification_id"] for m in mappings.data]

        # Get the product's organization
        product = (
            self.supabase.table("products")
            .select("organization_id")
            .eq("id", product_id)
            .single()
            .execute()
        )

        if not product.data:
            return []

        org_id = product.data["organization_id"]

        # Get all verified org certifications that apply to products
        result = (
            self.supabase.table("producer_certifications")
            .select("*, certification_types(*)")
            .eq("organization_id", org_id)
            .eq("is_public", True)
            .eq("display_on_products", True)
            .in_("verification_status", ["verified", "auto_verified"])
            .execute()
        )

        # Filter to those that either:
        # 1. Are in the explicit mapping
        # 2. Have no product_ids (apply to all products)
        # 3. Include this product in product_ids
        certifications = []
        for row in result.data:
            cert_id = row["id"]
            product_ids = row.get("product_ids") or []

            if (
                cert_id in cert_ids
                or len(product_ids) == 0
                or product_id in product_ids
            ):
                certifications.append(self._map_certification_public(row))

        return certifications

    async def search_by_certification(
        self,
        filters: CertificationSearchFilters,
        page: int = 1,
        page_size: int = 20,
    ) -> CertificationSearchResponse:
        """Search products by certification type."""
        # Build query for products with certifications
        query = self.supabase.rpc(
            "search_products_by_certification",
            {
                "cert_types": filters.certification_types,
                "categories": [c.value for c in filters.categories]
                if filters.categories
                else None,
                "verified_only": filters.verified_only,
                "include_expired": filters.include_expired,
                "page_num": page,
                "page_size": page_size,
            },
        )

        # Note: This would require a custom Postgres function
        # Placeholder implementation
        return CertificationSearchResponse(
            results=[],
            total=0,
            page=page,
            page_size=page_size,
            has_more=False,
        )

    async def submit_verification_request(
        self,
        certification_id: str,
        request_type: str,
        reason: Optional[str],
        user_id: Optional[str],
        ip_address: Optional[str],
    ) -> str:
        """Submit a consumer verification request."""
        result = (
            self.supabase.table("certification_verification_requests")
            .insert(
                {
                    "certification_id": certification_id,
                    "requester_user_id": user_id,
                    "requester_ip": ip_address,
                    "requester_reason": reason,
                    "request_type": request_type,
                    "status": "open",
                }
            )
            .execute()
        )

        return result.data[0]["id"]

    # =========================================================================
    # Organization Summary
    # =========================================================================

    async def get_organization_summary(
        self, organization_id: str
    ) -> OrganizationCertificationSummary:
        """Get certification summary for an organization."""
        certifications = await self.list_organization_certifications(
            organization_id, include_expired=True
        )

        today = date.today()
        thirty_days = today + timedelta(days=30)

        verified_count = sum(
            1
            for c in certifications
            if c.verification_status in [VerificationStatus.VERIFIED, VerificationStatus.AUTO_VERIFIED]
        )
        pending_count = sum(
            1 for c in certifications if c.verification_status == VerificationStatus.PENDING
        )
        expired_count = sum(
            1 for c in certifications if c.verification_status == VerificationStatus.EXPIRED
        )

        # Count expiring soon
        expiring_soon = 0
        for c in certifications:
            if c.expiry_date and c.verification_status in [
                VerificationStatus.VERIFIED,
                VerificationStatus.AUTO_VERIFIED,
            ]:
                expiry = date.fromisoformat(c.expiry_date) if isinstance(c.expiry_date, str) else c.expiry_date
                if today <= expiry <= thirty_days:
                    expiring_soon += 1

        # Count by category
        by_category: dict[str, int] = {}
        for c in certifications:
            if c.certification_type:
                cat = c.certification_type.category
                by_category[cat] = by_category.get(cat, 0) + 1

        # Get public certifications
        public_certs = [
            self._to_public(c)
            for c in certifications
            if c.is_public
            and c.verification_status in [VerificationStatus.VERIFIED, VerificationStatus.AUTO_VERIFIED]
        ]

        return OrganizationCertificationSummary(
            organization_id=organization_id,
            total_certifications=len(certifications),
            verified_count=verified_count,
            pending_count=pending_count,
            expiring_soon_count=expiring_soon,
            expired_count=expired_count,
            certifications_by_category=by_category,
            certifications=public_certs,
        )

    # =========================================================================
    # Admin Dashboard
    # =========================================================================

    async def get_admin_stats(self) -> CertificationAdminStats:
        """Get admin dashboard statistics."""
        today = date.today()
        week_ahead = today + timedelta(days=7)

        # Get all certifications
        all_certs = (
            self.supabase.table("producer_certifications")
            .select("*, certification_types(*)")
            .execute()
        )

        certifications = [self._map_certification(row) for row in all_certs.data]

        # Calculate stats
        by_status: dict[str, int] = {}
        by_category: dict[str, int] = {}
        pending = 0
        verified_today = 0
        expiring_this_week = 0

        for c in certifications:
            # By status
            status = c.verification_status.value
            by_status[status] = by_status.get(status, 0) + 1

            if c.verification_status == VerificationStatus.PENDING:
                pending += 1

            # Check if verified today
            if c.verified_at:
                verified_date = (
                    datetime.fromisoformat(c.verified_at).date()
                    if isinstance(c.verified_at, str)
                    else c.verified_at.date()
                )
                if verified_date == today:
                    verified_today += 1

            # Check expiring this week
            if c.expiry_date and c.verification_status in [
                VerificationStatus.VERIFIED,
                VerificationStatus.AUTO_VERIFIED,
            ]:
                expiry = (
                    date.fromisoformat(c.expiry_date)
                    if isinstance(c.expiry_date, str)
                    else c.expiry_date
                )
                if today <= expiry <= week_ahead:
                    expiring_this_week += 1

            # By category
            if c.certification_type:
                cat = c.certification_type.category
                by_category[cat] = by_category.get(cat, 0) + 1

        # Get open disputes
        disputes = (
            self.supabase.table("certification_verification_requests")
            .select("id", count="exact")
            .eq("request_type", "dispute")
            .eq("status", "open")
            .execute()
        )
        open_disputes = disputes.count or 0

        # Recent submissions (last 10)
        recent = sorted(
            [c for c in certifications if c.verification_status == VerificationStatus.PENDING],
            key=lambda x: x.created_at,
            reverse=True,
        )[:10]

        return CertificationAdminStats(
            total_certifications=len(certifications),
            pending_verification=pending,
            verified_today=verified_today,
            expiring_this_week=expiring_this_week,
            open_disputes=open_disputes,
            by_status=by_status,
            by_category=by_category,
            recent_submissions=recent,
        )

    async def get_pending_verification_queue(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[PendingVerificationItem], int]:
        """Get queue of certifications pending verification."""
        offset = (page - 1) * page_size

        result = (
            self.supabase.table("producer_certifications")
            .select(
                "*, certification_types(*), organizations!inner(name)",
                count="exact",
            )
            .eq("verification_status", VerificationStatus.PENDING.value)
            .order("created_at")
            .range(offset, offset + page_size - 1)
            .execute()
        )

        items = []
        for row in result.data:
            cert = self._map_certification(row)
            org_name = row.get("organizations", {}).get("name", "Unknown")
            created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            days_pending = (datetime.utcnow() - created.replace(tzinfo=None)).days

            items.append(
                PendingVerificationItem(
                    certification=cert,
                    organization_name=org_name,
                    submitted_at=row["created_at"],
                    days_pending=days_pending,
                    document_available=bool(row.get("document_url")),
                )
            )

        return items, result.count or 0

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _map_certification(self, row: dict) -> ProducerCertification:
        """Map database row to ProducerCertification model."""
        cert_type_data = row.get("certification_types")
        cert_type = None
        if cert_type_data:
            cert_type = CertificationTypePublic(
                id=cert_type_data["id"],
                code=cert_type_data["code"],
                name_ru=cert_type_data["name_ru"],
                name_en=cert_type_data["name_en"],
                category=cert_type_data["category"],
                logo_url=cert_type_data.get("logo_url"),
                badge_color=cert_type_data.get("badge_color", "#4F46E5"),
            )

        # Calculate validity
        status = VerificationStatus(row["verification_status"])
        is_valid = status in [VerificationStatus.VERIFIED, VerificationStatus.AUTO_VERIFIED]

        expiry_date = row.get("expiry_date")
        days_until_expiry = None
        if expiry_date:
            expiry = (
                date.fromisoformat(expiry_date)
                if isinstance(expiry_date, str)
                else expiry_date
            )
            days_until_expiry = (expiry - date.today()).days
            if days_until_expiry < 0:
                is_valid = False

        return ProducerCertification(
            id=row["id"],
            organization_id=row["organization_id"],
            certification_type_id=row["certification_type_id"],
            certification_type=cert_type,
            certificate_number=row.get("certificate_number"),
            issued_by=row.get("issued_by"),
            issued_date=row.get("issued_date"),
            expiry_date=expiry_date,
            scope_description=row.get("scope_description"),
            product_ids=row.get("product_ids"),
            document_url=row.get("document_url"),
            document_original_name=row.get("document_original_name"),
            document_uploaded_at=row.get("document_uploaded_at"),
            verification_status=status,
            verification_notes=row.get("verification_notes"),
            verified_at=row.get("verified_at"),
            is_public=row.get("is_public", True),
            display_on_products=row.get("display_on_products", True),
            is_valid=is_valid,
            days_until_expiry=days_until_expiry,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _map_certification_public(self, row: dict) -> ProducerCertificationPublic:
        """Map database row to public certification view."""
        cert_type_data = row.get("certification_types", {})
        cert_type = CertificationTypePublic(
            id=cert_type_data.get("id", ""),
            code=cert_type_data.get("code", ""),
            name_ru=cert_type_data.get("name_ru", ""),
            name_en=cert_type_data.get("name_en", ""),
            category=cert_type_data.get("category", "other"),
            logo_url=cert_type_data.get("logo_url"),
            badge_color=cert_type_data.get("badge_color", "#4F46E5"),
        )

        status = VerificationStatus(row["verification_status"])
        is_valid = status in [VerificationStatus.VERIFIED, VerificationStatus.AUTO_VERIFIED]

        if row.get("expiry_date"):
            expiry = date.fromisoformat(row["expiry_date"])
            if expiry < date.today():
                is_valid = False

        return ProducerCertificationPublic(
            id=row["id"],
            certification_type=cert_type,
            certificate_number=row.get("certificate_number"),
            issued_by=row.get("issued_by"),
            issued_date=row.get("issued_date"),
            expiry_date=row.get("expiry_date"),
            scope_description=row.get("scope_description"),
            verification_status=status,
            is_valid=is_valid,
        )

    def _to_public(self, cert: ProducerCertification) -> ProducerCertificationPublic:
        """Convert full certification to public view."""
        return ProducerCertificationPublic(
            id=cert.id,
            certification_type=cert.certification_type,
            certificate_number=cert.certificate_number,
            issued_by=cert.issued_by,
            issued_date=cert.issued_date,
            expiry_date=cert.expiry_date,
            scope_description=cert.scope_description,
            verification_status=cert.verification_status,
            is_valid=cert.is_valid,
        )


# Singleton instance
_certification_service: Optional[CertificationService] = None


def get_certification_service() -> CertificationService:
    """Get certification service singleton."""
    global _certification_service
    if _certification_service is None:
        _certification_service = CertificationService()
    return _certification_service
