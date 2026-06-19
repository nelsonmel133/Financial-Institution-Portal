"""
app/services/currency_service.py

Math-accurate, Decimal-based multi-currency conversion engine.
Supports USD ↔ ZWG ↔ ZAR with configurable exchange rates.

Design principles:
- All arithmetic is performed with Python's decimal.Decimal at ROUND_HALF_UP precision.
- No float arithmetic anywhere in the conversion chain.
- Exchange rates are stored and passed as Decimal strings, never floats.
- Conversion results include both the converted amount and the rate used,
  allowing full audit reconstruction.
"""

from __future__ import annotations

import logging
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import NamedTuple

from app.core.config import settings
from app.models.financial import Currency

logger = logging.getLogger(__name__)

# Internal precision for intermediate calculations (higher than storage precision)
_CALC_PRECISION = Decimal("0.00000001")  # 8 decimal places during computation
# Final storage precision (matches DB Numeric(18, 4))
_STORE_PRECISION = Decimal("0.0001")


class ConversionResult(NamedTuple):
    """
    Immutable result of a currency conversion operation.

    Attributes:
        original_amount:  Input value in `from_currency`.
        from_currency:    Source currency code.
        converted_amount: Output value in `to_currency`, rounded to 4dp.
        to_currency:      Target currency code.
        rate_applied:     The exchange rate used (from_currency per 1 to_currency).
        base_amount_usd:  The USD-normalised equivalent (always populated).
        base_rate_to_usd: Rate used to reach the USD equivalent.
    """
    original_amount: Decimal
    from_currency: Currency
    converted_amount: Decimal
    to_currency: Currency
    rate_applied: Decimal
    base_amount_usd: Decimal
    base_rate_to_usd: Decimal


class ExchangeRateMatrix:
    """
    Holds the current exchange rate table.
    All rates are expressed as: 1 USD = N <currency>.

    To add a live-rate feed, subclass this and override `get_rate_to_usd`.
    """

    def __init__(
        self,
        usd_to_zwg: Decimal | str | None = None,
        usd_to_zar: Decimal | str | None = None,
    ) -> None:
        self._usd_to_zwg = Decimal(
            str(usd_to_zwg) if usd_to_zwg is not None else settings.EXCHANGE_RATE_USD_TO_ZWG
        )
        self._usd_to_zar = Decimal(
            str(usd_to_zar) if usd_to_zar is not None else settings.EXCHANGE_RATE_USD_TO_ZAR
        )

        if self._usd_to_zwg <= 0:
            raise ValueError("USD→ZWG exchange rate must be positive.")
        if self._usd_to_zar <= 0:
            raise ValueError("USD→ZAR exchange rate must be positive.")

    def units_per_usd(self, currency: Currency) -> Decimal:
        """
        Returns how many units of `currency` equal 1 USD.
        USD itself returns Decimal('1').
        """
        if currency == Currency.USD:
            return Decimal("1")
        if currency == Currency.ZWG:
            return self._usd_to_zwg
        if currency == Currency.ZAR:
            return self._usd_to_zar
        raise ValueError(f"Unsupported currency: {currency}")

    def usd_per_unit(self, currency: Currency) -> Decimal:
        """
        Returns how many USD 1 unit of `currency` is worth.
        USD itself returns Decimal('1').
        """
        units = self.units_per_usd(currency)
        return (Decimal("1") / units).quantize(_CALC_PRECISION, rounding=ROUND_HALF_UP)

    def convert(self, amount: Decimal, from_currency: Currency, to_currency: Currency) -> Decimal:
        """
        Converts `amount` from `from_currency` to `to_currency`.
        All intermediate arithmetic uses _CALC_PRECISION precision.
        The final result is rounded to _STORE_PRECISION (4dp).
        """
        if from_currency == to_currency:
            return amount.quantize(_STORE_PRECISION, rounding=ROUND_HALF_UP)

        # Step 1: convert to USD (universal pivot)
        usd_amount = (amount * self.usd_per_unit(from_currency)).quantize(
            _CALC_PRECISION, rounding=ROUND_HALF_UP
        )

        if to_currency == Currency.USD:
            return usd_amount.quantize(_STORE_PRECISION, rounding=ROUND_HALF_UP)

        # Step 2: convert USD to target currency
        return (usd_amount * self.units_per_usd(to_currency)).quantize(
            _STORE_PRECISION, rounding=ROUND_HALF_UP
        )


