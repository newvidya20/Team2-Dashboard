# Royal Enterprises — Power BI credit review

Open **RoyalEnterprisesCreditReview.pbip** in Power BI Desktop. Keep the Report and SemanticModel folders beside it. The four pages are:

1. GST Review — monthly supply composition, filing dates, ITC, output tax, late fees and checklist coverage.
2. Banking Review — account and month filters, cash flows, BTO candidates, party receipts/payments, internal transfer matches, return markers and transaction evidence.
3. Banking & GST Reconciliation — an aggregate common-period bridge. Party-level matching is explicitly pending the missing GST party records.
4. Financial & Credit Analysis — three year buttons, annual metrics, three-year trends, all 25 checklist parameters, source/evidence notes, loan schedule and historical bureau summary.

## Financial years

- FY2023-24: audited.
- FY2024-25: audited.
- FY2025-26: provisional. The source folder is labelled “Provisional FY2026-27”, but the actual P&L and balance sheet state 31 March 2026. The dashboard follows the document dates.

The selected year controls financial cards, ratios and all 25 parameters. Trend charts deliberately retain all three years. The July 2026 loan/bureau snapshots remain clearly dated and independent of the annual selector.

## Source coverage and limits

- 6,274 transactions across BOB, ICICI and Vighnaharta accounts; July 2025-June 2026. Every consecutive running balance reconciles. Opening balances are excluded from cash flows.
- 14 GSTR-3B returns; April 2025-May 2026. GST supplies include taxable, exempt/nil-rated, zero-rated and non-GST supplies. GSTR-3B does not establish buyer/supplier totals, HSN products, purchase turnover or customer-state revenue.
- Reconciliation uses only the 11 common months, July 2025-May 2026. Bank receipts and GST booked supplies have different timing/tax bases; the gap is not a receivable balance or proof of undeclared turnover.
- Party GST reconciliation, buyer/supplier shares, HSN, state split and intra-group turnover need GSTR-1/GSTR-2B, invoice ledgers and verified party relationships.
- BTO excludes confirmed reciprocal internal credits, narration-based loan credit candidates and return markers. Unidentified financing/internal transfers can remain; BTO is an analytical candidate, not verified sales.
- Return counts are narration entries, not deduplicated failed-payment events. Loan/cash/penal classifications retain source narration for review.
- The business is a proprietorship. Reported P&L profit is before proprietor personal income tax, not corporate PAT. EBIT adds interest to pre-tax profit; personal income tax is not added again.
- Debt includes secured, unsecured and friends/relative borrowing. The literal PDF adjusted debt/equity formula double counts unsecured debt and is labelled accordingly. Current ratios use reported current liabilities; current loan maturities are not separately disclosed.
- DSCR, annual operating cash flow, promoter personal net worth, invoice ageing, retained earnings and eligible drawing power remain unavailable where evidence is absent.
- The 7 July 2026 loan sheet has 37 rows. EMI row sum is INR56,87,124/month; printed total INR54,45,112. Difference INR2,42,012 equals the Siemens EMI. Row totals are used and the inconsistency is disclosed.
- Personal CIBIL report page 1: score 756 dated 7 July 2026, with a dispute-under-review remark dated 25 April 2023. Only its introductory pages were OCR reviewed; the full 182-page account history was not audited.
- Company CIBIL report page 2: 31 open / 17 closed / 0 delinquent facilities and 96% working capital utilisation, as reported on 7 July 2026. The rank is a dash. These are historical source statements, not current credit clearance.

## Data and refresh

`ExtractedData` contains CSV snapshots with source/page references where applicable. The semantic model embeds those snapshots in Power Query, so it has no dependency on the original Downloads folder. Power BI Refresh reloads the embedded snapshot; it does **not** re-extract changed PDFs.

The local build scripts and extracted PDF text are retained one directory above this deliverable. No company source documents were uploaded to a cloud workspace or published. The original application files in `backend` and `src` were not modified.

`Validation.json` records schema/binding checks and data controls. Power BI Desktop refreshed the model successfully; DAX checks confirmed all three years filter to 25 financial parameters each. The FY2024-25 source balance sheet has an INR0.05 rounding difference, retained without an invented balancing entry.

Power BI project format documentation: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview
