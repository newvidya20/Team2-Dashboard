"""Four-tab credit review: presentation helpers and all 25 PDF parameters."""
import json,pathlib,gzip,base64
BASE=pathlib.Path(__file__).resolve().parent
OUT=BASE/'redesign'; OUT.mkdir(exist_ok=True)
tables={}; measures=[]
def table(n,cols,rows,desc): tables[n]={'columns':cols,'rows':rows,'description':desc}
def add(n,e,fmt='0.00',t='Financials',desc=None): measures.append({'name':n,'expression':e,'formatString':fmt,'tableName':t,'displayFolder':'Credit Review','description':desc or n})
table('Review Year',[('Financial Year','String')],[['2021-2022'],['2022-2023'],['2023-2024']],'Disconnected year selector: KPIs use selected year, while trend charts retain all three financial years.')
statement=[
 (1,'Profit & loss','Operating revenue','FY Sales'),(2,'Profit & loss','Other income','FY Other Income'),(3,'Profit & loss','Total income','FY Total Income'),
 (4,'Profit & loss','Operating EBITDA · source','FY Reported EBITDA'),(5,'Profit & loss','Depreciation & amortization','FY Depreciation and Amortization'),(6,'Profit & loss','Finance costs','FY Interest'),
 (7,'Profit & loss','Profit before tax','FY Profit Before Tax'),(8,'Profit & loss','Profit after tax','FY Net Profit'),
 (9,'Balance sheet','Tangible net worth','Tangible Net Worth'),(10,'Balance sheet','Interest-bearing debt','Total Debt'),(11,'Balance sheet','Current assets','FY Current Assets'),
 (12,'Balance sheet','Current liabilities','FY Current Liabilities'),(13,'Balance sheet','Trade receivables','FY Debtors'),(14,'Balance sheet','Trade payables','FY Creditors'),
 (15,'Balance sheet','Inventory','FY Inventory'),(16,'Balance sheet','Net working capital','Working Capital'),(17,'Balance sheet','Total assets','FY Total Assets')]
