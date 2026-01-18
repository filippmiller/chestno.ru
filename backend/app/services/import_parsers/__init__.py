"""
Import parsers for various product data sources.
Supports: Wildberries, Ozon, 1C, Generic CSV/XLSX
"""

from .base import BaseImportParser
from .generic import GenericCSVParser, GenericXLSXParser
from .wildberries import WildberriesParser
from .ozon import OzonParser
from .one_c import OneCParser


def get_parser(source_type: str) -> BaseImportParser:
    """Factory function to get the appropriate parser for a source type."""
    parsers = {
        'wildberries': WildberriesParser,
        'ozon': OzonParser,
        '1c': OneCParser,
        'generic_csv': GenericCSVParser,
        'generic_xlsx': GenericXLSXParser,
    }

    parser_class = parsers.get(source_type)
    if not parser_class:
        raise ValueError(f"Unknown source type: {source_type}")

    return parser_class()


__all__ = [
    'BaseImportParser',
    'GenericCSVParser',
    'GenericXLSXParser',
    'WildberriesParser',
    'OzonParser',
    'OneCParser',
    'get_parser',
]
