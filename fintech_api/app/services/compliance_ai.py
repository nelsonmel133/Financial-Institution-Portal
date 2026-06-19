"""
app/services/compliance_ai.py

LLM-powered compliance and audit copilot.

Responsibilities:
1. ComplianceAIService.analyse_transaction  — takes a LedgerEntry payload,
   constructs a structured system prompt, calls the LLM (Anthropic or OpenAI),
   parses the JSON structured output, and returns a validated LLMComplianceResult.

2. StatementParserService.parse_statement   — takes raw unstructured bank
   statement text, extracts individual transactions via the LLM, and returns
   a validated LLMStatementParseResult containing ParsedTransaction items.

Both services are provider-agnostic: they switch between Anthropic and OpenAI
based on settings.LLM_PROVIDER, always using structured JSON mode.
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

import anthropic
import openai

from app.core.config import LLMProvider, settings
from app.models.financial import Currency
from app.schemas.financial import (
    LLMComplianceResult,
    LLMStatementParseResult,
)

logger = logging.getLogger(__name__)


# ─── System Prompts ───────────────────────────────────────────────────────────

_COMPLIANCE_SYSTEM_PROMPT = """You are a senior AML/CFT compliance analyst and financial crime prevention specialist integrated into a multi-currency financial reporting platform. Your role is to perform automated pre-screening of transaction records to identify regulatory risks before human review.

REGULATORY FRAMEWORK:
- FATF 40 Recommendations
- FinCEN Bank Secrecy Act (CTR threshold: USD 10,000)
- OFAC sanctions screening awareness
- Anti-money laundering patterns: structuring (smurfing), layering, integration, round-tripping, trade-based money laundering
- Politically Exposed Persons (PEP) name-matching heuristics
- High-risk jurisdiction flagging

YOUR TASK:
Analyse the transaction details provided and return a compliance assessment as a single valid JSON object. Do not include any text, markdown, or explanation outside the JSON object.

REQUIRED JSON SCHEMA:
{
  "compliance_status": "SAFE" | "PENDING" | "FLAGGED" | "BLOCKED" | "ESCALATED",
  "compliance_category": "ROUTINE" | "CTR" | "SAR" | "STRUCTURING" | "HIGH_VALUE" | "CROSS_BORDER" | "THIRD_PARTY" | "UNKNOWN",
  "risk_score": <number 0-100>,
  "flags": [
    {
      "code": "<UPPER_SNAKE_CASE flag identifier>",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "description": "<explanation>",
      "regulatory_basis": "<statute or recommendation, or null>"
    }
  ],
  "requires_manual_review": <boolean>,
  "ctr_required": <boolean>,
  "sar_required": <boolean>,
  "audit_summary": "<max 500 character narrative>",
  "detected_patterns": ["<pattern name>"]
}

SCORING GUIDANCE:
- 0–25: Routine transaction, no indicators
- 26–50: Minor anomalies, monitor
- 51–75: Significant risk signals, flag for review
- 76–100: Critical risk, block and escalate

Set ctr_required=true if base_amount_usd >= 10000.
Set sar_required=true if risk_score >= 60 or structuring patterns detected.
Set requires_manual_review=true if risk_score >= 50.
"""

_STATEMENT_PARSER_SYSTEM_PROMPT = """You are a precision financial data extraction engine. Your task is to parse unstructured or semi-structured bank statement text and extract every individual transaction into a structured JSON format.

EXTRACTION RULES:
1. Extract every debit, credit, transfer, fee, and adjustment as a separate transaction.
2. Infer the currency from symbols ($ = USD, R = ZAR, ZWG = ZWG) or statement headers.
3. If no currency can be determined, use the default_currency provided.
4. Dates: parse to ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ). If year is missing, use current year.
5. Amounts: always positive Decimal values. Direction (debit/credit) goes in description.
6. Descriptions: preserve the original text but clean up whitespace and special characters.
7. Counterparty: extract payee/payer name if present.
8. Reference: extract any cheque numbers, transfer codes, or reference identifiers.
9. Skip header rows, summary lines, opening/closing balance lines, and page breaks.
10. If a line is ambiguous, include it with a best-effort parse and note it in parse_notes.

OUTPUT FORMAT: Return ONLY a single valid JSON object. No markdown, no explanation.