table('Statement Layout',[('Order','Int64'),('Statement','String'),('Line Item','String'),('Metric','String')],[list(r) for r in statement],'Statement comparison layout; all amounts derive from supplied statements, no synthetic balancing items.')
table('Credit Notes',[('Order','Int64'),('Topic','String')],[[1,'Strength'],[2,'Weakness'],[3,'Opportunity'],[4,'Threat']],'Evidence-based SWOT. Selected-year profitability/ratios plus explicitly historical source flags. No automatic approval score or unsupported risk thresholds.')
calc=[
(1,'Profitability','EBIT','PAT + interest + current/deferred tax','EBIT','Currency','Calculated','Includes other income. Core operating EBIT is available separately.'),
(2,'Profitability','EBITDA (PDF: EBITA)','PAT + interest + tax + depreciation/amortization','EBITDA - PDF EBITA','Currency','Calculated','PDF calls this EBITA but adds depreciation and amortization. Includes other income.'),
(3,'Profitability','Net profit after tax','Total income − expenses − current/deferred tax','FY Net Profit','Currency','Calculated','Expenses in source exclude income tax. PAT reconciles after tax.'),
(4,'Profitability','Operating profit · PDF definition','PAT + interest + current/deferred tax','EBIT','Currency','Definition caveat','Equals EBIT under the PDF formula; includes other income. Core operating EBIT excludes other income.'),
(5,'Capital','Promoter net worth','Personal assets − personal liabilities','','Currency','Missing evidence','Promoter personal asset/liability statements not supplied. Corporate net worth cannot substitute.'),
(6,'Debt service','DSCR','(PAT + D&A + interest) / (principal repayment + interest)','','Ratio','Missing evidence','Annual principal repayments missing. Later-period banking EMI payments cannot substitute.'),
(7,'Liquidity','Current ratio','Current assets / current liabilities','Current Ratio','Ratio','Calculated','Closing balances; measure also equals PDF working capital ratio.'),
(8,'Liquidity','Quick ratio','(Current assets − inventory) / current liabilities','Quick Ratio','Ratio','Calculated','No additional prepaid-expense adjustment is specified by the PDF.'),
(9,'Capital','Debt / equity','Interest-bearing debt / corporate equity','Debt Equity Ratio','Ratio','Calculated','Corporate equity is used. Disclosed unsecured debt is already included in total debt.'),
(10,'Capital','Adjusted debt / equity · PDF','(Total debt + unsecured loans) / equity','PDF Literal Adjusted Debt Equity','Ratio','Definition caveat','Literal PDF formula can double count unsecured debt. Standard debt/equity is shown separately; source unsecured borrowings are zero.'),
(11,'Debt service','Interest coverage · PDF EBIT','EBIT including other income / finance costs','Interest Coverage Ratio','Ratio','Calculated','Core operating interest coverage is also shown in the headline cards for a stricter operating view.'),
(12,'Capital','TOL / tangible net worth','(Current + noncurrent liabilities) / (equity − intangibles)','TOL TNW Ratio','Ratio','Calculated','Uses all outside liabilities; intangible assets deducted from net worth.'),
(13,'Profitability','Net profit / sales','PAT / revenue from operations','Net Profit Margin','Percent','Calculated','Shown as a percentage.'),
(14,'Debt service','Debt / EBITDA · PDF','Total debt / PAT-derived EBITDA','Debt EBITDA Ratio','Ratio','Calculated','PDF EBITDA includes other income. Source-EBITDA leverage is shown separately.'),
(15,'Debt service','Operating cash flow / interest','Operating cash flow / finance costs','','Ratio','Missing evidence','No operating cash-flow statement supplied.'),
(16,'Capital','Retained earnings / equity','Reserves and surplus / equity','Reserves Equity Proxy','Percent','Proxy only','Separate retained earnings not disclosed. Reserves and surplus is an explicit proxy.'),
(17,'Working capital','Debtor collection period','Closing debtors / sales × 365','Debtor Days','Days','Calculated','Credit sales unavailable; closing trade receivables used.'),
(18,'Working capital','Creditor payment period','Closing creditors / purchases × 365','Creditor Days','Days','Calculated','Uses purchases of stock in trade, consistent with PDF denominator.'),
(19,'Working capital','Stock holding period','Closing inventory / COGS × 365','Stock Days','Days','Calculated','COGS = material consumed + purchases + signed inventory change.'),
(20,'Liquidity','Working capital ratio','Current assets / current liabilities','Working Capital Ratio','Ratio','Calculated','Identical to current ratio under the PDF definition; net working capital is a separate amount.'),
(21,'Working capital','Drawing power','Eligible stock + eligible debtors − creditors','','Currency','Missing evidence','Eligibility ageing, security margins and eligible stock/debtor schedules absent.'),
(22,'Banking','Banking trend analysis','Inflows/outflows, internal transfers and return trends','','Text','Banking tab','April–December 2024 banking data; displayed separately from selected annual financial statements.'),
(23,'Working capital','Invoice ageing','Invoice due dates vs unpaid invoice balances','','Text','Missing evidence','No invoice-level dates, outstanding ledger or settlement allocation supplied.'),
(24,'Credit review','CIBIL / CMR analysis','Verified credit bureau report','','Text','Missing evidence','No score/CMR report supplied. Source no-default narrative is not a bureau clearance.'),
(25,'Credit review','Evidence-based SWOT','Source-linked strengths, weaknesses and follow-up','','Text','Finance tab','Statement growth/profitability, leverage, debt servicing and historical provider flags; no invented bureau score or sanction recommendation.')]
table('Calculation Register',[('No','Int64'),('Category','String'),('Parameter','String'),('Formula','String'),('Metric','String'),('Unit','String'),('Evidence Status','String'),('Interpretation','String')],[list(r) for r in calc],'All 25 numbered financial/credit parameters in the supplied credit due diligence PDF; definition caveats and missing evidence are explicit.')

add('Review Financial Year',"SELECTEDVALUE('Review Year'[Financial Year],\"2023-2024\")",'General')
# The disconnected selector changes statement KPIs while chart axes keep the complete trend.
updates=[]
orig=json.loads((BASE/'output'/'measure-definitions.json').read_text())
for m in orig:
    if m['name'].startswith('FY '):
        c=m['name'][3:]
        updates.append({'name':m['name'],'tableName':'Financials','expression':f"VAR Y=IF(ISINSCOPE('Financials'[Financial Year]),MAX('Financials'[Financial Year]),[Review Financial Year]) RETURN CALCULATE(SUM('Financials'[{c}]),'Financials'[Financial Year]=Y)",'description':'Selected Review Year for cards; financial-year axis for trend charts. Default FY2023-2024.'})
