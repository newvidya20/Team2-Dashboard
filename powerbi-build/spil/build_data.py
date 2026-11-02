import sys,json,re,datetime,gzip,base64,csv
from pathlib import Path
B=Path(__file__).resolve().parent;sys.path.insert(0,str(B.parent.parent/'.powerbi-tools'))
import openpyxl
inventory=json.loads((B/'inventory.json').read_text());bank=json.loads((B/'bank-transactions.json').read_text(encoding='utf-8'));T={};M=[]
def table(n,cols,rows,desc):T[n]={'columns':cols,'rows':rows,'description':desc}
def measure(n,t,e,fmt='#,0.00',desc=''):M.append({'name':n,'tableName':t,'expression':e,'formatString':fmt,'description':desc or n})
def nums(s):return [float(x.replace(',','')) for x in re.findall(r'-?\d[\d,]*\.\d{2}',s)]
gst=[]
states={'24':'Gujarat','06':'Haryana','36':'Telangana','27':'Maharashtra','05':'Uttarakhand'}
for item in inventory:
    if 'GSTR-3B/' not in item['original']:continue
    text=(B/'text'/f"{item['id']:03d}.txt").read_text(encoding='utf-8');gstin=re.search(r'GSTR3B_([^_]+)_(\d{2})(\d{4})',item['original']);gid,mm,yyyy=gstin.groups();month=yyyy+'-'+mm
    def v(pattern):
        match=re.search(pattern,text,re.S)
        if not match:raise ValueError((item['id'],pattern))
        return nums(match[1])
    taxable=v(r'\(a\) Outward taxable supplies.*?exempted\)\s*([^\n]+)');zero=v(r'\(b\) Outward taxable supplies \(zero rated\)\s*([^\n]+)');exempt=v(r'\(c\s*\) Other outward supplies \(nil rated, exempted\)\s*([^\n]+)');ng=v(r'\(e\) Non-GST outward supplies\s*([^\n]+)');itc=v(r'C\. Net ITC available \(A-B\)\s*([^\n]+)');late=v(r'Late fee\s+([^\n]+)');interest=v(r'Interest Paid\s+([^\n]+)')
    arn=re.search(r'2\(d\)\. Date of ARN\s+(\d{2}/\d{2}/\d{4})',text)
    filing=datetime.datetime.strptime(arn[1],'%d/%m/%Y').date().isoformat() if arn else None
    gst.append([month,gid,states[gid[:2]],taxable[0],exempt[0],zero[0],ng[0],sum([taxable[0],exempt[0],zero[0],ng[0]]),sum(taxable[1:])+sum(zero[1:]),sum(itc),sum(late),sum(interest),filing,item['id'],item['original'].split('/')[-1],'ARN date present' if arn else 'No ARN / filing unverified'])
gc=['Month','GSTIN','Registration State','Taxable Sales','Exempt Sales','Zero Rated Sales','Non GST Sales','Total Outward Supplies','Output Tax','Net ITC','Late Fee','Interest Paid','Filed On','Source ID','Source','Filing Evidence']
table('GST Monthly',[(c,'String' if c in ['Month','GSTIN','Registration State','Filed On','Source','Filing Evidence'] else 'Int64' if c=='Source ID' else 'Double') for c in gc],gst,'74 GSTR-3B documents across five registrations. Haryana February 2026 has no ARN/date, so filing remains unverified. Telangana starts October 2025 in supplied records; other four start April 2025. Registration-state turnover is not customer-state revenue. Inter-branch taxable supplies may be included; no consolidation elimination is possible from 3B alone.')
bc=[('Date','String'),('Month','String'),('Bank','String'),('Party','String'),('Narration','String'),('Debit','Double'),('Credit','Double'),('Balance','Double'),('Internal Match','String'),('Return Type','String'),('Penal Charges','Double'),('Cash Deposit','Double'),('Loan Credit Candidate','Double'),('BTO Eligible','Double'),('Source ID','Int64'),('Source','String'),('Page','Int64'),('Reference','String')]
table('Bank Transactions',bc,[[r[c] for c,d in bc] for r in bank],'25,180 bank entries after 378 cross-document overlap rows removed. 25,558 raw rows passed per-statement running-balance checks. Confirmed transfers use reciprocal UTRs; ownership narration alone remains a candidate. Seven account coverage differs by month; August 2026 is partial.')
months=sorted({r['Month'] for r in bank}|{r[0] for r in gst});period=[]
for m in months:
    y,mo=map(int,m.split('-'));fy=y if mo>=4 else y-1;period.append([m,f'{fy}-{str(fy+1)[2:]}'])
