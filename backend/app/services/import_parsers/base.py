"""
Base parser interface for import sources.
"""

from abc import ABC, abstractmethod
from typing import Any, Iterator


class BaseImportParser(ABC):
    """Abstract base class for import file parsers."""

    # Human-readable name for the source
    source_name: str = "Unknown"

    # Supported file extensions
    supported_extensions: list[str] = []

    @abstractmethod
    def get_columns(self, file_path: str) -> list[str]:
        """
        Extract column names from the file.

        Args:
            file_path: Path to the import file

        Returns:
            List of column names found in the file
        """
        pass

    @abstractmethod
    def iter_rows(self, file_path: str) -> Iterator[dict[str, Any]]:
        """
        Iterate over data rows in the file.

        Args:
            file_path: Path to the import file

        Yields:
            Dictionary mapping column names to values for each row
        """
        pass

    @abstractmethod
    def get_suggested_mapping(self) -> dict[str, str]:
        """
        Get default column to field mapping suggestions.

        Returns:
            Dictionary mapping source column names to target product fields
        """
        pass

    def validate_file(self, file_path: str) -> tuple[bool, str | None]:
        """
        Validate that the file is readable and has the expected format.

        Args:
            file_path: Path to the import file

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            columns = self.get_columns(file_path)
            if not columns:
                return False, "Файл не содержит колонок"
            return True, None
        except Exception as e:
            return False, f"Ошибка чтения файла: {str(e)}"

    def get_sample_values(self, file_path: str, max_samples: int = 5) -> dict[str, list[Any]]:
        """
        Get sample values for each column.

        Args:
            file_path: Path to the import file
            max_samples: Maximum number of sample values per column

        Returns:
            Dictionary mapping column names to lists of sample values
        """
        samples: dict[str, list[Any]] = {}

        for i, row in enumerate(self.iter_rows(file_path)):
            if i >= max_samples:
                break

            for col, value in row.items():
                if col not in samples:
                    samples[col] = []
                if value is not None and value != '' and len(samples[col]) < max_samples:
                    samples[col].append(value)

        return samples

    def count_rows(self, file_path: str) -> int:
        """
        Count total rows in the file.

        Args:
            file_path: Path to the import file

        Returns:
            Total number of data rows
        """
        count = 0
        for _ in self.iter_rows(file_path):
            count += 1
        return count

    def normalize_value(self, value: Any) -> Any:
        """
        Normalize a cell value.

        Args:
            value: Raw cell value

        Returns:
            Normalized value (strings stripped, None for empty values)
        """
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            return value if value else None
        return value

    def parse_price(self, value: Any) -> int | None:
        """
        Parse a price value to cents.

        Args:
            value: Raw price value (can be string, int, float)

        Returns:
            Price in cents, or None if invalid
        """
        if value is None:
            return None

        try:
            if isinstance(value, str):
                # Remove currency symbols and spaces
                clean = value.replace(' ', '').replace('\xa0', '')
                clean = clean.replace('₽', '').replace('руб', '').replace('р', '')
                clean = clean.replace(',', '.')
                value = float(clean)

            # Convert to cents
            return int(float(value) * 100)
        except (ValueError, TypeError):
            return None

    def parse_images(self, value: Any, separator: str = ';') -> list[str]:
        """
        Parse image URLs from a cell value.

        Args:
            value: Raw value containing image URLs
            separator: Character used to separate multiple URLs

        Returns:
            List of image URLs
        """
        if not value:
            return []

        if isinstance(value, list):
            return [str(url).strip() for url in value if url]

        value_str = str(value).strip()
        if not value_str:
            return []

        # Try multiple separators
        for sep in [separator, ',', '\n', '|']:
            if sep in value_str:
                urls = [url.strip() for url in value_str.split(sep)]
                return [url for url in urls if url and url.startswith(('http://', 'https://'))]

        # Single URL
        if value_str.startswith(('http://', 'https://')):
            return [value_str]

        return []
