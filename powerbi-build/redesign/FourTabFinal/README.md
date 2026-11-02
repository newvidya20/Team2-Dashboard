# Sarangi Credit Review — four-tab edition

Open **SarangiCreditReview_4Tabs.pbip** in Power BI Desktop.

The report has exactly four tabs:

1. **GST** — selected-period adjusted sales/purchases, exports, filing delays, monthly trend, state revenue, six largest buyers/suppliers, concentration and filing-date trail.
2. **Finance** — selected-year statement KPIs, three-year trends, prior-year statement comparison and evidence-based SWOT. The financial-year selector is synchronized with Financial Calculations. No year selection defaults to FY2023-2024; the heading states the year actually used.
3. **Banking** — consolidated month-filtered inflows, source net-credit BTO, credit entries, inward returns, cash conduct, party flows, internal transfers and evidence gaps. The GST-bank table deliberately stays on the shared April–September 2024 period, independent of the banking month selector.
4. **Financial Calculations** — all 25 numbered PDF parameters, with formula, result, evidence status and interpretation. Results show lakh, ratios, percentages or days explicitly. Missing inputs remain “Not available”.

## Units and scope

Dashboard monetary figures are in **INR crore**, except the penal-charge result labelled INR. Currency results in the detailed calculation register are in **INR lakh**. Source dates are historical: financial statements FY2021-22 to FY2023-24; GST taxable values August 2022–September 2024; banking April–December 2024 with missing statement dates. Filing dates can occur after the tax period shown.

Finance uses detailed statement values. Statement growth is shown only for positive prior-year bases; the first supplied financial year has no prior-year comparison. Selecting a year changes statement KPIs without reducing the three-year trend to a single point.

## Credit interpretation

- The PDF's EBITA formula adds both depreciation and amortization, so it is labelled EBITDA. Its numerator includes other income. The Finance tab instead uses source operating EBITDA; the register explains the distinction.
- PDF operating profit equals EBIT under the supplied formula. Core operating interest cover excludes other income and is distinguished from PDF EBIT-based cover.
- Net profit is reconciled after current/deferred taxes because the source expense line excludes income tax.
- Total debt includes disclosed unsecured borrowings. The literal PDF adjusted-debt ratio is retained with its double-counting caveat.
- Reserves/surplus divided by equity is explicitly a retained-earnings proxy.
- Annual principal repayments are missing, so DSCR is unavailable. Drawing power, operating cash-flow coverage, invoice ageing, promoter personal net worth and CIBIL/CMR scores are not fabricated.
- GST late fees, HSN details, sanction-limit/CC utilisation and authoritative related-party transaction mapping remain evidence gaps.
- Bank gross credits are INR399,320,401.56, gross debits INR598,733,971.26 and source net credits/BTO INR350,006,898.64. There are 882 consolidated entries: 237 credit entries (including four explicitly zero-value credits) and 645 debit entries. Repeated account-level blocks are excluded.
- The reconciliation uses normalized exact names only. GST values exclude tax; bank cash includes financing, transfers and timing differences. The comparison is not an outstanding-debtor balance or confirmed invoice settlement.
- SWOT observations use selected-year figures and explicitly historical provider flags. No automatic sanction recommendation or unsupported credit score is produced.

## Snapshot and validation

Values are embedded snapshots of the supplied Excel files. **Power BI Refresh reloads the embedded snapshot, not revised Excel workbooks.** Source updates require re-extraction and model-expression updates. Original workbooks are unchanged.

The previous report is retained separately. Build sources and the pre-redesign archive are in `C:\Users\loanb\OneDrive\Desktop\Team 2\powerbi-build`.

Validation covers all 25 calculation rows, all three financial-year comparisons, selected-year versus three-year trend behavior, banking count/totals, missing-evidence outputs, four-page count, field bindings and Microsoft PBIR schemas.
