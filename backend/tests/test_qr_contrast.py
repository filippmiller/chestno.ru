"""Tests for QR code contrast calculation (WCAG compliance)."""

import pytest
from app.services.qr import calculate_contrast_ratio


def test_contrast_black_on_white():
    """Test maximum contrast (black on white)."""
    ratio = calculate_contrast_ratio('#000000', '#FFFFFF')
    assert ratio == 21.0  # Maximum possible contrast


def test_contrast_white_on_black():
    """Test maximum contrast (white on black) - order shouldn't matter."""
    ratio = calculate_contrast_ratio('#FFFFFF', '#000000')
    assert ratio == 21.0  # Should be same as black on white


def test_contrast_same_colors():
    """Test minimum contrast (same colors)."""
    ratio = calculate_contrast_ratio('#FF0000', '#FF0000')
    assert ratio == 1.0  # Minimum possible contrast


def test_contrast_gray_combinations():
    """Test various gray combinations."""
    # Light gray on white
    ratio1 = calculate_contrast_ratio('#CCCCCC', '#FFFFFF')
    assert ratio1 < 3.0  # Below WCAG AA threshold

    # Dark gray on white
    ratio2 = calculate_contrast_ratio('#666666', '#FFFFFF')
    assert ratio2 >= 3.0  # Above WCAG AA threshold for graphical objects


def test_contrast_wcag_aa_threshold():
    """Test colors at WCAG AA boundary."""
    # These colors should be close to 3.0:1 ratio
    ratio = calculate_contrast_ratio('#767676', '#FFFFFF')
    assert 2.8 <= ratio <= 3.2  # Around the WCAG AA threshold


def test_contrast_real_world_examples():
    """Test real-world color combinations."""
    # Blue on white
    blue_white = calculate_contrast_ratio('#0000FF', '#FFFFFF')
    assert blue_white >= 3.0

    # Green on white
    green_white = calculate_contrast_ratio('#00FF00', '#FFFFFF')
    assert green_white >= 3.0  # Might be close to threshold

    # Red on white
    red_white = calculate_contrast_ratio('#FF0000', '#FFFFFF')
    assert red_white >= 3.0


def test_contrast_invalid_colors_handled():
    """Test that invalid hex colors raise errors."""
    with pytest.raises(ValueError):
        calculate_contrast_ratio('not-a-color', '#FFFFFF')

    with pytest.raises(ValueError):
        calculate_contrast_ratio('#FFF', '#FFFFFF')  # Too short
