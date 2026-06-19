"""
tests/test_currency_service.py

Unit tests for the CurrencyService and ExchangeRateMatrix.
No database or LLM calls — pure Decimal arithmetic verification.
"""

from __future__ import annotations

import pytest
from decimal import Decimal

from app.models.financial import Currency
from app.services.currency_service import (
    CurrencyService,
    ExchangeRateMatrix,
    _ensure_decimal,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def matrix() -> ExchangeRateMatrix:
    """Fixed-rate matrix for deterministic tests: 1 USD = 3586 ZWG, 1 USD = 18.75 ZAR"""
    return ExchangeRateMatrix(usd_to_zwg="3586.00", usd_to_zar="18.75")


@pytest.fixture
def service() -> CurrencyService:
    return CurrencyService(usd_to_zwg="3586.00", usd_to_zar="18.75")


# ─── ExchangeRateMatrix Tests ─────────────────────────────────────────────────

class TestExchangeRateMatrix:
    def test_usd_units_per_usd_is_one(self, matrix):
        assert matrix.units_per_usd(Currency.USD) == Decimal("1")

    def test_zwg_units_per_usd(self, matrix):
        assert matrix.units_per_usd(Currency.ZWG) == Decimal("3586.00")

    def test_zar_units_per_usd(self, matrix):
        assert matrix.units_per_usd(Currency.ZAR) == Decimal("18.75")

    def test_usd_per_unit_usd(self, matrix):
        assert matrix.usd_per_unit(Currency.USD) == Decimal("1")

    def test_usd_per_unit_zar(self, matrix):
        # 1 ZAR = 1/18.75 USD = 0.05333... USD
        result = matrix.usd_per_unit(Currency.ZAR)
        expected = (Decimal("1") / Decimal("18.75")).quantize(Decimal("0.00000001"))
        assert result == expected

    def test_convert_usd_to_usd_unchanged(self, matrix):
        result = matrix.convert(Decimal("100.00"), Currency.USD, Currency.USD)
        assert result == Decimal("100.0000")

    def test_convert_usd_to_zar(self, matrix):
        # 100 USD * 18.75 = 1875 ZAR
        result = matrix.convert(Decimal("100.00"), Currency.USD, Currency.ZAR)
        assert result == Decimal("1875.0000")

    def test_convert_usd_to_zwg(self, matrix):
        # 1 USD * 3586 = 3586 ZWG
        result = matrix.convert(Decimal("1.00"), Currency.USD, Currency.ZWG)
        assert result == Decimal("3586.0000")

    def test_convert_zar_to_usd(self, matrix):
        # 1875 ZAR / 18.75 = 100 USD
        result = matrix.convert(Decimal("1875.00"), Currency.ZAR, Currency.USD)
        assert result == Decimal("100.0000")

    def test_convert_zar_to_zwg(self, matrix):
        # 1 ZAR → USD: 1/18.75 → ZWG: * 3586
        result = matrix.convert(Decimal("1.00"), Currency.ZAR, Currency.ZWG)
        usd = Decimal("1") / Decimal("18.75")
        expected = (usd * Decimal("3586")).quantize(Decimal("0.0001"))
        assert result == expected

    def test_invalid_zero_rate_raises(self):
        with pytest.raises(ValueError, match="positive"):
            ExchangeRateMatrix(usd_to_zwg="0", usd_to_zar="18.75")

    def test_invalid_negative_rate_raises(self):
        with pytest.raises(ValueError, match="positive"):
            ExchangeRateMatrix(usd_to_zwg="3586", usd_to_zar="-5")


# ─── CurrencyService Tests ────────────────────────────────────────────────────

class TestCurrencyService:
    def test_convert_to_usd_from_usd(self, service):
        result = service.convert_to_usd(Decimal("500.00"), Currency.USD)
        assert result.base_amount_usd == Decimal("500.0000")
        assert result.from_currency == Currency.USD
        assert result.to_currency == Currency.USD
        assert result.rate_applied == Decimal("1")

    def test_convert_to_usd_from_zar(self, service):
        result = service.convert_to_usd(Decimal("1875.00"), Currency.ZAR)
        assert result.base_amount_usd == Decimal("100.0000")
        assert result.original_amount == Decimal("1875.00")

    def test_convert_to_usd_from_zwg(self, service):
        # 3586 ZWG = 1 USD
        result = service.convert_to_usd(Decimal("3586.00"), Currency.ZWG)
        assert result.base_amount_usd == Decimal("1.0000")

    def test_convert_general_usd_to_zar(self, service):
        result = service.convert(Decimal("100.00"), Currency.USD, Currency.ZAR)
        assert result.converted_amount == Decimal("1875.0000")
        assert result.base_amount_usd == Decimal("100.0000")

    def test_no_float_leakage(self, service):
        """Verify no float type appears anywhere in conversion results."""
        result = service.convert_to_usd(Decimal("9999.9999"), Currency.ZAR)
        assert isinstance(result.base_amount_usd, Decimal)
        assert isinstance(result.rate_applied, Decimal)
        assert isinstance(result.original_amount, Decimal)

    def test_rates_snapshot_keys(self, service):
        snapshot = service.get_rates_snapshot()
        assert "USD_per_ZWG" in snapshot
        assert "USD_per_ZAR" in snapshot
        assert "ZWG_per_USD" in snapshot
        assert "ZAR_per_USD" in snapshot
        assert all(isinstance(v, Decimal) for v in snapshot.values())

    def test_large_amount_precision(self, service):
        """Financial regulators require 4dp precision on large amounts."""
        result = service.convert_to_usd(Decimal("1000000.0000"), Currency.ZAR)
        # Should not raise; result should be a Decimal with 4dp
        str_rep = str(result.base_amount_usd)
        assert "." in str_rep
        decimal_places = len(str_rep.split(".")[1])
        assert decimal_places <= 4


# ─── _ensure_decimal Tests ────────────────────────────────────────────────────

class TestEnsureDecimal:
    def test_decimal_passthrough(self):
        d = Decimal("42.1234")
        assert _ensure_decimal(d) is d

    def test_string_conversion(self):
        assert _ensure_decimal("100.50") == Decimal("100.50")

    def test_int_conversion(self):
        assert _ensure_decimal(100) == Decimal("100")

    def test_float_no_imprecision(self):
        # Float 0.1 in IEEE 754 is not exactly 0.1
        result = _ensure_decimal(0.1)
        assert result == Decimal("0.1")

    def test_float_large_value(self):
        result = _ensure_decimal(9999.9999)
        assert isinstance(result, Decimal)
