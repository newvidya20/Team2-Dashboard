import json, pathlib
OUT=pathlib.Path(__file__).resolve().parent/'output'
M=[]
def add(name,expr,folder,fmt='#,0.00;(#,0.00);–',desc=None,table='Financials'):
    M.append(dict(name=name,expression=expr,tableName=table,displayFolder=folder,formatString=fmt,description=desc or name))
def sumcol(t,c): return f"SUM('{t}'[{c}])"
for n,c in [('GST Revenue','Revenue'),('GST Purchases','Purchases and Expenses'),('GST Exports','Export Revenue'),('GST Domestic Revenue','Domestic Revenue')]:
    add(n,sumcol('GST Monthly',c),'GST',table='GST Monthly')
add('GST Margin','[GST Revenue]-[GST Purchases]','GST',table='GST Monthly')
add('Export Share','DIVIDE([GST Exports],[GST Revenue])','GST','0.0%',table='GST Monthly')
add('GST Margin Share','DIVIDE([GST Margin],[GST Revenue])','GST','0.0%',table='GST Monthly')
add('GST TTM Revenue',"CALCULATE([GST Revenue], REMOVEFILTERS('Calendar'), DATESBETWEEN('Calendar'[Month],DATE(2023,10,1),DATE(2024,9,1)))",'GST','#,0.00',table='GST Monthly')
for role,n in [('Buyer','Buyer Sales'),('Supplier','Supplier Purchases')]:
    add(n,f"CALCULATE(SUM('GST Parties'[Amount]),KEEPFILTERS('GST Parties'[Role]=\"{role}\"))",'Counterparties',table='GST Parties')
    add(n+' Share',f"DIVIDE([{n}],CALCULATE([{n}],REMOVEFILTERS('GST Parties'[Party]),REMOVEFILTERS('GST Parties'[GSTIN]),REMOVEFILTERS('GST Parties'[Party Key])))",'Counterparties','0.0%',table='GST Parties')
add('Party Amount',sumcol('GST Parties','Amount'),'Counterparties',table='GST Parties')
add('Party Share',"DIVIDE([Party Amount],CALCULATE([Party Amount],REMOVEFILTERS('GST Parties'[Party]),REMOVEFILTERS('GST Parties'[Party Key]),REMOVEFILTERS('GST Parties'[GSTIN])))",'Counterparties','0.0%',desc='Share of selected role and time period, removing party identity filters.',table='GST Parties')
add('State Revenue',"CALCULATE(SUM('GST State'[Amount]),KEEPFILTERS('GST State'[Type]=\"Revenue\"))",'GST',table='GST State')
add('State Purchases',"CALCULATE(SUM('GST State'[Amount]),KEEPFILTERS('GST State'[Type]=\"Purchases\"))",'GST',table='GST State')
for n,c in [('Gross Inflows','Credit'),('Gross Outflows','Debit')]: add(n,sumcol('Bank Transactions',c),'Banking',table='Bank Transactions')
add('Net Cash Flow','[Gross Inflows]-[Gross Outflows]','Banking',table='Bank Transactions')
add('Credit Entries',"COUNTROWS('Bank Transactions')-COUNTROWS(FILTER('Bank Transactions','Bank Transactions'[Debit]<>0))",'Banking','#,0',desc='Every consolidated row is one-sided. Four all-zero rows are explicitly zero-value CREDIT entries in source. Count all rows except nonzero debit entries; reconciles to 237.',table='Bank Transactions')
add('Debit Entries',"COUNTROWS(FILTER('Bank Transactions','Bank Transactions'[Debit]<>0))",'Banking','#,0',desc='Nonzero debit-side entries including signed reversals; all zero-value rows in this source are credit entries. Reconciles to 645.',table='Bank Transactions')
add('Transaction Count',"COUNTROWS('Bank Transactions')",'Banking','#,0',table='Bank Transactions')
add('Cash Deposits',"CALCULATE([Gross Inflows],'Bank Transactions'[Category]=\"Cash Deposit\")",'Banking',table='Bank Transactions')
add('Unidentified Inflows',"CALCULATE([Gross Inflows],'Bank Transactions'[Party Key]=\"UNIDENTIFIED\")",'Banking',table='Bank Transactions')
for n,c in [('Banking Turnover','Net Credits'),('Net Bank Outflows','Net Debits'),('Net Credit Entries','Net Credit Count'),('Cheque Return Count','Inward Bounce Count'),('Cheque Return Amount','Inward Bounce Amount'),('EMI Return Count','EMI Bounce Count'),('Penal Charges','Penal Charges'),('Loan Disbursements','Loan Disbursements'),('EMI Payments','EMI Payments'),('Bank Interest Paid','Interest Paid')]:
    add(n,sumcol('Bank Monthly',c),'Banking', '#,0' if 'Count' in n or 'Entries' in n else '#,0.00',desc='Consolidated MoM Summary: '+c+'. Blank means not reported.',table='Bank Monthly')