table('Period',[('Month','String'),('Financial Year','String')],period,'Snapshot coverage April 2025-August 2026. Bank account coverage and GST registration coverage vary; August GST absent.')
recon=[]
for m in sorted({r[0] for r in gst}&{r['Month'] for r in bank}):
    g=[r for r in gst if r[0]==m];tx=[r for r in bank if r['Month']==m]
    recon.append([m,sum(r[7] for r in g),sum(r['Credit'] for r in tx),sum(r['Credit'] for r in tx if r['Internal Match']!='No own-account marker'),sum(r['Loan Credit Candidate'] for r in tx if r['Internal Match']=='No own-account marker'),sum(r['BTO Eligible'] for r in tx),len(g),len({r['Bank'] for r in tx}),'Filing unverified for one registration' if any(r[12] is None for r in g) else 'Partial GST registrations' if len(g)<5 else 'All five GST registrations supplied'])
rc=['Month','GST Supplies','Gross Bank Credits','Own Account Credit Markers','Loan Candidates','Adjusted Credit Candidates','GST Registrations','Bank Accounts With Entries','Coverage']
table('Reconciliation',[(c,'String' if c in ['Month','Coverage'] else 'Int64' if c in ['GST Registrations','Bank Accounts With Entries'] else 'Double') for c in rc],recon,'Availability-based monthly aggregate only. Months with fewer than five GST registrations and bank accounts without supplied entries are explicit. GST can include inter-registration supplies. Cash/book/tax/scope differences are not receivables or verified unexplained turnover. Party-level GST not supplied.')
# Annual source figures are INR lakh. Standalone FY2025 restated Ind AS comes from the FY2026 filing.
fc=['Financial Year','Statement Status','Sales','Other Income','PAT','Tax','Interest','Depreciation','Equity','Noncurrent Borrowings','Current Borrowings','Lease Liabilities','Unsecured Debt','Current Assets','Current Liabilities','Inventory','Debtors','Creditors','Purchases','Material Consumed','Inventory Change','Intangible Assets','Total Assets','Retained Earnings','Operating Cash Flow','Basis','Source']
fin=[
 ['2023-24','Audited',46556.23,275.14,1135.53,374.28,902.84,122.94,11161.50,1049.11,9639.89,0,220.97,24085.36,16227.23,8436.55,12308.06,6004.42,42758.35,482.45,-787.46,61.50,28484.48,2973.89,968.55,'Previous GAAP; CFO includes short-term borrowing movements','FY2024-25 audit PDF • pp61-63,70 • FY2024 comparative; visually checked'],
 ['2024-25','Audited • restated',50249.34,299.88,1402.16,478.45,1621.53,270.18,13070.82,1042.91,16259.06,362.31,143.18,32644.35,25897.15,13704.09,15207.74,8816.21,48859.26,399.90,-5330.06,33.06,40322.67,4501.09,-3317.70,'Restated Ind AS comparative in FY2025-26 report','FY2025-26 financial PDF • pp2,4,5,17 • FY2025 comparative'],
 ['2025-26','Audited',66749.85,840.44,2198.16,668.65,2529.74,340.65,15270.51,3039.26,25069.68,139.42,706.25,44474.50,41004.78,20665.52,19922.85,14711.54,65599.01,297.68,-7063.44,996.75,59417.97,6700.78,-275.22,'Ind AS standalone','FY2025-26 financial PDF • pp2,4,5,17']]
fd=[]
for f in fin:
    d=dict(zip(fc,f));d={k:(v*100000 if isinstance(v,(int,float)) else v) for k,v in d.items()};d['Total Income']=d['Sales']+d['Other Income'];d['EBIT']=d['PAT']+d['Tax']+d['Interest'];d['EBITDA']=d['EBIT']+d['Depreciation'];d['Total Debt']=d['Noncurrent Borrowings']+d['Current Borrowings']+d['Lease Liabilities'];d['TNW']=d['Equity']-d['Intangible Assets'];d['Outside Liabilities']=d['Total Assets']-d['Equity'];d['COGS']=d['Material Consumed']+d['Purchases']+d['Inventory Change'];fd.append(d)
