import sys,json,re,datetime,calendar,gzip,base64,csv
from pathlib import Path
B=Path(__file__).resolve().parent
T={};M=[]
def table(name,cols,rows,description):T[name]={'columns':cols,'rows':rows,'description':description}
def measure(name,table,expression,fmt='#,0.00',description=''):
    M.append({'name':name,'tableName':table,'expression':expression,'formatString':fmt,'description':description or name})
def read(name):return (B/'text'/name).read_text(encoding='utf-8')
def nums(s):return [float(n.replace(',','')) for n in re.findall(r'-?\d[\d,]*\.\d{2}',s)]
gst=[]
for p in sorted((B/'text').glob('*GSTR3B*.txt')):
    text=p.read_text(encoding='utf-8');mm,yyyy=re.search(r'_(\d{2})(\d{4})',p.stem).groups();month=f'{yyyy}-{mm}'
    def values(pattern):
        match=re.search(pattern,text,re.S)
        if not match:raise ValueError((p.name,pattern))
        return nums(match[1])
    taxable=values(r'\(a\) Outward taxable supplies.*?exempted\)\s*([^\n]+)')
    zero=values(r'\(b\) Outward taxable supplies \(zero rated\)\s*([^\n]+)')
    exempt=values(r'\(c\s*\) Other outward supplies \(nil rated, exempted\)\s*([^\n]+)')
    nongst=values(r'\(e\) Non-GST outward supplies\s*([^\n]+)')
    itc=values(r'C\. Net ITC available \(A-B\)\s*([^\n]+)')
    late=values(r'Late fee\s+([^\n]+)')
    interest=values(r'Interest Paid\s+([^\n]+)')
    filing=datetime.datetime.strptime(re.search(r'2\(d\)\. Date of ARN\s+(\d{2}/\d{2}/\d{4})',text)[1],'%d/%m/%Y').date().isoformat()
    gst.append([month,taxable[0],exempt[0],zero[0],nongst[0],sum([taxable[0],exempt[0],zero[0],nongst[0]]),sum(taxable[1:]),sum(itc),sum(late),sum(interest),filing,p.stem.split('-',1)[1]+'.pdf'])
table('GST Monthly',[(c,t) for c,t in [('Month','String'),('Taxable Sales','Double'),('Exempt Sales','Double'),('Zero Rated Sales','Double'),('Non GST Sales','Double'),('Total Outward Supplies','Double'),('Output Tax','Double'),('Net ITC','Double'),('Late Fee','Double'),('Interest Paid','Double'),('Filed On','String'),('Source','String')]],gst,'GSTR-3B section 3.1 values. Zero-rated supplies are not independently verified export turnover. ARN date used as filing evidence; no statutory due date assumed.')
bank=json.loads((B/'bank-transactions.json').read_text(encoding='utf-8'))
bc=[('Date','String'),('Month','String'),('Bank','String'),('Sequence','Int64'),('Party','String'),('Narration','String'),('Debit','Double'),('Credit','Double'),('Balance','Double'),('Internal Match','String'),('Return Type','String'),('Cash Deposit','Double'),('Penal Charges','Double'),('Loan Credit Candidate','Double'),('BTO Eligible','Double'),('Source','String'),('Page','Int64')]
table('Bank Transactions',bc,[[r[c] for c,t in bc] for r in bank],'Original statement transactions, excluding opening balances. All consecutive running balances reconcile. Parties retain narration spelling; no fuzzy merges. Classifications are narration-based candidates unless reciprocal internal transfer confirmed.')
months=[]
for y,m in [(2025,m) for m in range(4,13)]+[(2026,m) for m in range(1,7)]:
    fy=y if m>=4 else y-1;months.append([f'{y}-{m:02d}',f'{fy}-{str(fy+1)[2:]}'])
table('Period',[('Month','String'),('Financial Year','String')],months,'GST coverage April 2025-May 2026; banking July 2025-June 2026. No data is extrapolated.')
recon=[]
for g in gst:
    tx=[r for r in bank if r['Month']==g[0]]
    if not tx:continue
    recon.append([g[0],g[5],sum(r['Credit'] for r in tx),sum(r['Credit'] for r in tx if r['Internal Match']=='Confirmed reciprocal transfer'),sum(r['Loan Credit Candidate'] for r in tx if r['Internal Match']!='Confirmed reciprocal transfer'),sum(r['BTO Eligible'] for r in tx),'Aggregate comparison only; party-level GST evidence absent'])