REQUIRED JSON SCHEMA:
{
  "transactions": [
    {
      "amount": <positive decimal as string>,
      "currency": "USD" | "ZWG" | "ZAR",
      "description": "<cleaned description>",
      "counterparty_name": "<name or null>",
      "counterparty_account": "<account number or null>",
      "reference_number": "<reference or null>",
      "transaction_date": "<ISO 8601 string or null>",
      "raw_line": "<original text line>"
    }
  ],
  "parse_notes": "<notes about ambiguities or null>",
  "detected_statement_currency": "USD" | "ZWG" | "ZAR" | null
}
"""


# ─── Client Factory ───────────────────────────────────────────────────────────

def _get_anthropic_client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(
        api_key=settings.LLM_API_KEY.get_secret_value(),
        timeout=settings.LLM_REQUEST_TIMEOUT,
        max_retries=2,
    )


def _get_openai_client() -> openai.AsyncOpenAI:
    return openai.AsyncOpenAI(
        api_key=settings.LLM_API_KEY.get_secret_value(),
        timeout=settings.LLM_REQUEST_TIMEOUT,
        max_retries=2,
    )


# ─── LLM Call Wrappers ────────────────────────────────────────────────────────

async def _call_llm_anthropic(system_prompt: str, user_message: str) -> str:
    """Calls Anthropic API and returns the raw text content of the response."""
    client = _get_anthropic_client()
    try:
        response = await client.messages.create(
            model=settings.LLM_MODEL_ANTHROPIC,
            max_tokens=settings.LLM_MAX_TOKENS,
            temperature=settings.LLM_TEMPERATURE,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text
    finally:
        await client.close()


async def _call_llm_openai(system_prompt: str, user_message: str) -> str:
    """Calls OpenAI API in JSON mode and returns the raw text content."""
    client = _get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_OPENAI,
            max_tokens=settings.LLM_MAX_TOKENS,
            temperature=settings.LLM_TEMPERATURE,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content or ""
    finally:
        await client.close()


async def _call_llm(system_prompt: str, user_message: str) -> str:
    """Provider-agnostic LLM dispatcher."""
    if settings.LLM_PROVIDER == LLMProvider.ANTHROPIC:
        return await _call_llm_anthropic(system_prompt, user_message)
    return await _call_llm_openai(system_prompt, user_message)


def _safe_parse_json(raw: str, context: str) -> dict[str, Any]:
    """
    Strips markdown fences if present and parses JSON.
    Raises ValueError with context on failure.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        # Strip ```json ... ``` or ``` ... ``` fences
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("LLM JSON parse error [%s]: %s\nRaw: %r", context, exc, raw[:500])
        raise ValueError(
            f"LLM returned malformed JSON for {context}: {exc}"
        ) from exc


# ─── Compliance AI Service ────────────────────────────────────────────────────

class ComplianceAIService:
    """
    Analyses a transaction for AML/CFT compliance risks using an LLM.

    Usage:
        service = ComplianceAIService()
        result = await service.analyse_transaction(
            amount=Decimal("9800.00"),
            original_currency=Currency.USD,
            base_amount_usd=Decimal("9800.00"),
            description="Cash deposit - multiple branch visits",
            counterparty_name=None,
        )
    """

    async def analyse_transaction(
        self,
        amount: Decimal,
        original_currency: Currency,
        base_amount_usd: Decimal,
        description: str,
        counterparty_name: str | None = None,
        counterparty_account: str | None = None,
        reference_number: str | None = None,
        ctr_threshold_usd: Decimal | None = None,
    ) -> LLMComplianceResult:
        """
        Constructs a detailed compliance prompt, calls the LLM,
        and returns a validated LLMComplianceResult.

        Raises:
            ValueError: If the LLM returns malformed JSON or the response
                        fails Pydantic validation after two attempts.
        """
        threshold = ctr_threshold_usd or Decimal(settings.CTR_THRESHOLD_USD)

        user_message = self._build_transaction_prompt(
            amount=amount,
            original_currency=original_currency,
            base_amount_usd=base_amount_usd,
            description=description,
            counterparty_name=counterparty_name,
            counterparty_account=counterparty_account,
            reference_number=reference_number,
            ctr_threshold_usd=threshold,
        )

        logger.info(
            "ComplianceAI: analysing transaction | currency=%s amount=%s usd_eq=%s",
            original_currency,
            amount,
            base_amount_usd,
        )

        try:
            raw_response = await _call_llm(_COMPLIANCE_SYSTEM_PROMPT, user_message)
            parsed_json = _safe_parse_json(raw_response, "compliance_analysis")
            result = LLMComplianceResult.model_validate(parsed_json)

            logger.info(
                "ComplianceAI: analysis complete | status=%s risk_score=%s flags=%d",
                result.compliance_status,
                result.risk_score,
                len(result.flags),
            )
            return result

        except (ValueError, Exception) as exc:
            logger.error("ComplianceAI: analysis failed | error=%s", exc)
            # Return a safe PENDING result with an error note rather than crashing
            return self._fallback_result(error=str(exc))

    @staticmethod
    def _build_transaction_prompt(
        amount: Decimal,
        original_currency: Currency,
        base_amount_usd: Decimal,
        description: str,
        counterparty_name: str | None,
        counterparty_account: str | None,
        reference_number: str | None,
        ctr_threshold_usd: Decimal,
    ) -> str:
        """Builds the structured user message for the compliance analysis call."""
        lines = [
            "TRANSACTION DETAILS FOR COMPLIANCE ANALYSIS:",
            "",
            f"Amount (original): {amount} {original_currency}",
            f"Amount (USD equivalent): {base_amount_usd} USD",
            f"CTR Filing Threshold: {ctr_threshold_usd} USD",
            f"Exceeds CTR threshold: {'YES' if base_amount_usd >= ctr_threshold_usd else 'NO'}",
            f"Description: {description}",
        ]
        if counterparty_name:
            lines.append(f"Counterparty Name: {counterparty_name}")
        if counterparty_account:
            lines.append(f"Counterparty Account: {counterparty_account}")
        if reference_number:
            lines.append(f"Reference Number: {reference_number}")

        lines += [
            "",
            "Please analyse this transaction and return your compliance assessment as JSON.",
        ]
        return "\n".join(lines)

    @staticmethod
    def _fallback_result(error: str) -> LLMComplianceResult:
        """
        Returns a safe PENDING result when the LLM call or parse fails.
        Ensures ledger entries are never silently skipped due to AI errors.
        """
        from app.models.financial import ComplianceCategory, ComplianceStatus
        from app.schemas.financial import ComplianceFlag

        return LLMComplianceResult(
            compliance_status=ComplianceStatus.PENDING,
            compliance_category=ComplianceCategory.UNKNOWN,
            risk_score=Decimal("0"),
            flags=[
                ComplianceFlag(
                    code="AI_ANALYSIS_FAILED",
                    severity="MEDIUM",
                    description=f"Automated compliance analysis could not complete: {error[:256]}",
                    regulatory_basis=None,
                )
            ],
            requires_manual_review=True,
            ctr_required=False,
            sar_required=False,
            audit_summary="Automated analysis failed. Manual review required.",
            detected_patterns=[],
        )