fcols=list(fd[0]);table('Financials',[(c,'String' if isinstance(fd[0][c],str) else 'Double') for c in fcols],[[r[c] for c in fcols] for r in fd],'Standalone figures only, INR base units. FY2024 previous GAAP vs FY2025/26 Ind AS must be read with basis notes. Total debt includes current/noncurrent borrowings plus lease liabilities. Borrowing balances include accrued interest where source does. TNW deducts intangibles. No projected CMA actuals mixed in.')
table('Finance Year',[('Financial Year','String')],[[r['Financial Year']] for r in fd],'Three annual statement years; latest is audited, not provisional.')
parameters=[]
for r in fd:
    y=r['Financial Year'];debt=r['Total Debt'];eq=r['Equity'];ca=r['Current Assets'];cl=r['Current Liabilities'];pat=r['PAT'];interest=r['Interest'];tnw=r['TNW']
    lines=[
    ('EBIT','PAT + tax + finance costs',r['EBIT'],'INR','Calculated','Includes other income; rounding may differ from PBT + interest by INR1,000.'),
    ('EBITDA (PDF: EBITA)','PAT + tax + finance costs + D&A',r['EBITDA'],'INR','Calculated','PDF formula adds depreciation and amortization; displayed as EBITDA.'),
    ('Net profit after tax','Income - expenses - exceptional items - tax',pat,'INR','Source PAT','After tax and exceptional items; separate from comprehensive income.'),
    ('Operating profit • PDF','PAT + finance costs + tax',r['EBIT'],'INR','Definition caveat','PDF definition equals EBIT and includes non-operating other income.'),
    ('Promoter net worth','Personal assets - personal liabilities',None,'INR','Missing evidence','Corporate net worth certificate is not promoter personal net worth.'),
    ('DSCR','(PAT + D&A + interest) / (principal + interest)',None,'x','Missing gross repayments','Cash flows disclose net borrowing movements; gross annual principal repayments are not established. EMI schedule is a later snapshot.'),
    ('Current ratio','Current assets / current liabilities',ca/cl,'x','Calculated','Uses reported current liabilities including current borrowings.'),
    ('Quick ratio','(Current assets - inventory) / current liabilities',(ca-r['Inventory'])/cl,'x','Calculated','Matches PDF formula; no additional prepaid adjustment.'),
    ('Debt / equity','Borrowings plus lease liabilities / equity',debt/eq,'x','Calculated','Current and noncurrent borrowing balances plus leases.'),
    ('Adjusted debt / equity • literal PDF','(Total debt + unsecured debt) / equity',(debt+r['Unsecured Debt'])/eq,'x','Double-counting caveat','Literal PDF adds unsecured loans already included in debt; not standard leverage.'),
    ('Interest coverage','EBIT / finance costs',r['EBIT']/interest,'x','Calculated','Finance costs include other borrowing, factoring and lease costs.'),
    ('TOL / TNW','(Total assets - equity) / (equity - intangibles)',r['Outside Liabilities']/tnw,'x','Calculated','All outside liabilities included; net worth certificate uses a different stated formula.'),
    ('Net profit / sales','PAT / operating revenue',pat/r['Sales'],'%','Calculated','Sales exclude other income.'),
    ('Debt / EBITDA','Total debt / EBITDA',debt/r['EBITDA'],'x','Calculated','Debt includes leases; EBITDA includes other income.'),
    ('Operating cash flow / interest','Source operating cash flow / finance costs',r['Operating Cash Flow']/interest,'x','Basis caveat' if y=='2023-24' else 'Calculated','FY2024 source CFO includes INR7,509.34 lakh short-term borrowing movements; later Ind AS CFO classifies borrowings as financing.'),
    ('Retained earnings / equity','Closing retained earnings / equity',r['Retained Earnings']/eq,'%','Calculated','Actual retained earnings, excluding securities premium and share warrants.'),
    ('Debtor collection period','Closing net trade receivables / sales x 365',r['Debtors']/r['Sales']*365,'days','Closing balance proxy','Credit-sales split and invoice settlements not supplied.'),
    ('Creditor payment period','Closing trade payables / purchases x 365',r['Creditors']/r['Purchases']*365,'days','Closing balance proxy','Includes MSME and other trade payables.'),
    ('Stock holding period','Closing inventory / COGS x 365',r['Inventory']/r['COGS']*365,'days','Closing balance proxy','COGS = material consumed + stock purchases + signed inventory change.'),
    ('Working capital ratio','Current assets / current liabilities',ca/cl,'x','Calculated','Same as current ratio under supplied PDF definition.'),
    ('Drawing power','Eligible stock + eligible debtors - creditors',None,'INR','Missing eligibility data','CC sanction limits do not establish eligible stock/debtors or drawing power.'),
    ('Banking trend analysis','Inflows, outflows, internal transfers and return markers',None,'text','See Banking page','Bank period April 2025-August 2026 with varying account coverage and partial August.'),
    ('Invoice ageing','Invoice due dates and unpaid balances',None,'text','Missing invoice detail','Annual debtor totals/loss allowance do not establish invoice-level ageing.'),
    ('CIBIL / CMR analysis','Verified company/promoter bureau report',None,'text','Not supplied','No credit bureau report found in supplied ZIP.'),
    ('Evidence-based SWOT','Statements, cash conversion and source gaps',None,'text','See review notes','Revenue/PAT growth; rising debt, inventory and receivables; negative FY2025/26 operating cash flow; basis transition requires care.')]
    for no,(name,formula,value,unit,status,note) in enumerate(lines,1):
        result='Not available' if value is None else f'₹ {value/100000:.2f} lakh' if unit=='INR' else f'{value*100:.2f}%' if unit=='%' else f'{value:.2f} {unit}'
        if no==22:result='See Banking'
        if no==25:result='See review notes'
        parameters.append([y,no,name,formula,result,status,note])