table('Reconciliation',[(c,t) for c,t in [('Month','String'),('GST Supplies','Double'),('Gross Bank Credits','Double'),('Internal Credits','Double'),('Loan Candidates','Double'),('Adjusted Credit Candidates','Double'),('Status','String')]],recon,'Only 11 common months, July 2025-May 2026. GST excludes taxes while bank receipts include timing differences. Gap is neither an outstanding balance nor proof of unreported sales.')
fin=[
 ['2023-24','Audited',752729622,714023643.56,7525485,2248150,20137262,3629440.44,956540.95,64151571,5401080.02,21144260.95,0,7692373,815470,80825552,8547052.17,345960,935975.75,6302065.05,99204754.97,'FY 2023-24.pdf • pages 3-4 • scan checked visually'],
 ['2024-25','Audited',2001359690,1945674788,2248150,35147582,70249274,8095371,812336.05,129525595,19909794,44938235,39619000,18035375,987955,183435254,0,345960,8660315,25426842.95,253015953.95,'FY 2024-25.pdf • pages 3-4'],
 ['2025-26','Provisional',3037197357,2920400395,35147582,55246303,115630900,10199073,690271,235009136,52688261,80201428,0,106188916,725480,342339282,0,345960,12454868,64426808,474813221,'NEERAJ GHANSHYAM CHACHLANI provisional-1 (1).pdf • pages 1-2; folder mislabels FY 2026-27']]
fc=['Financial Year','Statement Status','Sales','Purchases','Opening Inventory','Inventory','Reported Profit Before Owner Tax','Interest','Depreciation','Proprietor Capital','Secured Debt','Unsecured Debt','Friends and Relatives Debt','Creditors','Other Payables','Debtors','Loans and Advances','Gold and Ornaments','Cash and Bank','Fixed Assets','Total Assets','Source']
fd=[]
for f in fin:
    r=dict(zip(fc,f));r['Total Debt']=r['Secured Debt']+r['Unsecured Debt']+r['Friends and Relatives Debt'];r['Current Assets']=sum(r[c] for c in ['Inventory','Debtors','Loans and Advances','Gold and Ornaments','Cash and Bank']);r['Reported Current Liabilities']=r['Creditors']+r['Other Payables'];r['Outside Liabilities']=r['Total Debt']+r['Reported Current Liabilities'];r['EBIT']=r['Reported Profit Before Owner Tax']+r['Interest'];r['EBITDA']=r['EBIT']+r['Depreciation'];r['COGS']=r['Opening Inventory']+r['Purchases']-r['Inventory'];fd.append(r)