for n,source in [('GST Revenue Cr','GST Revenue'),('GST Purchases Cr','GST Purchases'),('GST Exports Cr','GST Exports'),('Buyer Sales Cr','Buyer Sales'),('Supplier Purchases Cr','Supplier Purchases'),('State Revenue Cr','State Revenue'),('Party Amount Cr','Party Amount'),('Bank Inflows Cr','Gross Inflows'),('Bank Outflows Cr','Gross Outflows'),('BTO Cr','Banking Turnover'),('Bank Net Flow Cr','Net Cash Flow'),('Cash Deposits Cr','Cash Deposits'),('Loan Disbursements Cr','Loan Disbursements'),('EMI Payments Cr','EMI Payments'),('Internal Debit Cr','Internal Debit'),('Internal Credit Cr','Internal Credit'),('Return Amount Cr','Cheque Return Amount'),('Common GST Sales Cr','Common GST Sales'),('Common Receipts Cr','Common Bank Receipts'),('Common GST Purchases Cr','Common GST Purchases'),('Common Payments Cr','Common Bank Payments'),('Finance Revenue Cr','FY Sales'),('Finance PAT Cr','FY Net Profit'),('Finance EBITDA Cr','FY Reported EBITDA'),('Finance TNW Cr','Tangible Net Worth'),('Finance Debt Cr','Total Debt'),('Finance Assets Cr','FY Current Assets'),('Finance Liabilities Cr','FY Current Liabilities')]:
    add(n,f'DIVIDE([{source}],10000000)','0.00;[Red](0.00);0.00')
add('GST Period',"VAR A=MIN('GST Monthly'[Month]) VAR B=MAX('GST Monthly'[Month]) RETURN IF(ISBLANK(A),\"No GST data in selection\",FORMAT(A,\"MMM yyyy\") & \" – \" & FORMAT(B,\"MMM yyyy\"))",'General')
add('Bank Period',"VAR A=MIN('Bank Monthly'[Month]) VAR B=MAX('Bank Monthly'[Month]) RETURN IF(ISBLANK(A),\"No banking data in selection\",FORMAT(A,\"MMM yyyy\") & \" – \" & FORMAT(B,\"MMM yyyy\"))",'General')
add('Top Buyer Cr',"VAR R=RANKX(ALLSELECTED('GST Parties'[Party]),[Buyer Sales],,DESC,DENSE) RETURN IF(R<=6,[Buyer Sales Cr])",'0.00')
add('Top Supplier Cr',"VAR R=RANKX(ALLSELECTED('GST Parties'[Party]),[Supplier Purchases],,DESC,DENSE) RETURN IF(R<=6,[Supplier Purchases Cr])",'0.00')
add('Top Bank Receipts Cr',"VAR R=RANKX(ALLSELECTED('Bank Transactions'[Party]),[Gross Inflows],,DESC,DENSE) RETURN IF(R<=6,[Bank Inflows Cr])",'0.00')
add('Source Penal Charges',"IF(ISBLANK([Penal Charges]),\"Not reported\",\"₹ \" & FORMAT([Penal Charges],\"#,0.00\"))",'General')
add('Return Summary',"FORMAT([Cheque Return Count],\"0\") & \" inward returns · ₹\" & FORMAT([Cheque Return Amount]/100000,\"0.00\") & \" lakh\"",'General')
add('EMI Return Display',"IF(ISBLANK([EMI Return Count]),\"Not reported\",FORMAT([EMI Return Count],\"0\"))",'General')
add('Name Match Display',"FORMAT([Name Match Coverage],\"0.0%\") & \" of receipts have an exact GST party name\"",'General')
add('Finance Sales Growth',"VAR Y=VALUE(LEFT([Review Financial Year],4))-1 VAR P=FORMAT(Y,\"0000\") & \"-\" & FORMAT(Y+1,\"0000\") VAR V=CALCULATE(SUM('Financials'[Sales]),REMOVEFILTERS('Financials'),'Financials'[Financial Year]=P) RETURN IF(NOT ISBLANK(V),DIVIDE([FY Sales]-V,V))",'0.0%;(0.0%);0.0%')
line_switch='SWITCH(SELECTEDVALUE(\'Statement Layout\'[Metric]),'+','.join(json.dumps(m)+',['+m+']' for m in dict.fromkeys(r[3] for r in statement))+')'
add('Statement Current Cr',f'DIVIDE({line_switch},10000000)','0.00;[Red](0.00);0.00',t='Statement Layout')
add('Statement Prior Cr',"VAR Y=VALUE(LEFT([Review Financial Year],4))-1 VAR P=FORMAT(Y,\"0000\") & \"-\" & FORMAT(Y+1,\"0000\") VAR Exists=COUNTROWS(FILTER(ALL('Review Year'),'Review Year'[Financial Year]=P)) RETURN IF(Exists>0,CALCULATE([Statement Current Cr],REMOVEFILTERS('Review Year'),TREATAS({P},'Review Year'[Financial Year])))",'0.00;[Red](0.00);0.00',t='Statement Layout')
add('Statement Change',"VAR P=[Statement Prior Cr] RETURN IF(P>0,DIVIDE([Statement Current Cr]-P,P))",'0.0%;[Red](0.0%);0.0%',t='Statement Layout',desc='YoY growth only for positive prior base; negative/zero/absent prior base shown blank to avoid misleading percentages.')
add('Credit Interpretation',"SWITCH(SELECTEDVALUE('Credit Notes'[Topic]),\"Strength\",\"Reported PAT ₹\" & FORMAT([FY Net Profit]/100000,\"0.00\") & \" lakh. \" & IF(ISBLANK([Finance Sales Growth]),\"No earlier comparable revenue supplied.\",\"Revenue changed \" & FORMAT([Finance Sales Growth],\"+0.0%;-0.0%\") & \" versus prior FY.\"),\"Weakness\",\"Assess PAT margin \" & FORMAT([Net Profit Margin],\"0.00%\") & \"; debt/equity \" & FORMAT([Debt Equity Ratio],\"0.00\") & \"x; core interest cover \" & FORMAT([Operating Interest Coverage],\"0.00\") & \"x.\",\"Opportunity\",\"Obtain receivable ageing, cash-flow and principal-repayment schedules to verify collection and debt-servicing capacity.\",\"Threat\",\"Historical 2024 provider litigation and GST-delay flags require current verification. No bureau score is supplied.\")",'General',t='Credit Notes')
calc_switch='SWITCH(SELECTEDVALUE(\'Calculation Register\'[No]),'+','.join(str(r[0])+',['+r[4]+']' for r in calc if r[4])+')'
add('Calculation Numeric',calc_switch,'0.00',t='Calculation Register')
add('Calculation Result',"VAR V=[Calculation Numeric] VAR U=SELECTEDVALUE('Calculation Register'[Unit]) VAR S=SELECTEDVALUE('Calculation Register'[Evidence Status]) RETURN IF(ISBLANK(V),IF(S=\"Banking tab\",\"See Banking\",IF(S=\"Finance tab\",\"See Finance\",\"Not available\")),SWITCH(U,\"Currency\",\"₹ \" & FORMAT(V/100000,\"#,0.00\") & \" lakh\",\"Percent\",FORMAT(V,\"0.00%\"),\"Days\",FORMAT(V,\"0.0\") & \" days\",FORMAT(V,\"0.00\") & \"x\"))",'General',t='Calculation Register')
add('Calculation Evidence',"SELECTEDVALUE('Calculation Register'[Evidence Status])",'General',t='Calculation Register')
add('Calculation Color',"SWITCH(SELECTEDVALUE('Calculation Register'[Evidence Status]),\"Missing evidence\",\"#B45309\",\"Definition caveat\",\"#A34D22\",\"Proxy only\",\"#A34D22\",\"#117D75\")",'General',t='Calculation Register')
add('Calculation Count',"COUNTROWS('Calculation Register')",'0',t='Calculation Register')
add('Calculation Missing',"CALCULATE(COUNTROWS('Calculation Register'),'Calculation Register'[Evidence Status]=\"Missing evidence\")",'0',t='Calculation Register')
add('Tax and PAT Check',"IF(ABS([PAT Check])<0.01,\"PAT reconciles to statements\",\"PAT arithmetic needs review\")",'General')

