"""
1C (1С:Предприятие) export file parser.
Handles XML and CSV files exported from 1C systems.
"""

import csv
import xml.etree.ElementTree as ET
from typing import Any, Iterator

from .base import BaseImportParser


class OneCParser(BaseImportParser):
    """Parser for 1C XML and CSV export files."""

    source_name = "1С"
    supported_extensions = ['.xml', '.csv']

    # Known 1C column/tag names
    KNOWN_COLUMNS = {
        # Product identification
        'Номенклатура': 'name',
        'Наименование': 'name',
        'Код': 'sku',
        'Артикул': 'sku',
        'ШтрихКод': 'barcode',
        'Штрихкод': 'barcode',
        'ШтрихКодЕАН': 'barcode',

        # Product info
        'ПолноеНаименование': 'name',
        'НаименованиеПолное': 'name',
        'Описание': 'long_description',
        'ОписаниеТовара': 'long_description',
        'Комментарий': 'short_description',
        'Группа': 'category',
        'ВидНоменклатуры': 'category',
        'ГруппаНоменклатуры': 'category',
        'ЕдиницаИзмерения': 'unit',

        # Pricing
        'Цена': 'price',
        'ЦенаРозничная': 'price',
        'ЦенаПродажи': 'price',
        'ЦенаОптовая': 'wholesale_price',

        # Stock
        'Остаток': 'stock_quantity',
        'ОстатокНаСкладе': 'stock_quantity',
        'Количество': 'stock_quantity',
        'КоличествоОстаток': 'stock_quantity',

        # Images
        'Картинка': 'main_image_url',
        'Изображение': 'main_image_url',
        'ФайлКартинки': 'main_image_url',
        'ДополнительныеРеквизиты': 'attributes',

        # Variants
        'Характеристика': 'variant_name',
        'ХарактеристикаНоменклатуры': 'variant_name',
        'Размер': 'size',
        'Цвет': 'color',
    }

    def _detect_file_type(self, file_path: str) -> str:
        """Detect file type from extension and content."""
        ext = file_path.lower().rsplit('.', 1)[-1]

        if ext == 'xml':
            return 'xml'

        # Check if CSV starts with XML declaration
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                if first_line.startswith('<?xml'):
                    return 'xml'
        except Exception:
            pass

        return 'csv'

    def get_columns(self, file_path: str) -> list[str]:
        file_type = self._detect_file_type(file_path)

        if file_type == 'xml':
            return self._get_xml_columns(file_path)
        else:
            return self._get_csv_columns(file_path)

    def _get_xml_columns(self, file_path: str) -> list[str]:
        """Extract columns from 1C XML file."""
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()

            columns = set()

            # Try to find product elements (various 1C formats)
            product_tags = [
                'Товар', 'Номенклатура', 'Product', 'Item',
                'Catalog_Товар', 'КаталогТоваров', 'ЭлементКаталога',
            ]

            for tag in product_tags:
                # Handle namespaces
                for product in root.iter():
                    local_name = product.tag.split('}')[-1] if '}' in product.tag else product.tag

                    if local_name in product_tags:
                        # Get child element names as columns
                        for child in product:
                            child_name = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                            columns.add(child_name)

                        # Get attributes as columns
                        for attr in product.attrib:
                            columns.add(attr)

            return sorted(list(columns))

        except Exception:
            return []

    def _get_csv_columns(self, file_path: str) -> list[str]:
        """Extract columns from 1C CSV file (semicolon-delimited)."""
        encodings = ['utf-8', 'utf-8-sig', 'cp1251', 'cp866', 'latin1']

        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc, newline='') as f:
                    # 1C typically uses semicolon delimiter
                    reader = csv.reader(f, delimiter=';')
                    headers = next(reader, [])

                    if headers:
                        return [h.strip() for h in headers]
            except (UnicodeDecodeError, csv.Error):
                continue

        return []

    def iter_rows(self, file_path: str) -> Iterator[dict[str, Any]]:
        file_type = self._detect_file_type(file_path)

        if file_type == 'xml':
            yield from self._iter_xml_rows(file_path)
        else:
            yield from self._iter_csv_rows(file_path)

    def _iter_xml_rows(self, file_path: str) -> Iterator[dict[str, Any]]:
        """Iterate over products in 1C XML file."""
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()

            product_tags = [
                'Товар', 'Номенклатура', 'Product', 'Item',
                'Catalog_Товар', 'КаталогТоваров', 'ЭлементКаталога',
            ]

            for product in root.iter():
                local_name = product.tag.split('}')[-1] if '}' in product.tag else product.tag

                if local_name in product_tags:
                    row_data = {}

                    # Extract attributes
                    for attr, value in product.attrib.items():
                        row_data[attr] = self.normalize_value(value)

                    # Extract child elements
                    for child in product:
                        child_name = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                        value = child.text

                        # Handle nested elements
                        if len(child) > 0:
                            # Serialize nested as JSON-like string
                            nested = {}
                            for nested_child in child:
                                nested_name = nested_child.tag.split('}')[-1]
                                nested[nested_name] = nested_child.text
                            value = str(nested) if nested else value

                        row_data[child_name] = self.normalize_value(value)

                    if row_data:
                        yield row_data

        except Exception:
            return

    def _iter_csv_rows(self, file_path: str) -> Iterator[dict[str, Any]]:
        """Iterate over rows in 1C CSV file."""
        encodings = ['utf-8', 'utf-8-sig', 'cp1251', 'cp866', 'latin1']
        encoding = 'cp1251'  # 1C typically uses Windows-1251

        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc, newline='') as f:
                    f.read(1024)
                    encoding = enc
                    break
            except UnicodeDecodeError:
                continue

        try:
            with open(file_path, 'r', encoding=encoding, newline='') as f:
                reader = csv.DictReader(f, delimiter=';')

                for row in reader:
                    yield {k.strip(): self.normalize_value(v) for k, v in row.items()}
        except Exception:
            return

    def get_suggested_mapping(self) -> dict[str, str]:
        """Return 1C-specific column mappings."""
        return {k.lower(): v for k, v in self.KNOWN_COLUMNS.items()}

    def parse_1c_price(self, value: Any) -> int | None:
        """
        Parse 1C price format to cents.
        1C may export prices with various decimal separators.
        """
        if value is None:
            return None

        try:
            value_str = str(value).strip()

            # Remove thousand separators (space or non-breaking space)
            value_str = value_str.replace(' ', '').replace('\xa0', '')

            # Handle Russian decimal comma
            if ',' in value_str and '.' not in value_str:
                value_str = value_str.replace(',', '.')

            # Parse and convert to cents
            price = float(value_str)
            return int(price * 100)

        except (ValueError, TypeError):
            return None

    def parse_1c_stock(self, value: Any) -> int | None:
        """
        Parse 1C stock quantity.
        May contain decimal values for fractional units.
        """
        if value is None:
            return None

        try:
            value_str = str(value).strip()
            value_str = value_str.replace(',', '.').replace(' ', '')

            # Round to integer for stock quantity
            return int(float(value_str))

        except (ValueError, TypeError):
            return None

    def extract_characteristics(self, row: dict[str, Any]) -> dict[str, str]:
        """
        Extract 1C characteristics (variants) from a row.
        """
        attributes = {}

        # Direct variant fields
        variant_fields = [
            ('Характеристика', 'Характеристика'),
            ('ХарактеристикаНоменклатуры', 'Характеристика'),
            ('Размер', 'Размер'),
            ('Цвет', 'Цвет'),
            ('Объем', 'Объем'),
            ('Вес', 'Вес'),
            ('Вкус', 'Вкус'),
        ]

        for col_name, attr_name in variant_fields:
            value = row.get(col_name)
            if value and str(value).strip():
                attributes[attr_name] = str(value).strip()

        return attributes