fc=list(fd[0]);table('Financials',[(c,'String' if isinstance(fd[0][c],str) else 'Double') for c in fc],[[r[c] for c in fc] for r in fd],'Proprietorship accounts. Reported profit is before proprietor income tax; no corporate PAT asserted. Debt includes friend/relative borrowing. Current ratio uses explicitly classified current liabilities, without assumed current maturities. COGS is opening inventory + purchases - closing inventory (labour/freight excluded).')
table('Finance Year',[('Financial Year','String')],[[r['Financial Year']] for r in fd],'Three statement years verified from document dates; FY2025-26 is provisional despite enclosing folder FY2026-27.')
register=[]
for r in fd:
    y=r['Financial Year'];profit=r['Reported Profit Before Owner Tax'];debt=r['Total Debt'];equity=r['Proprietor Capital'];ca=r['Current Assets'];cl=r['Reported Current Liabilities']
    lines=[
    ('EBIT','Reported pre-tax profit + interest',r['EBIT'],'INR','Calculated','Tax is not added again to pre-tax profit.'),
    ('EBITDA (PDF: EBITA)','Pre-tax profit + interest + depreciation',r['EBITDA'],'INR','Calculated','PDF adds depreciation and amortization; no separate amortization disclosed.'),
    ('Net Profit','Total income - expenses',profit,'INR','Source pre-tax profit','Before proprietor personal income tax; PAT not established.'),
    ('Operating Profit','Pre-tax profit + interest',r['EBIT'],'INR','Calculated','Equals EBIT using PDF definition.'),
    ('Promoter Net Worth','Personal assets - personal liabilities',None,'INR','Missing evidence','Business capital is not a complete personal net worth statement.'),
    ('DSCR','(PAT + D&A + interest) / (principal + interest)',None,'x','Missing evidence','Annual principal repayments and after-tax profit absent. July 2026 EMI schedule cannot replace annual debt service.'),
    ('Current Ratio','Current assets / reported current liabilities',ca/cl,'x','Classification caveat','Loan current maturities are not split out in supplied balance sheets.'),
    ('Quick Ratio','(Current assets - inventory) / reported current liabilities',(ca-r['Inventory'])/cl,'x','Classification caveat','Includes source current assets; current loan maturities not disclosed.'),
    ('Debt-Equity Ratio','Total debt / proprietor capital',debt/equity,'x','Calculated','Total debt includes secured, unsecured and friends/relatives.'),
    ('Adjusted Debt-Equity (literal PDF)','(Total debt + unsecured loans) / capital',(debt+r['Unsecured Debt']+r['Friends and Relatives Debt'])/equity,'x','Double-counting caveat','Literal PDF adds unsecured debt already in total debt; standard debt/equity is parameter 9.'),
    ('Interest Coverage','EBIT / interest',r['EBIT']/r['Interest'],'x','Calculated','Interest from annual P&L, not the later EMI schedule.'),
    ('TOL / TNW','Outside liabilities / tangible proprietor capital',r['Outside Liabilities']/equity,'x','Calculated','No intangible line disclosed; capital used as tangible business net worth.'),
    ('Net Profit / Sales','Reported pre-owner-tax profit / sales',profit/r['Sales'],'%','Pre-tax basis','Not an after-tax margin.'),
    ('Debt / EBITDA','Total debt / EBITDA',debt/r['EBITDA'],'x','Calculated','Closing debt and annual EBITDA.'),
    ('Operating Cash Flow / Interest','Operating cash flow / interest',None,'x','Missing evidence','Cash-flow statement not supplied.'),
    ('Retained Earnings / Equity','Retained earnings / equity',None,'%','Not separately disclosed','Proprietorship capital does not identify corporate retained earnings.'),
    ('Debtor Collection Period','Closing debtors / sales x 365',r['Debtors']/r['Sales']*365,'days','Closing balance proxy','Credit-sales split and opening debtor balances unavailable.'),
    ('Creditor Payment Period','Closing creditors / purchases x 365',r['Creditors']/r['Purchases']*365,'days','Closing balance proxy','Trade purchase denominator from trading account.'),
    ('Stock Holding Period','Closing inventory / COGS x 365',r['Inventory']/r['COGS']*365,'days','Closing balance proxy','COGS = opening stock + purchases - closing stock; labour/freight excluded consistently.'),
    ('Working Capital Ratio','Current assets / reported current liabilities',ca/cl,'x','Classification caveat','Same formula as current ratio in supplied parameters.'),
    ('Drawing Power','Eligible stock + eligible debtors - creditors',None,'INR','Missing eligibility data','Bureau reports historical DP of INR20 lakh on 7 Jul 2026; no annual eligible stock/debtor schedules.'),
    ('Banking Trend Analysis','Inflow/outflow + internal/cheque/EMI return trends',None,'text','See Banking page','Banking July 2025-June 2026; not aligned to all three financial years.'),
    ('Invoice Ageing','Invoice due date vs unpaid balance',None,'text','Missing evidence','Invoice-level dates and outstanding settlements absent.'),
    ('CIBIL / CMR Analysis','Supplied bureau reports dated 7 Jul 2026',None,'text','Historical bureau snapshot','Personal report p1: score 756; dispute under review dated 25 Apr 2023. Company p2: 31 open, 17 closed, 0 delinquent; 96% WC utilisation. Company rank shown as dash. Personal report account histories not fully reviewed.'),
    ('Evidence-based SWOT','Statement trends + gaps + historical bureau',None,'text','See review notes','Strength: revenue/profit growth. Weakness: rising debt/receivables. Opportunity: validate collections. Threat: high historical WC utilisation; provisional figures.')]
    for i,(name,formula,v,unit,status,note) in enumerate(lines,1):
        result='Not available' if v is None else f'₹ {v/100000:.2f} lakh' if unit=='INR' else f'{v*100:.2f}%' if unit=='%' else f'{v:.2f} {unit}'
        if i==22:result='See Banking'
        if i==24:result='Personal CIBIL 756; company rank unavailable'
        if i==25:result='See review notes'
        register.append([y,i,name,formula,result,status,note])