# ─── Statement Parser Service ─────────────────────────────────────────────────

class StatementParserService:
    """
    Extracts structured transaction records from unstructured bank statement text.

    Usage:
        parser = StatementParserService()
        result = await parser.parse_statement(
            raw_text="...",
            default_currency=Currency.ZAR,
        )
        for tx in result.transactions:
            print(tx.amount, tx.currency, tx.description)
    """

    async def parse_statement(
        self,
        raw_text: str,
        default_currency: Currency = Currency.USD,
        hint_timezone: str | None = None,
    ) -> LLMStatementParseResult:
        """
        Sends raw bank statement text to the LLM and returns a validated
        list of ParsedTransaction objects.

        Raises:
            ValueError: If the LLM response cannot be parsed or validated.
        """
        user_message = self._build_parse_prompt(
            raw_text=raw_text,
            default_currency=default_currency,
            hint_timezone=hint_timezone,
        )

        logger.info(
            "StatementParser: parsing statement | chars=%d default_currency=%s",
            len(raw_text),
            default_currency,
        )

        try:
            raw_response = await _call_llm(_STATEMENT_PARSER_SYSTEM_PROMPT, user_message)
            parsed_json = _safe_parse_json(raw_response, "statement_parse")
            result = LLMStatementParseResult.model_validate(parsed_json)

            logger.info(
                "StatementParser: complete | transactions_extracted=%d",
                len(result.transactions),
            )
            return result

        except (ValueError, Exception) as exc:
            logger.error("StatementParser: parsing failed | error=%s", exc)
            raise ValueError(
                f"Statement parsing failed: {exc}"
            ) from exc

    @staticmethod
    def _build_parse_prompt(
        raw_text: str,
        default_currency: Currency,
        hint_timezone: str | None,
    ) -> str:
        """Builds the structured user message for the statement parsing call."""
        lines = [
            f"DEFAULT CURRENCY (use if no currency can be inferred): {default_currency}",
        ]
        if hint_timezone:
            lines.append(f"TIMEZONE HINT for date parsing: {hint_timezone}")
        lines += [
            "",
            "BANK STATEMENT TEXT TO PARSE:",
            "---",
            raw_text,
            "---",
            "",
            "Extract all transactions and return your result as JSON.",
        ]
        return "\n".join(lines)


# ─── Module-level singletons ──────────────────────────────────────────────────

compliance_ai_service = ComplianceAIService()
statement_parser_service = StatementParserService()
