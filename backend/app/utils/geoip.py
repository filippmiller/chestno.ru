"""GeoIP lookup utility using MaxMind GeoLite2 database."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Lazy-loaded reader
_reader = None
_reader_initialized = False


@dataclass
class GeoLocation:
    """Geographic location data."""
    country: str | None = None
    city: str | None = None


def _get_reader():
    """Get or initialize the GeoIP reader."""
    global _reader, _reader_initialized

    if _reader_initialized:
        return _reader

    _reader_initialized = True
    settings = get_settings()

    if not settings.geoip_db_path:
        logger.info('GeoIP database path not configured, geo lookup disabled')
        return None

    try:
        import geoip2.database
        _reader = geoip2.database.Reader(settings.geoip_db_path)
        logger.info(f'GeoIP database loaded from {settings.geoip_db_path}')
    except FileNotFoundError:
        logger.warning(f'GeoIP database not found at {settings.geoip_db_path}')
    except Exception as e:
        logger.warning(f'Failed to load GeoIP database: {e}')

    return _reader


def lookup_ip(ip: str) -> GeoLocation:
    """
    Look up geographic location for an IP address.

    Returns GeoLocation with country and city (both may be None if lookup fails).
    """
    reader = _get_reader()
    if not reader:
        return GeoLocation()

    try:
        response = reader.city(ip)
        return GeoLocation(
            country=response.country.iso_code,
            city=response.city.name,
        )
    except Exception as e:
        # Common errors: AddressNotFoundError for private IPs, invalid IPs, etc.
        logger.debug(f'GeoIP lookup failed for {ip}: {e}')
        return GeoLocation()


def parse_utm_params(query_string: str | None) -> dict[str, str | None]:
    """
    Parse UTM parameters from a query string.

    Returns dict with utm_source, utm_medium, utm_campaign (all may be None).
    """
    result = {
        'utm_source': None,
        'utm_medium': None,
        'utm_campaign': None,
    }

    if not query_string:
        return result

    from urllib.parse import parse_qs

    try:
        params = parse_qs(query_string)
        result['utm_source'] = params.get('utm_source', [None])[0]
        result['utm_medium'] = params.get('utm_medium', [None])[0]
        result['utm_campaign'] = params.get('utm_campaign', [None])[0]
    except Exception as e:
        logger.debug(f'Failed to parse UTM params from query string: {e}')

    return result