table('Financial Parameters',[('Financial Year','String'),('No','Int64'),('Parameter','String'),('Formula','String'),('Result','String'),('Evidence','String'),('Interpretation','String')],register,'All 25 financial checklist parameters for each of the three statement years. Missing values are explicit, not zero.')
coverage=[
 ['GST',1,'Buyer/supplier totals & shares','Unavailable','GSTR-1, GSTR-2B or sales/purchase party ledger required. GSTR-3B is aggregate.'],
 ['GST',2,'Exports and export share','Partial','Zero-rated values shown separately; export vs SEZ split absent.'],
 ['GST',3,'Filing date and late fee','Available','ARN dates and section 5.1 late fee extracted; fee may relate to previous tax period.'],
 ['GST',4,'State/location revenue split','Unavailable','Registered GST state is Maharashtra; that does not establish buyer-state distribution.'],
 ['GST',5,'Intra-group transactions','Unavailable','Related-party ownership mapping and invoice ledger required.'],
 ['GST',6,'HSN product summary','Unavailable','HSN-level GSTR-1 or item ledger required.'],
 ['Banking',1,'Internal account transactions','Partial','Exact same-date reciprocal amount plus ownership narration cue; ambiguous pairs remain unconfirmed.'],
 ['Banking',2,'Inflows/outflows, credits and BTO','Available','Gross flows extracted. Adjusted BTO excludes confirmed internal credits, loan candidates and return markers.'],
 ['Banking',3,'Cheque / ECS / NACH returns','Candidate markers','Narration markers; candidate counts are entries, not verified unique failed payments.'],
 ['Banking',4,'Party receipts/payments','Available','Source narration names retained; abbreviated names are not fuzzy matched.'],
 ['Banking',5,'Loans, cash and penal charges','Candidate markers','Narration classifications require verification; loan disbursement candidates are not proven business receipts.'],
 ['Banking',6,'CC utilisation','Historical bureau only','Company bureau p2: 96% utilisation, INR50 lakh sanctioned, INR20 lakh DP, INR17.2 lakh average O/S; dated 7 Jul 2026. Supplied bank accounts are current accounts.'],
 ['Reconciliation',1,'Party-wise GST vs banking','Unavailable','No party-level GST data. Bank party receipts can be reviewed but GST variances cannot be computed.'],
 ['Reconciliation',2,'Common-period aggregate bridge','Partial','July 2025-May 2026 only. Bank cash and GST booked supplies have different tax/timing bases.']]
table('Review Coverage',[('Page','String'),('Order','Int64'),('Parameter','String'),('Status','String'),('Evidence or Requirement','String')],coverage,'Coverage against user-supplied review checklist. Missing documents never replaced by invented facts.')
loans=[]
for line in read('02-Loan Obligation Sheet AS ON 07072026.txt').splitlines():
    mt=re.match(r'^(\d+)\s+(.*?)\s+(TERM LOAN|BUSINESS LOAN|PERSONAL LOAN|VEHICLE LOAN|HOME LOAN)\s+(SECURED|UNSECURED)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(\S+)\s+([\d.]+)%\s+(\d+)\s+([\d,]+\.\d{2})',line)
    if mt:
        no,lender,typ,sec,san,dis,dt,rate,ten,emi=mt.groups();loans.append([int(no),lender,typ,sec,float(san.replace(',','')),float(dis.replace(',','')),dt,float(rate)/100,int(ten),float(emi.replace(',',''))])