add('Internal Debit',sumcol('Internal Transfers','Debit'),'Banking',table='Internal Transfers')
add('Internal Credit',sumcol('Internal Transfers','Credit'),'Banking',table='Internal Transfers')
add('Internal Transfer Count',"COUNTROWS('Internal Transfers')",'Banking','#,0',table='Internal Transfers')
add('Filings Reviewed',"COUNTROWS('GST Filings')",'Compliance','#,0',table='GST Filings')
add('Late Filings',"COUNTROWS(FILTER('GST Filings','GST Filings'[Delay Days]>0))",'Compliance','#,0',table='GST Filings')
add('Late Filing Share','DIVIDE([Late Filings],[Filings Reviewed])','Compliance','0.0%',table='GST Filings')
add('Maximum Filing Delay',"MAX('GST Filings'[Delay Days])",'Compliance','0 "days"',table='GST Filings')
add('Average Filing Delay',"AVERAGE('GST Filings'[Delay Days])",'Compliance','0.0 "days"',table='GST Filings')
add('Historical Red Flags',"COUNTROWS(FILTER('Source Flags','Source Flags'[Severity]=\"Red\"))",'Compliance','#,0',table='Source Flags')
add('Missing Requirements',"COUNTROWS(FILTER('Review Coverage','Review Coverage'[Status]=\"Missing source\"))",'Coverage','#,0',table='Review Coverage')
add('Requirements Reviewed',"COUNTROWS('Review Coverage')",'Coverage','#,0',table='Review Coverage')
add('Coverage Count',"COUNTROWS('Review Coverage')",'Coverage','#,0',table='Review Coverage')

for n,c in [('Common GST Sales','GST Sales'),('Common GST Purchases','GST Purchases'),('Common Bank Receipts','Bank Receipts'),('Common Bank Payments','Bank Payments'),('Sales Cash Variance','Sales Less Receipts'),('Purchases Cash Variance','Purchases Less Payments')]:
    add(n,sumcol('Party Reconciliation',c),'Reconciliation',desc='Apr-Sep2024 taxable GST values vs gross bank cash; variance is not an outstanding balance.',table='Party Reconciliation')
add('Unmatched Bank Receipts',"CALCULATE([Common Bank Receipts],FILTER('Party Reconciliation','Party Reconciliation'[Match Status]<>\"Exact normalized name\"))",'Reconciliation',table='Party Reconciliation')
add('Matched Name Receipts',"CALCULATE([Common Bank Receipts],'Party Reconciliation'[Match Status]=\"Exact normalized name\")",'Reconciliation',table='Party Reconciliation')
add('Name Match Coverage','DIVIDE([Matched Name Receipts],[Common Bank Receipts])','Reconciliation','0.0%',table='Party Reconciliation')

# Financial measures default to the latest selected fiscal year; never sum balance-sheet years.
for c in ['Sales','Total Income','Total Expenses','Net Profit','Profit Before Tax','Interest','Current Tax','Deferred Tax','Depreciation and Amortization','Reported EBITDA','Other Income','Purchases','Inventory Change','Material Consumed','Equity','Long Term Debt','Short Term Debt','Unsecured Long Term Debt','Unsecured Short Term Debt','Current Assets','Current Liabilities','Inventory','Debtors','Creditors','Intangible Assets','Retained Earnings Proxy','Non Current Liabilities','Total Assets']:
    add('FY '+c,f"VAR Y = MAX('Financials'[Financial Year]) RETURN CALCULATE(SUM('Financials'[{c}]),'Financials'[Financial Year]=Y)",'Financial / Inputs',desc=c+' from latest fiscal year in filter context; detailed audited statement schedule.')