table('Financial Parameters',[('Financial Year','String'),('No','Int64'),('Parameter','String'),('Formula','String'),('Result','String'),('Evidence','String'),('Interpretation','String')],parameters,'All 25 checklist parameters for each year. Missing evidence is explicit; no bureau score, promoter net worth or DSCR invented.')
w=openpyxl.load_workbook(B/'sources'/'163.xlsx',data_only=True);loans=[]
def money(v):return None if v is None or v=='-' else float(str(v).replace(',',''))
for row in w.active.iter_rows(min_row=2,values_only=True):
    no,lender,account,kind,limit,emi,outstanding,paid=row
    if not isinstance(no,int):continue
    loans.append([no,lender,str(account or ''),kind,money(limit),money(emi),money(outstanding),str(paid or '')])
table('Loan Schedule',[('No','Int64'),('Lender','String'),('Account','String'),('Facility Type','String'),('Sanctioned','Double'),('Monthly EMI','Double'),('Outstanding','Double'),('Paid From','String')],loans,'32 facilities as at 30 June 2026; LC and derivative limits are non-funded exposure, not annual balance sheet debt. Missing EMI remains null. Source printed EMI total sums numeric cells only, excluding text-formatted EMI values.')
cc=[]
accountmap={3:'Axis • 1058',12:'ICICI • 0192',15:'Indian • 1131',29:'BOI • 0001',32:'Karnataka • not supplied'}
for l in loans:
    if l[0] not in accountmap:continue
    acct=accountmap[l[0]];ondate=[r for r in bank if r['Bank']==acct and r['Date']=='2026-06-30'];statement=abs(ondate[-1]['Balance']) if ondate and ondate[-1]['Balance']<0 else None
    cc.append(['2026-06-30',acct,l[4],l[6],l[6]/l[4] if l[4] else None,statement,None if statement is None else statement-l[6],'Loan schedule snapshot; bank closing may differ in scope/date'])
