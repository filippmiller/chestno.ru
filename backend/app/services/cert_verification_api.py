"""
Automated Certification Verification API Integration Service.

Verifies GOST, ISO, and organic certificates against official registries:
- Росаккредитация (pub.fsa.gov.ru) for ГОСТ and Declarations
- IAF CertSearch (iafcertsearch.org) for ISO certifications
- Russian organic certification registries

Includes:
- Automated verification workflows
- Auto-expiry detection and alerting
- Rate limiting and retry logic
- Failure handling and fallbacks
- "Verified by Registry" badge system
"""

import asyncio
import hashlib
import logging
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Optional, Dict, Any, List
from xml.etree import ElementTree as ET

import httpx
from pydantic import BaseModel, Field

from ..core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration & Constants
# =============================================================================

class RegistryType(str, Enum):
    """Supported certification registries."""
    ROSACCREDITATION = "rosaccreditation"  # Росаккредитация (ГОСТ, Declarations)
    IAF_CERTSEARCH = "iaf_certsearch"      # IAF CertSearch (ISO)
    ORGANIC_RU = "organic_ru"              # Russian organic registry
    ROSKACHESTVO = "roskachestvo"          # Роскачество quality marks


class VerificationResult(str, Enum):
    """Verification outcome."""
    VERIFIED = "verified"
    NOT_FOUND = "not_found"
    EXPIRED = "expired"
    REVOKED = "revoked"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"


class BadgeLevel(str, Enum):
    """Verification badge level."""
    VERIFIED_BY_REGISTRY = "verified_by_registry"  # Confirmed with official registry
    MANUALLY_VERIFIED = "manually_verified"        # Admin-verified
    DOCUMENT_ONLY = "document_only"                # Document uploaded, not API-verified
    PENDING = "pending"                            # Awaiting verification


# API Configuration
REGISTRY_ENDPOINTS = {
    RegistryType.ROSACCREDITATION: {
        "base_url": "https://pub.fsa.gov.ru/rss/certificate",
        "rate_limit": 60,  # requests per minute
        "timeout": 30,
    },
    RegistryType.IAF_CERTSEARCH: {
        "base_url": "https://www.iafcertsearch.org/api",
        "rate_limit": 100,  # requests per minute
        "timeout": 30,
    },
    RegistryType.ROSKACHESTVO: {
        "base_url": "https://api.roskachestvo.gov.ru",  # Placeholder
        "rate_limit": 60,
        "timeout": 30,
    },
}

# Rate limiting window (in seconds)
RATE_LIMIT_WINDOW = 60

# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # exponential backoff: 2^retry seconds


# =============================================================================
# Data Models
# =============================================================================

class VerificationRequest(BaseModel):
    """Request to verify a certification."""
    certificate_number: str
    certification_type_code: str  # e.g., 'gost_r', 'iso_9001'
    organization_name: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None


class RegistryMatch(BaseModel):
    """Match found in registry."""
    registry_id: str  # Unique ID from registry
    certificate_number: str
    organization_name: str
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    status: str  # 'valid', 'expired', 'revoked'
    issuing_body: str
    scope: Optional[str] = None
    registry_url: Optional[str] = None
    verified_at: datetime = Field(default_factory=datetime.utcnow)
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)


class VerificationResponse(BaseModel):
    """Response from verification attempt."""
    result: VerificationResult
    registry_type: Optional[RegistryType] = None
    match: Optional[RegistryMatch] = None
    badge_level: BadgeLevel
    error_message: Optional[str] = None
    retry_after: Optional[int] = None  # seconds
    verification_id: str  # Unique ID for this verification
    checked_at: datetime = Field(default_factory=datetime.utcnow)


class ExpiryAlert(BaseModel):
    """Expiry alert for a certification."""
    certification_id: str
    organization_id: str
    certificate_number: str
    certification_type_name: str
    expiry_date: date
    days_until_expiry: int
    alert_sent: bool = False