for m in measures:m['formatString']=m['formatString'].replace('[Red]','')
defs=[]
for n,t in tables.items():
    payload=base64.b64encode(gzip.compress(json.dumps(t['rows'],ensure_ascii=False).encode())).decode()
    expr='let R=Json.Document(Binary.Decompress(Binary.FromText("'+payload+'",BinaryEncoding.Base64),Compression.GZip)), T=Table.FromRows(R,{'+','.join(json.dumps(c) for c,_ in t['columns'])+'}), X=Table.TransformColumnTypes(T,{'+','.join('{'+json.dumps(c)+', '+('Int64.Type' if typ=='Int64' else 'type text')+'}' for c,typ in t['columns'])+'}) in X'
    defs.append({'name':n,'description':t['description'],'mExpression':expr,'columns':[{'name':c,'sourceColumn':c,'dataType':typ,'summarizeBy':'None'} for c,typ in t['columns']]})
for name,obj in [('tables',tables),('table-definitions',defs),('new-measures',measures),('measure-updates',updates)]: (OUT/(name+'.json')).write_text(json.dumps(obj,indent=2,ensure_ascii=False),encoding='utf-8')
allm={m['name']:m for m in orig}
for m in measures: allm[m['name']]=m
for m in updates: allm[m['name']].update(m)
(OUT/'all-measures.json').write_text(json.dumps(list(allm.values()),indent=2),encoding='utf-8')
print(json.dumps({'tables':list(tables),'new_measures':len(measures),'input_updates':len(updates),'PDF_parameters':len(calc)}))
