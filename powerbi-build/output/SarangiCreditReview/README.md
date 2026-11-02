# Sarangi Credit Review

Open `SarangiCreditReview.pbip` in Power BI Desktop. If the first opening shows unprocessed data, select Home > Refresh. Save to preserve the imported cache. You can also save a PBIX from Desktop.

Eight pages cover the executive view, GST performance, buyer/supplier concentration, banking behaviour, GST-bank party reconciliation, financial ratios, filing compliance, and evidence coverage. The report includes 13 imported tables, eight month relationships and 118 measures.

## Source and reporting periods

Source folder: `C:\Users\loanb\OneDrive\Desktop\Power BI`.

- Requirements: `CREDIT DUE DILIGENCE – REVIEW PARAMETERS 21.9.2026.pdf`.
- Banking workbook: consolidated raw data only, April–December 2024; repeated account blocks excluded. Source notes missing statement dates.
- GST workbook: monthly detail August 2022–September 2024; filing details extend through November 2024. Annual and TTM repeat columns are excluded from monthly facts.
- Financial workbook: detailed statement sheets 7/8, FY2021-22 to FY2023-24. Provider source ratios and flags retained separately.

All monetary values are INR. Flow chart axes use units of 10,000,000 (crore); cards display full INR. This is historical source evidence, not current 2026 performance.

## Snapshot behavior

The model embeds compressed, typed snapshots of the extracted Excel values. It opens without workbook path/credential dependencies. **Power BI Refresh reloads that embedded snapshot; it does not reread the Excel workbooks.** The CSVs in `CreditReviewData` are an auditable copy of those snapshots. Original workbooks were not edited.

Build sources are retained under `C:\Users\loanb\OneDrive\Desktop\Team 2\powerbi-build`. `build_data.py` extracts and validates source populations; `build_measures.py` defines DAX; `build_report.py` builds PBIR pages; `validate_report.py` validates against downloaded Microsoft schemas. Source changes require rerunning extraction and updating model partition expressions through MCP or TMDL before reopening/refreshing the report. Reconciliation cutoffs and review notes must also be reviewed when source periods change.

## Definitions and evidence limits

- Bank gross credits ₹399,320,401.56; gross debits ₹598,733,971.26; source net credits/BTO ₹350,006,898.64. All 882 consolidated transactions retained, including signed reversals. Credit count 237, debit count 645.
- BTO and returns use consolidated MoM metrics; account slicers affect raw transaction visuals only. This scope difference is stated on the banking page.
- Party reconciliation covers April–September 2024 only. It ignores case, punctuation and whitespace in names. No fuzzy matching, invoice-level matching or inferred GSTIN mapping. Bank-only/unidentified parties remain visible.
- Reconciliation compares GST taxable sales/purchases to gross cash receipts/payments, which may include tax, transfers, financing and timing differences. Variances are **not** outstanding balances or proof of irregularity. Exact normalized names identify candidates, not confirmed settlements.
- PDF “EBITA” adds depreciation and amortization; the report labels this “EBITDA - PDF EBITA.” The PAT-derived numerator includes other income; source-reported EBITDA is separate. The difference reconciles to Other Income in all three financial years.
- PAT is reconciled after current and deferred taxes because supplied Total Expenses excludes tax. All three years reconcile to zero difference.
- Financial measures use the latest financial year in context, rather than summing balance sheets across years. Debtor/creditor/stock days use closing balances and stated sales/purchases/COGS proxies.
- Total debt includes disclosed unsecured debt. Standard adjusted debt/equity avoids double counting; the literal PDF variant remains available separately.
- Reserves and surplus/equity is labelled a proxy; no separate retained earnings schedule or promoter personal statements were supplied.
- DSCR, drawing power, operating cash-flow coverage, CC utilisation, GST late fees and CIBIL/CMR scores remain blank where source evidence is missing. HSN detail and invoice ageing are unavailable. Provider “no defaults reported” is not treated as proof of clean bureau status.
- GST filing delays use supplied due/filing dates; this report does not independently establish statutory due dates. Flags are historical provider claims as of December 2024 and require verification.

## Validation

Bank totals and transaction counts reconcile to consolidated MoM values. GST state/party aggregates reconcile to their corresponding revenue/purchase bases; buyers exclude export turnover. DAX was executed successfully for all 118 measures. All three financial years pass PAT and EBITDA-definition arithmetic checks. The 109 PBIR definition files pass Microsoft JSON schema validation, visual field binding checks and page boundary checks. These checks do not substitute for a final visual review in Power BI Desktop.