# =============================================================================
# Rate Limiter
# =============================================================================

class RateLimiter:
    """Token bucket rate limiter with Redis-like in-memory storage."""

    def __init__(self):
        self._buckets: Dict[str, List[datetime]] = {}

    async def check_rate_limit(
        self,
        registry_type: RegistryType
    ) -> tuple[bool, Optional[int]]:
        """
        Check if request is within rate limit.

        Returns:
            (allowed, retry_after_seconds)
        """
        config = REGISTRY_ENDPOINTS.get(registry_type)
        if not config:
            return True, None

        limit = config["rate_limit"]
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)

        # Get or create bucket
        key = f"rate_limit:{registry_type.value}"
        if key not in self._buckets:
            self._buckets[key] = []

        # Remove expired timestamps
        self._buckets[key] = [
            ts for ts in self._buckets[key]
            if ts > window_start
        ]

        # Check limit
        if len(self._buckets[key]) >= limit:
            # Calculate when the oldest request expires
            oldest = min(self._buckets[key])
            retry_after = int((oldest + timedelta(seconds=RATE_LIMIT_WINDOW) - now).total_seconds())
            return False, retry_after

        # Add current timestamp
        self._buckets[key].append(now)
        return True, None


# =============================================================================
# Registry Adapters
# =============================================================================

