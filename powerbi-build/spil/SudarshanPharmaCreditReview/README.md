# Sudarshan Pharma Industries Limited — Power BI credit review

Open **SudarshanPharmaCreditReview.pbip** in Power BI Desktop, keeping its Report and SemanticModel folders beside it. If visuals are blank on first open, click Home → Refresh to load the embedded snapshots.

## Four pages

1. **GST Review:** financial year, month and registration-state filters; declared supplies, zero-rated supplies, filing evidence, late fees and checklist coverage.
2. **Banking Review:** account/month filters, gross flows, adjusted BTO candidates, party receipts/payments, return and penal markers, dated CC utilisation and transaction source references.
3. **Banking & GST Reconciliation:** an aggregate availability bridge with bank-account/registration counts. Party-level reconciliation is pending party GST data.
4. **Financial & Credit Analysis:** separate FY2023-24, FY2024-25 and FY2025-26 buttons; annual KPIs, three-year trends, all 25 checklist parameters, loan schedule and evidence-based SWOT.

All three financial years are audited. Annual figures use the standalone company, not consolidated group figures. FY2024 is previous GAAP; FY2025 is the restated Ind AS comparative from the FY2026 filing; FY2026 is Ind AS. The year selector filters annual cards, ratios and parameters; trend charts retain all three years. The June 2026 loan/CC snapshots remain independently dated.

## Verified source facts

- ZIP inventory: 164 source files, comprising 163 PDFs and one loan-obligation workbook. `SourceInventory.json` maps short source IDs to original file names and folders.
- 81 bank PDFs covering seven accounts. All **25,558 raw transactions** pass consecutive running-balance checks within each statement. After removing **378 cross-document overlap rows**, the model contains **25,180 transactions**. Genuine repeated entries within a statement are preserved.
- Bank transaction dates range from 1 April 2025 to 24 August 2026. Earlier coverage is mainly Kotak; other accounts begin later. BOI records start April 2026. August is partial; Union 0102 June coverage ends 17 June in the supplied file. Missing account periods are not assumed to be zero activity.
- 74 GSTR-3B documents across Gujarat, Haryana, Maharashtra, Telangana and Uttarakhand. Four registrations begin April 2025; supplied Telangana documents begin October 2025. GST ends July 2026.
- Haryana February 2026 displays FILED but lacks the ARN, ARN date and taxpayer name. The filing date remains blank and the document is flagged as unverified evidence rather than declared unfiled.
- The 30 June 2026 loan sheet has 32 facilities. Limit and outstanding row sums reconcile to the source totals: INR234,07,71,621 and INR182,36,51,197. Entered EMI rows total **INR51,31,667**, while the source printed total is **INR3,23,308**; that printed total omits text-formatted amounts. Missing monthly amounts remain blank.

## Interpretation and evidence gaps

- Adjusted BTO is a **candidate**, not verified sales. It excludes identified own-account credits, loan-disbursement candidates and return markers. Reciprocal UTR matches confirm a subset; ownership narration alone is clearly labelled as candidate. Unidentified financing/transfers may remain.
- Return counts count narration entries, not unique failed-payment events. Loan/cash/penal classifications require source narration review. Parties are based on statement names; no fuzzy identity merges are made.
- GST state charts show **registration-state declarations**, not buyer-state revenue. GST can include inter-registration/branch transfers. No branch-transfer or group elimination is possible from GSTR-3B alone.
- Zero-rated supplies are not independently proven exports: an export/SEZ split is absent. ITC does not establish purchase turnover. Buyer/supplier shares, HSN and party-wise reconciliation need GSTR-1, GSTR-2B and invoice ledgers.
- The 16-month reconciliation is an **availability comparison**, not full entity reconciliation. Coverage differs across months, and cash, booked supplies, taxes, advances and old receivable collections differ in basis. The resulting gap is not a debtor balance or proof of unexplained turnover.
- CC utilisation uses the obligation schedule's 30 June 2026 limits and outstanding only; those limits are not applied retrospectively. Source schedule and available statement closing balances are shown separately, including differences. Karnataka statements and Kotak/Union CC limits are absent.
- Total financial debt includes current/noncurrent borrowing balances plus lease liabilities. The literal PDF adjusted debt/equity formula double counts unsecured borrowing and is labelled accordingly. Tangible net worth deducts intangibles from equity.
- FY2024 source operating cash flow includes INR7,509.34 lakh of short-term borrowing movements. Later Ind AS cash flows classify borrowings under financing; the chart and OCF/interest ratio require this basis caveat.
- FY2025 original accounts and the older net-worth certificate use a different basis from the restated FY2025 comparative. The dashboard does not substitute the certificate's INR12,731.85 lakh into the restated equity/TNW calculation.
- A source rounding difference of INR1,000 is retained in the FY2025 balance-sheet total check; no balancing entry is invented. FY2026 PAT + tax differs from printed PBT by INR1,000; formula calculations use the PDF's PAT-based definition.
- Gross annual principal repayments, eligible drawing-power inputs, promoter personal net worth and invoice-level ageing are not established. Net borrowing cash flows and later EMI schedules cannot replace annual DSCR debt service. No CIBIL/CMR report was supplied; no score is inferred.
- Projected CMA data is kept separate from audited actuals and is not used to manufacture missing historical values.

## Financial source mapping

- FY2023-24: source ID **083**, FY2024-25 audit report, prior-year columns on pages **61–63**; retained earnings page **70**. Scan values were OCR extracted and relevant statements visually checked.
- FY2024-25 restated: source ID **086**, FY2025-26 financial filing, comparative columns on pages **2, 4, 5 and 17**.
- FY2025-26: source ID **086**, pages **2, 4, 5 and 17**.
- Loan schedule: source ID **163**, workbook dated 30 June 2026.

## Data, validation and refresh

`ExtractedData` contains CSV snapshots. The Power Query model embeds those snapshots, so it does not depend on the Downloads ZIP or a cloud data source. Power BI Refresh reloads the embedded data; it **does not** re-extract changed PDFs. The extraction/build scripts and original source copies remain one directory above this deliverable.

`Validation.json` records report schemas, model bindings, page bounds, data controls and Desktop checks. `BankBalanceChecks.json` records per-statement balance validation. The separate overlap file above the deliverable retains excluded duplicates for audit.

Nothing was published or sent to a third party. The previous Royal Enterprises dashboard and the application's `backend`/`src` files were not modified.