table('CC Snapshot',[('As Of','String'),('Account','String'),('Sanctioned','Double'),('Schedule Outstanding','Double'),('Schedule Utilisation','Double'),('Statement Drawn','Double'),('Statement Less Schedule','Double'),('Interpretation','String')],cc,'Source obligation schedule CC utilisation on 30 June 2026 only. Do not apply June limits to historical months. Bank/account coverage is incomplete, and differing source balances are preserved for reconciliation. Kotak and Union CC limits not supplied in schedule.')
coverage=[
 ['GST',1,'Buyer / supplier totals and shares','Not supplied','Need GSTR-1 B2B, GSTR-2B and sales/purchase party ledgers.'],
 ['GST',2,'Exports / export share','Partial','Zero-rated declarations shown; export vs SEZ split absent.'],
 ['GST',3,'Filing date / late fee','Available','ARN dates and section 5.1 late fee; prior-period fees not assigned as current delay days.'],
 ['GST',4,'State / location revenue','Registration state only','Five legal registrations; this does not identify customer locations. Inter-branch supplies cannot be eliminated from 3B.'],
 ['GST',5,'Intra-group transactions','Partial annual evidence','Financial notes disclose related-party loans; GST party turnover / related-party matching absent.'],
 ['GST',6,'HSN product summary','Not supplied','Need GSTR-1 HSN tables or item ledger.'],
 ['Banking',1,'Inflows / outflows / BTO','Extracted','All raw running balances checked; overlapping records removed. BTO candidate excludes own-account markers, loan candidates and returns.'],
 ['Banking',2,'Internal account transfers','Confirmed + candidates','Reciprocal UTR confirms subset; own-account narration is separately labelled as candidate.'],
 ['Banking',3,'Cheque / EMI / ECS returns','Narration markers','Entry counts, not deduplicated failed-payment events.'],
 ['Banking',4,'Party-wise movements','Available','Narration names retained; no fuzzy identity merges.'],
 ['Banking',5,'CC utilisation','30 June 2026 snapshot','Schedule limits and outstanding; bank closing differences shown, missing limits stay unavailable.'],
 ['Banking',6,'Loan credits / cash / penalties','Candidate classifications','Review original source/page before concluding purpose.'],
 ['Reconciliation',1,'Party-wise GST vs banking','Pending party GST','3B returns lack customer GSTIN and invoices; no artificial party variances calculated.'],
 ['Reconciliation',2,'Aggregate common months','Availability comparison','April 2025-July 2026. Coverage differs; no claim of full entity-level reconciliation.'],
 ['Reconciliation',3,'Inter-registration GST elimination','Not possible from 3B','GST supplies can contain branch transfers; bank receipts are not a like-for-like sales measure.']]