class CurrencyService:
    """
    High-level service class consumed by API endpoints and the compliance pipeline.
    Wraps ExchangeRateMatrix with structured result objects and error handling.

    Example usage:
        svc = CurrencyService()
        result = svc.convert_to_usd(Decimal("5000.00"), Currency.ZAR)
        print(result.base_amount_usd)  # → Decimal('266.6667')
    """

    def __init__(
        self,
        usd_to_zwg: Decimal | str | None = None,
        usd_to_zar: Decimal | str | None = None,
    ) -> None:
        self._matrix = ExchangeRateMatrix(usd_to_zwg=usd_to_zwg, usd_to_zar=usd_to_zar)

    def convert_to_usd(self, amount: Decimal, from_currency: Currency) -> ConversionResult:
        """
        Converts an amount in any supported currency to USD.
        This is the primary method used when saving ledger entries.
        """
        try:
            amount_d = _ensure_decimal(amount)
            rate = self._matrix.usd_per_unit(from_currency)
            base_usd = (amount_d * rate).quantize(_STORE_PRECISION, rounding=ROUND_HALF_UP)

            return ConversionResult(
                original_amount=amount_d,
                from_currency=from_currency,
                converted_amount=base_usd,
                to_currency=Currency.USD,
                rate_applied=rate,
                base_amount_usd=base_usd,
                base_rate_to_usd=rate,
            )
        except InvalidOperation as exc:
            logger.error(
                "Currency conversion failed: %s %s → USD | error=%s",
                amount, from_currency, exc,
            )
            raise ValueError(
                f"Invalid amount for currency conversion: {amount!r}"
            ) from exc

    def convert(
        self,
        amount: Decimal,
        from_currency: Currency,
        to_currency: Currency,
    ) -> ConversionResult:
        """
        General-purpose conversion between any two supported currencies.
        Also computes the USD base equivalent for audit purposes.
        """
        try:
            amount_d = _ensure_decimal(amount)
            converted = self._matrix.convert(amount_d, from_currency, to_currency)

            # Always compute USD equivalent for audit trail
            usd_rate = self._matrix.usd_per_unit(from_currency)
            base_usd = (amount_d * usd_rate).quantize(_STORE_PRECISION, rounding=ROUND_HALF_UP)

            # Determine the direct rate between the two currencies for the audit record
            if from_currency == to_currency:
                direct_rate = Decimal("1")
            elif to_currency == Currency.USD:
                direct_rate = usd_rate
            else:
                # from_currency → USD → to_currency: express as from per 1 to
                usd_per_to = self._matrix.usd_per_unit(to_currency)
                direct_rate = (usd_rate / usd_per_to).quantize(
                    _CALC_PRECISION, rounding=ROUND_HALF_UP
                )

            return ConversionResult(
                original_amount=amount_d,
                from_currency=from_currency,
                converted_amount=converted,
                to_currency=to_currency,
                rate_applied=direct_rate,
                base_amount_usd=base_usd,
                base_rate_to_usd=usd_rate,
            )
        except InvalidOperation as exc:
            logger.error(
                "Currency conversion failed: %s %s → %s | error=%s",
                amount, from_currency, to_currency, exc,
            )
            raise ValueError(
                f"Invalid amount for currency conversion: {amount!r}"
            ) from exc

    def get_rates_snapshot(self) -> dict[str, Decimal]:
        """
        Returns the current rate table as a dictionary.
        Useful for embedding in API health-check or audit responses.
        """
        return {
            "USD_per_ZWG": self._matrix.usd_per_unit(Currency.ZWG),
            "USD_per_ZAR": self._matrix.usd_per_unit(Currency.ZAR),
            "ZWG_per_USD": self._matrix.units_per_usd(Currency.ZWG),
            "ZAR_per_USD": self._matrix.units_per_usd(Currency.ZAR),
            "ZWG_per_ZAR": self._matrix.convert(Decimal("1"), Currency.ZAR, Currency.ZWG),
            "ZAR_per_ZWG": self._matrix.convert(Decimal("1"), Currency.ZWG, Currency.ZAR),
        }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _ensure_decimal(value: Decimal | str | int | float) -> Decimal:
    """
    Coerces any numeric-like input to Decimal safely.
    Floats are round-tripped through str() to avoid IEEE 754 artefacts.
    """
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        return Decimal(str(value))
    return Decimal(str(value))


# ─── Module-level singleton ───────────────────────────────────────────────────
# Uses the static rates from settings. Replace with a live-rate-aware subclass
# to plug in a real FX data provider.
currency_service = CurrencyService()