for n,e,fmt,desc in [
('EBIT','[FY Net Profit]+[FY Interest]+[FY Current Tax]+[FY Deferred Tax]','#,0.00','PDF EBIT definition; includes non-operating other income.'),
('EBITDA - PDF EBITA','[EBIT]+[FY Depreciation and Amortization]','#,0.00','PDF calls this EBITA but adds depreciation AND amortization; shown as EBITDA. Includes other income.'),
('Operating EBIT','[EBIT]-[FY Other Income]','#,0.00','EBIT less Other Income; separate from the PDF operating-profit formula which equals EBIT.'),
('Net Profit Recomputed','[FY Total Income]-[FY Total Expenses]-[FY Current Tax]-[FY Deferred Tax]','#,0.00','After-tax income less expenses, reconciled to supplied PAT. Total Expenses excludes tax.'),
('PAT Check','[Net Profit Recomputed]-[FY Net Profit]','#,0.00','Should be zero; detects statement arithmetic discrepancies.'),
('Total Debt','[FY Long Term Debt]+[FY Short Term Debt]','#,0.00','Interest-bearing borrowings; includes disclosed unsecured debt.'),
('Unsecured Debt','[FY Unsecured Long Term Debt]+[FY Unsecured Short Term Debt]','#,0.00','Included in total debt; do not add twice for standard leverage.'),
('Tangible Net Worth','[FY Equity]-[FY Intangible Assets]','#,0.00','Equity less disclosed intangible assets.'),
('Outside Liabilities','[FY Current Liabilities]+[FY Non Current Liabilities]','#,0.00','All current and non-current liabilities.'),
('Current Ratio','DIVIDE([FY Current Assets],[FY Current Liabilities])','0.00"x"','Closing current assets/current liabilities; working capital ratio uses same definition.'),
('Working Capital Ratio','[Current Ratio]','0.00"x"','PDF definition equals Current Ratio.'),
('Quick Ratio','DIVIDE([FY Current Assets]-[FY Inventory],[FY Current Liabilities])','0.00"x"','Closing current assets less inventory/current liabilities.'),
('Debt Equity Ratio','DIVIDE([Total Debt],[FY Equity])','0.00"x"','Debt already includes unsecured borrowings.'),
('Adjusted Debt Equity Ratio','[Debt Equity Ratio]','0.00"x"','No additional off-balance unsecured debt supplied; avoids double-counting debt.'),
('PDF Literal Adjusted Debt Equity','DIVIDE([Total Debt]+[Unsecured Debt],[FY Equity])','0.00"x"','Literal PDF formula; may double count disclosed unsecured debt, shown for traceability.'),
('Interest Coverage Ratio','DIVIDE([EBIT],[FY Interest])','0.00"x"','PAT-based EBIT (including other income)/finance costs. Source ratio uses a different numerator.'),
('Operating Interest Coverage','DIVIDE([Operating EBIT],[FY Interest])','0.00"x"','Core operating EBIT excluding other income/finance costs; comparable to provider interest coverage.'),
('TOL TNW Ratio','DIVIDE([Outside Liabilities],[Tangible Net Worth])','0.00"x"','Total outside liabilities/tangible net worth.'),
('Net Profit Margin','DIVIDE([FY Net Profit],[FY Sales])','0.00%','PAT/revenue from operations.'),
('Debt EBITDA Ratio','DIVIDE([Total Debt],[EBITDA - PDF EBITA])','0.00"x"','Total debt/PAT-based EBITDA including other income.'),
('Debt Reported EBITDA','DIVIDE([Total Debt],[FY Reported EBITDA])','0.00"x"','Total debt/source EBITDA excluding other income.'),
('Reserves Equity Proxy','DIVIDE([FY Retained Earnings Proxy],[FY Equity])','0.00%','Reserves and surplus/equity; retained earnings cannot be separately identified.'),
('Debtor Days','DIVIDE([FY Debtors],[FY Sales])*365','0.0" days"','Closing debtors/revenue from operations x365. Credit sales unavailable.'),
('Creditor Days','DIVIDE([FY Creditors],[FY Purchases])*365','0.0" days"','Closing creditors/purchases of stock in trade x365. Credit purchases unavailable.'),
('COGS','[FY Material Consumed]+[FY Purchases]+[FY Inventory Change]','#,0.00','Materials consumed + purchases + signed inventory change.'),
('Stock Days','DIVIDE([FY Inventory],[COGS])*365','0.0" days"','Closing inventories/COGS x365.'),
('Working Capital','[FY Current Assets]-[FY Current Liabilities]','#,0.00','Closing current assets less current liabilities.'),
('EBITDA Definition Difference','[EBITDA - PDF EBITA]-[FY Reported EBITDA]','#,0.00','Difference should equal Other Income; source definitions exposed.'),
]: add(n,e,'Financial / Ratios' if ('Ratio' in n or 'Days' in n or 'Coverage' in n or 'Margin' in n) else 'Financial / Calculations',fmt,desc)
for n,desc in [('DSCR','Annual principal repayment not supplied.'),('Promoter Net Worth','No promoter personal financial statement.'),('Drawing Power','No eligible-stock/debtor ageing or lending margins.'),('OCF Interest Ratio','No operating cash flow statement.'),('CC Utilisation','No sanction-limit or utilisation schedule.'),('CIBIL CMR Score','No credit score report supplied.'),('GST Late Fees','No GST late-fee amounts supplied.')]:
    add(n,'BLANK()','Missing Evidence','#,0.00',desc)
for m in M:
    if m['name'] in ['Penal Charges','Loan Disbursements','EMI Payments']: m['tableName']='Bank Transactions'
(OUT/'measure-definitions.json').write_text(json.dumps(M,indent=2),encoding='utf-8')
print(f'{len(M)} measures prepared')