assert len(loans)==37
print('Loan schedule row sum / printed total:',sum(x[9] for x in loans),5445112)
table('Loan Schedule',[('No','Int64'),('Lender','String'),('Loan Type','String'),('Security','String'),('Sanctioned','Double'),('Disbursed','Double'),('Disbursement Date','String'),('Interest Rate','Double'),('Tenure Months','Int64'),('Monthly EMI','Double')],loans,'Source obligation sheet as of 7 July 2026. Row EMI sum INR5687124 vs printed INR5445112; difference INR242012 equals Siemens EMI. Monthly EMI is not annual principal repayment; amounts are not substituted into historical DSCR.')
for n,c in [('GST Sales Cr','Total Outward Supplies'),('Taxable Sales Cr','Taxable Sales'),('Exempt Sales Cr','Exempt Sales'),('Zero Rated Cr','Zero Rated Sales')]:measure(n,'GST Monthly',f"DIVIDE(SUM('GST Monthly'[{c}]),10000000)")
measure('GST Late Fee','GST Monthly',"SUM('GST Monthly'[Late Fee])",'₹ #,0.00')
measure('GST Filings','GST Monthly',"COUNTROWS('GST Monthly')",'0')
measure('Zero Rated Share','GST Monthly','DIVIDE([Zero Rated Cr],[GST Sales Cr])','0.00%')
for n,c in [('Bank Credits Cr','Credit'),('Bank Debits Cr','Debit'),('Adjusted BTO Cr','BTO Eligible'),('Cash Deposits Cr','Cash Deposit'),('Loan Candidates Cr','Loan Credit Candidate')]:measure(n,'Bank Transactions',f"DIVIDE(SUM('Bank Transactions'[{c}]),10000000)")
measure('Credit Entries','Bank Transactions',"COUNTROWS(FILTER('Bank Transactions','Bank Transactions'[Credit]>0))",'#,0')
measure('Return Candidates','Bank Transactions',"COUNTROWS(FILTER('Bank Transactions','Bank Transactions'[Return Type]<>\"No return marker\"))",'#,0')
measure('Penal Charge Candidates','Bank Transactions',"SUM('Bank Transactions'[Penal Charges])",'₹ #,0.00')
measure('Internal Credits Cr','Bank Transactions',"DIVIDE(CALCULATE(SUM('Bank Transactions'[Credit]),'Bank Transactions'[Internal Match]=\"Confirmed reciprocal transfer\"),10000000)")
for n,c in [('Common GST Cr','GST Supplies'),('Common Credits Cr','Gross Bank Credits'),('Common Adjusted Cr','Adjusted Credit Candidates')]:measure(n,'Reconciliation',f"DIVIDE(SUM('Reconciliation'[{c}]),10000000)")
measure('Common Gap Cr','Reconciliation','[Common Adjusted Cr]-[Common GST Cr]')
measure('Common Months','Reconciliation',"COUNTROWS('Reconciliation')",'0')
for n,c in [('Finance Sales Cr','Sales'),('Finance Profit Cr','Reported Profit Before Owner Tax'),('Finance EBITDA Cr','EBITDA'),('Finance Capital Cr','Proprietor Capital'),('Finance Debt Cr','Total Debt'),('Finance Debtors Cr','Debtors')]:measure(n,'Financials',f"DIVIDE(SUM('Financials'[{c}]),10000000)")
measure('Debt Equity','Financials',"DIVIDE(SUM('Financials'[Total Debt]),SUM('Financials'[Proprietor Capital]))",'0.00"x"')
measure('Current Ratio','Financials',"DIVIDE(SUM('Financials'[Current Assets]),SUM('Financials'[Reported Current Liabilities]))",'0.00"x"')
measure('Interest Cover','Financials',"DIVIDE(SUM('Financials'[EBIT]),SUM('Financials'[Interest]))",'0.00"x"')
measure('Reported Margin','Financials',"DIVIDE(SUM('Financials'[Reported Profit Before Owner Tax]),SUM('Financials'[Sales]))",'0.00%')
measure('Monthly EMI Lakh','Loan Schedule',"DIVIDE(SUM('Loan Schedule'[Monthly EMI]),100000)")
defs=[]
for name,t in T.items():
    payload=base64.b64encode(gzip.compress(json.dumps(t['rows'],ensure_ascii=False).encode())).decode()
    typ={'String':'type text','Double':'type number','Int64':'Int64.Type'}
    expr='let R=Json.Document(Binary.Decompress(Binary.FromText("'+payload+'",BinaryEncoding.Base64),Compression.GZip)), T=Table.FromRows(R,{'+','.join(json.dumps(c) for c,d in t['columns'])+'}), X=Table.TransformColumnTypes(T,{'+','.join('{'+json.dumps(c)+', '+typ[d]+'}' for c,d in t['columns'])+'}) in X'
    defs.append({'name':name,'description':t['description'],'mExpression':expr,'columns':[{'name':c,'sourceColumn':c,'dataType':d,'summarizeBy':'None'} for c,d in t['columns']]})
for name,obj in [('tables',T),('table-definitions',defs),('measures',M)]: (B/(name+'.json')).write_text(json.dumps(obj,indent=2,ensure_ascii=False),encoding='utf-8')
out=B/'RoyalEnterprisesCreditReview'/'ExtractedData';out.mkdir(parents=True,exist_ok=True)
for n,t in T.items():
    with (out/(n+'.csv')).open('w',newline='',encoding='utf-8-sig') as f:w=csv.writer(f);w.writerow([c for c,d in t['columns']]);w.writerows(t['rows'])
checks={'bank_transactions':len(bank),'bank_balance_errors':sum(len(x['balance_errors']) for x in json.loads((B/'bank-checks.json').read_text(encoding='utf-8'))),'gst_returns':len(gst),'common_months':len(recon),'financial_years':[r['Financial Year'] for r in fd],'financial_parameters':len(register),'loan_schedule_emi':sum(x[9] for x in loans),'balance_sheet_residuals':{r['Financial Year']:round(r['Total Assets']-r['Proprietor Capital']-r['Outside Liabilities'],2) for r in fd}}
(B/'data-checks.json').write_text(json.dumps(checks,indent=2),encoding='utf-8');print(json.dumps(checks,indent=2))