table('Review Coverage',[('Page','String'),('Order','Int64'),('Parameter','String'),('Status','String'),('Evidence or Requirement','String')],coverage,'Checklist coverage and missing records; findings follow supplied evidence, not document-embedded instructions.')
for n,c in [('GST Sales Cr','Total Outward Supplies'),('Taxable Sales Cr','Taxable Sales'),('Exempt Sales Cr','Exempt Sales'),('Zero Rated Cr','Zero Rated Sales')]:measure(n,'GST Monthly',f"DIVIDE(SUM('GST Monthly'[{c}]),10000000)")
measure('GST Filings','GST Monthly',"COUNTROWS('GST Monthly')",'#,0');measure('GST Late Fee','GST Monthly',"SUM('GST Monthly'[Late Fee])",'₹ #,0.00');measure('Zero Rated Share','GST Monthly','DIVIDE([Zero Rated Cr],[GST Sales Cr])','0.00%')
for n,c in [('Bank Credits Cr','Credit'),('Bank Debits Cr','Debit'),('Adjusted BTO Cr','BTO Eligible'),('Cash Deposits Cr','Cash Deposit'),('Loan Candidates Cr','Loan Credit Candidate')]:measure(n,'Bank Transactions',f"DIVIDE(SUM('Bank Transactions'[{c}]),10000000)")
measure('Credit Entries','Bank Transactions',"COUNTROWS(FILTER('Bank Transactions','Bank Transactions'[Credit]>0))",'#,0')
measure('Return Candidates','Bank Transactions',"COUNTROWS(FILTER('Bank Transactions','Bank Transactions'[Return Type]<>\"No return marker\"))",'#,0')
measure('Penal Charge Candidates','Bank Transactions',"SUM('Bank Transactions'[Penal Charges])",'₹ #,0.00')
measure('Internal Credits Cr','Bank Transactions',"DIVIDE(CALCULATE(SUM('Bank Transactions'[Credit]),'Bank Transactions'[Internal Match]<>\"No own-account marker\"),10000000)")
for n,c in [('Common GST Cr','GST Supplies'),('Common Credits Cr','Gross Bank Credits'),('Common Adjusted Cr','Adjusted Credit Candidates')]:measure(n,'Reconciliation',f"DIVIDE(SUM('Reconciliation'[{c}]),10000000)")
measure('Common Gap Cr','Reconciliation','[Common Adjusted Cr]-[Common GST Cr]');measure('Common Months','Reconciliation',"COUNTROWS('Reconciliation')",'0')
for n,c in [('Finance Sales Cr','Sales'),('Finance PAT Cr','PAT'),('Finance EBITDA Cr','EBITDA'),('Finance Equity Cr','Equity'),('Finance Debt Cr','Total Debt'),('Finance CFO Cr','Operating Cash Flow')]:measure(n,'Financials',f"DIVIDE(SUM('Financials'[{c}]),10000000)")
for n,a,b,fmt in [('Debt Equity','Total Debt','Equity','0.00"x"'),('Current Ratio','Current Assets','Current Liabilities','0.00"x"'),('Interest Cover','EBIT','Interest','0.00"x"'),('PAT Margin','PAT','Sales','0.00%')]:measure(n,'Financials',f"DIVIDE(SUM('Financials'[{a}]),SUM('Financials'[{b}]))",fmt)
measure('Monthly EMI Lakh','Loan Schedule',"DIVIDE(SUM('Loan Schedule'[Monthly EMI]),100000)")
defs=[]
for n,t in T.items():
    payload=base64.b64encode(gzip.compress(json.dumps(t['rows'],ensure_ascii=False,separators=(',',':')).encode())).decode();typ={'String':'type text','Double':'type number','Int64':'Int64.Type'}
    expr='let R=Json.Document(Binary.Decompress(Binary.FromText("'+payload+'",BinaryEncoding.Base64),Compression.GZip)), T=Table.FromRows(R,{'+','.join(json.dumps(c) for c,d in t['columns'])+'}), X=Table.TransformColumnTypes(T,{'+','.join('{'+json.dumps(c)+', '+typ[d]+'}' for c,d in t['columns'])+'}) in X'
    defs.append({'name':n,'description':t['description'],'mExpression':expr,'columns':[{'name':c,'sourceColumn':c,'dataType':d,'summarizeBy':'None','formatString':('0.00%' if c=='Schedule Utilisation' else '#,0' if d=='Int64' else '#,0.00') if d!='String' else None} for c,d in t['columns']]})
for name,obj in [('tables',T),('table-definitions',defs),('measures',M)]: (B/(name+'.json')).write_text(json.dumps(obj,indent=2,ensure_ascii=False),encoding='utf-8')
out=B/'SudarshanPharmaCreditReview'/'ExtractedData';out.mkdir(parents=True,exist_ok=True)
for n,t in T.items():
    with (out/(n+'.csv')).open('w',newline='',encoding='utf-8-sig') as f:w=csv.writer(f);w.writerow([c for c,d in t['columns']]);w.writerows(t['rows'])
checks={'bank':json.loads((B/'bank-summary.json').read_text(encoding='utf-8')),'bank_balance_errors':sum(len(x['balance_errors']) for x in json.loads((B/'bank-checks.json').read_text())),'gst_returns':len(gst),'gst_states':sorted({r[2] for r in gst}),'common_months':len(recon),'financial_years':[r['Financial Year'] for r in fd],'financial_parameters':len(parameters),'loan_rows':len(loans),'emi_row_sum':sum(r[5] or 0 for r in loans),'emi_printed_total':323308,'loan_limit_row_sum':sum(r[4] or 0 for r in loans),'loan_outstanding_row_sum':sum(r[6] or 0 for r in loans),'balance_sheet_residuals':{r['Financial Year']:round(r['Total Assets']-r['Equity']-r['Current Liabilities']-(r['Noncurrent Borrowings']+(5.35+41.29)*100000 if r['Financial Year']=='2023-24' else 1354.69*100000 if r['Financial Year']=='2024-25' else 3142.68*100000),2) for r in fd}}
(B/'data-checks.json').write_text(json.dumps(checks,indent=2),encoding='utf-8');print(json.dumps(checks,indent=2))