class RosaccreditationAdapter:
    """
    Adapter for Росаккредитация (Federal Accreditation Service).

    Uses RSS feed parser from pub.fsa.gov.ru/rss/certificate
    Supports GOST and Declaration of Conformity verification.
    """

    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.base_url = REGISTRY_ENDPOINTS[RegistryType.ROSACCREDITATION]["base_url"]

    async def verify(self, request: VerificationRequest) -> Optional[RegistryMatch]:
        """Verify certificate with Rosaccreditation RSS feed."""
        try:
            # Build search URL
            # Format: pub.fsa.gov.ru/rss/certificate?number=xxxxxx
            params = {"number": request.certificate_number}

            response = await self.client.get(
                self.base_url,
                params=params,
                timeout=REGISTRY_ENDPOINTS[RegistryType.ROSACCREDITATION]["timeout"],
            )
            response.raise_for_status()

            # Parse RSS/XML response
            root = ET.fromstring(response.content)

            # Find matching certificate entry
            # RSS format: <channel><item><title>...</title><description>...</description></item></channel>
            items = root.findall(".//item")

            if not items:
                return None

            # Parse first matching item
            item = items[0]
            title = item.findtext("title", "")
            description = item.findtext("description", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")

            # Extract data from description (contains certificate details)
            org_name = self._extract_field(description, "Заявитель") or ""
            issued_by = self._extract_field(description, "Орган по сертификации") or "Росаккредитация"
            validity = self._extract_field(description, "Срок действия") or ""
            status = self._extract_field(description, "Статус") or "valid"

            # Parse expiry date from validity field
            expiry_date = self._parse_expiry_date(validity)

            # Determine status
            cert_status = "valid"
            if expiry_date and expiry_date < date.today():
                cert_status = "expired"
            if "отозван" in description.lower() or "revoked" in status.lower():
                cert_status = "revoked"

            return RegistryMatch(
                registry_id=hashlib.sha256(link.encode()).hexdigest()[:16],
                certificate_number=request.certificate_number,
                organization_name=org_name,
                issued_date=None,  # Not always available in RSS
                expiry_date=expiry_date,
                status=cert_status,
                issuing_body=issued_by,
                scope=self._extract_field(description, "Продукция"),
                registry_url=link,
                confidence_score=0.95,  # High confidence from official registry
            )

        except httpx.HTTPError as e:
            logger.error(f"Rosaccreditation API error: {e}")
            return None
        except ET.ParseError as e:
            logger.error(f"Failed to parse Rosaccreditation XML: {e}")
            return None

    def _extract_field(self, description: str, field_name: str) -> Optional[str]:
        """Extract field value from RSS description."""
        # Simple field extraction from format: "Field: Value<br/>"
        lines = description.split("<br/>")
        for line in lines:
            if field_name in line:
                parts = line.split(":", 1)
                if len(parts) == 2:
                    return parts[1].strip()
        return None

    def _parse_expiry_date(self, validity_str: str) -> Optional[date]:
        """Parse expiry date from validity string."""
        # Format examples: "до 31.12.2025", "31.12.2025"
        try:
            validity_str = validity_str.replace("до", "").strip()
            return datetime.strptime(validity_str, "%d.%m.%Y").date()
        except (ValueError, AttributeError):
            return None


class IAFCertSearchAdapter:
    """
    Adapter for IAF CertSearch (International Accreditation Forum).

    Verifies ISO certifications (ISO 9001, ISO 22000, etc.)
    Uses API at iafcertsearch.org
    """

    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.base_url = REGISTRY_ENDPOINTS[RegistryType.IAF_CERTSEARCH]["base_url"]

    async def verify(self, request: VerificationRequest) -> Optional[RegistryMatch]:
        """
        Verify ISO certificate with IAF CertSearch.

        Note: This is a placeholder implementation.
        Actual API requires authentication and specific endpoints.
        Reference: https://support.iafcertsearch.org/api-developer-guide/
        """
        try:
            # Example API call structure (requires actual API key and endpoint)
            # POST /api/v1/search with JSON body
            payload = {
                "certificateNumber": request.certificate_number,
                "organizationName": request.organization_name,
            }

            # Placeholder: Would need actual API endpoint and authentication
            logger.warning(
                "IAF CertSearch API integration not fully implemented. "
                "Requires API key from iafcertsearch.org"
            )
            return None

            # Actual implementation would look like:
            # response = await self.client.post(
            #     f"{self.base_url}/search",
            #     json=payload,
            #     headers={"Authorization": f"Bearer {API_KEY}"},
            #     timeout=REGISTRY_ENDPOINTS[RegistryType.IAF_CERTSEARCH]["timeout"],
            # )
            # response.raise_for_status()
            # data = response.json()
            # return self._parse_iaf_response(data)

        except httpx.HTTPError as e:
            logger.error(f"IAF CertSearch API error: {e}")
            return None


class OrganicRussiaAdapter:
    """
    Adapter for Russian organic certification registry.

    Verifies ГОСТ 33980-2016 organic certifications.
    Uses registry from Ministry of Agriculture.
    """

    async def verify(self, request: VerificationRequest) -> Optional[RegistryMatch]:
        """
        Verify organic certificate with Russian registry.

        Note: Official API not publicly documented.
        Requires direct contact with Ministry of Agriculture for access.
        """
        logger.warning(
            "Russian organic certification API not publicly available. "
            "Manual verification required."
        )
        return None


# =============================================================================
# Main Verification Service
# =============================================================================

class CertificationVerificationService:
    """Main service for automated certificate verification."""

    def __init__(self):
        self.supabase = get_supabase_client()
        self.rate_limiter = RateLimiter()
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        """Async context manager entry."""
        self._client = httpx.AsyncClient(
            headers={"User-Agent": "chestno.ru/1.0 CertificationBot"}
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()

    async def verify_certificate(
        self,
        certification_id: str,
        request: VerificationRequest,
    ) -> VerificationResponse:
        """
        Verify a certificate against appropriate registry.

        Workflow:
        1. Determine registry type from certification_type_code
        2. Check rate limits
        3. Query registry API
        4. Parse response
        5. Update database
        6. Return verification result
        """
        # Generate unique verification ID
        verification_id = hashlib.sha256(
            f"{certification_id}:{datetime.utcnow().isoformat()}".encode()
        ).hexdigest()[:16]

        try:
            # Determine which registry to use
            registry_type = self._get_registry_type(request.certification_type_code)
            if not registry_type:
                return VerificationResponse(
                    result=VerificationResult.ERROR,
                    badge_level=BadgeLevel.DOCUMENT_ONLY,
                    error_message=f"No registry available for {request.certification_type_code}",
                    verification_id=verification_id,
                )

            # Check rate limit
            allowed, retry_after = await self.rate_limiter.check_rate_limit(registry_type)
            if not allowed:
                logger.warning(f"Rate limit exceeded for {registry_type}. Retry after {retry_after}s")
                return VerificationResponse(
                    result=VerificationResult.RATE_LIMITED,
                    registry_type=registry_type,
                    badge_level=BadgeLevel.DOCUMENT_ONLY,
                    retry_after=retry_after,
                    verification_id=verification_id,
                )

            # Perform verification with retries
            match = await self._verify_with_retry(registry_type, request)

            if match:
                # Success: Certificate found in registry
                result = VerificationResult.VERIFIED
                if match.status == "expired":
                    result = VerificationResult.EXPIRED
                elif match.status == "revoked":
                    result = VerificationResult.REVOKED

                badge_level = BadgeLevel.VERIFIED_BY_REGISTRY

                # Update database with verification result
                await self._update_certification_verification(
                    certification_id=certification_id,
                    registry_match=match,
                    verification_id=verification_id,
                )

                return VerificationResponse(
                    result=result,
                    registry_type=registry_type,
                    match=match,
                    badge_level=badge_level,
                    verification_id=verification_id,
                )

            else:
                # Not found in registry
                return VerificationResponse(
                    result=VerificationResult.NOT_FOUND,
                    registry_type=registry_type,
                    badge_level=BadgeLevel.DOCUMENT_ONLY,
                    error_message="Certificate not found in registry",
                    verification_id=verification_id,
                )

        except Exception as e:
            logger.exception(f"Verification failed for {certification_id}: {e}")
            return VerificationResponse(
                result=VerificationResult.ERROR,
                badge_level=BadgeLevel.DOCUMENT_ONLY,
                error_message=str(e),
                verification_id=verification_id,
            )

    async def _verify_with_retry(
        self,
        registry_type: RegistryType,
        request: VerificationRequest,
    ) -> Optional[RegistryMatch]:
        """Verify with exponential backoff retry."""
        adapter = self._get_adapter(registry_type)
        if not adapter:
            return None

        for attempt in range(MAX_RETRIES):
            try:
                match = await adapter.verify(request)
                if match:
                    return match
                # Not found, don't retry
                return None

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:  # Rate limited
                    # Don't retry rate limits (handled by rate limiter)
                    raise
                if e.response.status_code >= 500:  # Server error
                    if attempt < MAX_RETRIES - 1:
                        backoff = RETRY_BACKOFF_BASE ** attempt
                        logger.warning(f"Retry {attempt + 1}/{MAX_RETRIES} after {backoff}s")
                        await asyncio.sleep(backoff)
                        continue
                raise

            except (httpx.ConnectError, httpx.TimeoutException) as e:
                if attempt < MAX_RETRIES - 1:
                    backoff = RETRY_BACKOFF_BASE ** attempt
                    logger.warning(f"Network error, retry {attempt + 1}/{MAX_RETRIES} after {backoff}s")
                    await asyncio.sleep(backoff)
                    continue
                raise

        return None

    def _get_registry_type(self, cert_type_code: str) -> Optional[RegistryType]:
        """Map certification type to registry."""
        mapping = {
            # Rosaccreditation
            "gost_r": RegistryType.ROSACCREDITATION,
            "gost_iso": RegistryType.ROSACCREDITATION,
            "declaration_conformity": RegistryType.ROSACCREDITATION,

            # IAF CertSearch
            "iso_9001": RegistryType.IAF_CERTSEARCH,
            "iso_22000": RegistryType.IAF_CERTSEARCH,

            # Roskachestvo
            "roskachestvo": RegistryType.ROSKACHESTVO,

            # Organic
            "organic_ru": RegistryType.ORGANIC_RU,
        }
        return mapping.get(cert_type_code)

    def _get_adapter(self, registry_type: RegistryType):
        """Get adapter instance for registry type."""
        if not self._client:
            return None

        adapters = {
            RegistryType.ROSACCREDITATION: RosaccreditationAdapter(self._client),
            RegistryType.IAF_CERTSEARCH: IAFCertSearchAdapter(self._client),
            RegistryType.ORGANIC_RU: OrganicRussiaAdapter(),
        }
        return adapters.get(registry_type)

    async def _update_certification_verification(
        self,
        certification_id: str,
        registry_match: RegistryMatch,
        verification_id: str,
    ):
        """Update certification record with verification result."""
        update_data = {
            "verification_status": "auto_verified",
            "external_verification_id": registry_match.registry_id,
            "last_auto_check_at": datetime.utcnow().isoformat(),
            "verified_at": registry_match.verified_at.isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        # If registry provided expiry date, update it
        if registry_match.expiry_date:
            update_data["expiry_date"] = registry_match.expiry_date.isoformat()

        self.supabase.table("producer_certifications").update(update_data).eq(
            "id", certification_id
        ).execute()

        # Log verification
        self.supabase.table("certification_verification_log").insert({
            "certification_id": certification_id,
            "action": "auto_check_passed",
            "previous_status": "pending",
            "new_status": "auto_verified",
            "notes": f"Verified via registry. ID: {verification_id}",
        }).execute()

    # =========================================================================
    # Auto-Expiry Detection
    # =========================================================================

    async def check_and_update_expired_certifications(self) -> int:
        """
        Check for expired certifications and update their status.

        Run this periodically (e.g., daily cron job).

        Returns:
            Number of certifications marked as expired.
        """
        today = date.today().isoformat()

        # Find verified certifications past expiry
        result = (
            self.supabase.table("producer_certifications")
            .select("id, organization_id, certificate_number")
            .lt("expiry_date", today)
            .in_("verification_status", ["verified", "auto_verified"])
            .execute()
        )

        expired_count = 0
        for cert in result.data:
            # Update status to expired
            self.supabase.table("producer_certifications").update({
                "verification_status": "expired",
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", cert["id"]).execute()

            # Log expiry
            self.supabase.table("certification_verification_log").insert({
                "certification_id": cert["id"],
                "action": "expired",
                "previous_status": "verified",
                "new_status": "expired",
                "notes": "Automatically marked as expired based on expiry_date",
            }).execute()

            expired_count += 1
            logger.info(f"Marked certification {cert['id']} as expired")

        return expired_count

    async def get_expiring_certifications(
        self,
        days_ahead: int = 30
    ) -> List[ExpiryAlert]:
        """
        Get certifications expiring within N days.

        Used for proactive alerts to producers.
        """
        today = date.today()
        cutoff = (today + timedelta(days=days_ahead)).isoformat()

        result = (
            self.supabase.table("producer_certifications")
            .select("id, organization_id, certificate_number, expiry_date, certification_types(name_ru)")
            .gte("expiry_date", today.isoformat())
            .lte("expiry_date", cutoff)
            .in_("verification_status", ["verified", "auto_verified"])
            .execute()
        )

        alerts = []
        for cert in result.data:
            expiry_date = date.fromisoformat(cert["expiry_date"])
            days_until = (expiry_date - today).days

            cert_type = cert.get("certification_types", {})
            alerts.append(ExpiryAlert(
                certification_id=cert["id"],
                organization_id=cert["organization_id"],
                certificate_number=cert["certificate_number"],
                certification_type_name=cert_type.get("name_ru", ""),
                expiry_date=expiry_date,
                days_until_expiry=days_until,
            ))

        return alerts


# =============================================================================
# Singleton Instance
# =============================================================================

_verification_service: Optional[CertificationVerificationService] = None


def get_verification_service() -> CertificationVerificationService:
    """Get singleton verification service instance."""
    global _verification_service
    if _verification_service is None:
        _verification_service = CertificationVerificationService()
    return _verification_service
