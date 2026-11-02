"""Build an auditable Power BI snapshot from the supplied Sarangi workbooks."""
import sys, pathlib, json, re, datetime as dt, csv, collections, gzip, base64
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.powerbi-tools'))
from openpyxl import load_workbook

SOURCE = pathlib.Path(r'C:\Users\loanb\OneDrive\Desktop\Power BI')
OUT = pathlib.Path(__file__).resolve().parent / 'output'
OUT.mkdir(parents=True, exist_ok=True)
W = {k: load_workbook(next((SOURCE/'Data').glob('*'+k+'*.xlsx')), read_only=True, data_only=True) for k in ['Banking','GST','Financails']}
def rows(k, sheet): return list(W[k][sheet].values)
def text(x): return '' if x is None else str(x).strip()
def number(x):
    if isinstance(x,(int,float)): return float(x)
    s=text(x).replace(',','')
    if not s or s in ['-','NA','N.A.']: return None
    try: return float(s)
    except ValueError: return None
def month(x):
    try: return dt.datetime.strptime(text(x),'%b-%y').date().replace(day=1)
    except ValueError: return None
def date(x):
    if isinstance(x,dt.datetime): return x.date().isoformat()
    for fmt in ['%d-%b-%Y','%d-%m-%Y','%Y-%m-%d']:
        try: return dt.datetime.strptime(text(x),fmt).date().isoformat()
        except ValueError: pass
    return None
def key(x): return re.sub('[^A-Z0-9]','',text(x).upper()) or 'UNIDENTIFIED'
def fy(x):
    y=x.year-(x.month<4)
    return f'{y}-{str(y+1)[2:]}'

tables={}
def add(name,columns,data,description):
    tables[name]={'columns':columns,'rows':data,'description':description}

raw=rows('Banking','Raw Data')
bank=[]
for i,r in enumerate(raw[6:],7):
    if not isinstance(r[0],(int,float)): break
    d=date(r[1]); party=text(r[7]) or 'Unidentified counterparty'
    bank.append([int(r[0]),d,d[:7]+'-01',text(r[2]),number(r[3]),number(r[4]),number(r[5]),text(r[6]),party,key(r[7]),text(r[9]),text(r[10]),i])
add('Bank Transactions',[('Transaction ID','Int64'),('Date','DateTime'),('Month','DateTime'),('Narration','String'),('Debit','Double'),('Credit','Double'),('Balance','Double'),('Category','String'),('Party','String'),('Party Key','String'),('Bank','String'),('Account','String'),('Source Row','Int64')],bank,'Consolidated Raw Data block only; account-level repeats excluded. INR. Source category and counterparty retained; unidentified entries remain unidentified.')
assert len(bank)==882, f'Unexpected bank population {len(bank)}'
assert abs(sum((r[4] or 0) for r in bank)-598733971.26)<.02
assert abs(sum((r[5] or 0) for r in bank)-399320401.56)<.02
assert sum(r[5] is not None for r in bank)==237
assert sum(r[4] is not None for r in bank)==645

mom=rows('Banking','MoM Summary')
bm=[]
for c,h in enumerate(mom[5]):
    m=month(h)
    if not m: continue
    get=lambda r: number(mom[r-1][c])
    bm.append([m.isoformat(),get(7),get(9),get(11),get(13),get(12),get(14),get(39),get(40),get(46),get(47),get(53),get(64),get(62),get(66),text(mom[31][c])])
add('Bank Monthly',[('Month','DateTime'),('Gross Debits','Double'),('Gross Credits','Double'),('Net Debits','Double'),('Net Credits','Double'),('Net Debit Count','Double'),('Net Credit Count','Double'),('Inward Bounce Count','Double'),('Inward Bounce Amount','Double'),('EMI Bounce Count','Double'),('EMI Bounce Amount','Double'),('Penal Charges','Double'),('Loan Disbursements','Double'),('EMI Payments','Double'),('Interest Paid','Double'),('Missing Statement Dates','String')],bm,'Consolidated MoM Summary only. Dashes are missing/not reported, not imputed zero. BTO is source-reported net credits, with gross credits available separately.')
assert abs(sum((r[4] or 0) for r in bm)-350006898.64)<.02

bf=rows('GST','Bifurcation')
gm=[]
for c,h in enumerate(bf[4]):
    m=month(h)
    if m: gm.append([m.isoformat(),number(bf[15][c]),number(bf[13][c]),number(bf[14][c]),number(bf[23][c])])
add('GST Monthly',[('Month','DateTime'),('Revenue','Double'),('Domestic Revenue','Double'),('Export Revenue','Double'),('Purchases and Expenses','Double')],gm,'Monthly adjusted taxable values from Bifurcation; annual totals and overlapping TTM columns excluded. INR, excludes GST tax amounts.')

gp=[]; names={}; party_totals={}
for sheet,role in [('Customer Wise','Buyer'),('Supplier Wise','Supplier')]:
    rr=rows('GST',sheet); cols=[(c,month(h)) for c,h in enumerate(rr[5]) if month(h)]
    for i,r in enumerate(rr[6:],7):
        if not re.fullmatch(r'[0-9]{2}[A-Z0-9]{13}',text(r[1])): continue
        pk=key(r[0]); names[pk]=text(r[0]); party_totals[pk]=party_totals.get(pk,0)+1
        for c,m in cols:
            v=number(r[c])
            if v is not None and v!=0: gp.append([m.isoformat(),role,text(r[0]),pk,text(r[1]),v,i])
add('GST Parties',[('Month','DateTime'),('Role','String'),('Party','String'),('Party Key','String'),('GSTIN','String'),('Amount','Double'),('Source Row','Int64')],gp,'Nonzero monthly party taxable values. GSTIN-valid detail rows only; totals, annual and TTM columns excluded. Buyer/supplier shares use party totals in selected periods.')

st=rows('GST','State Wise'); gs=[]
for start,end,header,role in [(7,19,5,'Revenue'),(31,35,29,'Purchases')]:
    for rn in range(start,end+1):
        r=st[rn-1]
        for c,h in enumerate(st[header-1]):
            m=month(h); v=number(r[c])
            if m and v is not None: gs.append([m.isoformat(),role,text(r[0]),text(r[1]),v])
add('GST State',[('Month','DateTime'),('Type','String'),('State','String'),('State Code','String'),('Amount','Double')],gs,'State-wise taxable values. Exports and exempt/nil/non-GST buckets retained by source label. Subtotals excluded.')

ff=rows('GST','Profile & Filing Table'); filings=[]
for c in [1,8,15]:
    gstin=text(ff[6][c]); state=text(ff[16][c]); form=None
    for i,r in enumerate(ff,1):
        s=text(r[c])
        if s.startswith('Filing Details '): form=s.split('- ')[0].replace('Filing Details ','').strip()
        m=month(r[c+1])
        if form and m:
            dd=date(r[c+2]); fd=date(r[c+3]); delay=None
            if dd and fd: delay=max(0,(dt.date.fromisoformat(fd)-dt.date.fromisoformat(dd)).days)
            filings.append([m.isoformat(),gstin,state,form,dd,fd,delay,number(r[c+4]),i])
add('GST Filings',[('Month','DateTime'),('GSTIN','String'),('State','String'),('Return','String'),('Due Date','DateTime'),('Filing Date','DateTime'),('Delay Days','Int64'),('Source Delay Days','Double'),('Source Row','Int64')],filings,'GSTR1/GSTR3B filing details. Delay recomputed from supplied due and filing dates, floored at zero; source delay retained. Late fee amounts are not supplied.')

bs=rows('Financails','7'); pl=rows('Financails','8')
fin=[]
financial_map=[('Sales','pl',16),('Total Income','pl',18),('Total Expenses','pl',35),('Net Profit','pl',50),('Profit Before Tax','pl',41),('Interest','pl',33),('Current Tax','pl',43),('Deferred Tax','pl',44),('Depreciation and Amortization','pl',34),('Reported EBITDA','pl',31),('Other Income','pl',17),('Purchases','pl',21),('Inventory Change','pl',22),('Material Consumed','pl',20),('Equity','bs',16),('Long Term Debt','bs',21),('Short Term Debt','bs',35),('Unsecured Long Term Debt','bs',23),('Unsecured Short Term Debt','bs',37),('Current Assets','bs',69),('Current Liabilities','bs',46),('Inventory','bs',64),('Debtors','bs',65),('Creditors','bs',43),('Intangible Assets','bs',52),('Retained Earnings Proxy','bs',14),('Non Current Liabilities','bs',33),('Total Assets','bs',71)]
for c in [1,2,3]:
    fin.append([text(bs[10][c])]+[number((pl if sh=='pl' else bs)[rn-1][c]) for _,sh,rn in financial_map])
add('Financials',[('Financial Year','String')]+[(n,'Double') for n,_,_ in financial_map],fin,'Statement values in INR for FY2021-22 to FY2023-24. Uses detailed Balance Sheet and Profit & Loss; source narrative/snapshot inconsistencies do not override statements. Reserves and surplus is only a retained-earnings proxy.')

rat=[]
for rn,r in enumerate(rows('Financails','9'),1):
    if rn<9 or rn>37: continue
    for c,yr in [(1,'2021-2022'),(2,'2022-2023'),(3,'2023-2024')]:
        v=number(r[c])
        if v is not None: rat.append([yr,text(r[0]),v,rn])
add('Source Ratios',[('Financial Year','String'),('Metric','String'),('Value','Double'),('Source Row','Int64')],rat,'Ratios as supplied, including percentages expressed in percentage points. Recomputed ratios are separate measures; provider definitions may differ.')

flags=[]
for rn,r in enumerate(rows('Financails','1'),1):
    if rn>=10 and r[0] and r[1]: flags.append([text(r[0]),text(r[1]),text(r[2]),'Red' if r[7]=='R' else 'Amber' if r[6]=='Y' else 'Green','Financial workbook sheet 1',rn])
add('Source Flags',[('Area','String'),('Flag','String'),('Details','String'),('Severity','String'),('Source','String'),('Source Row','Int64')],flags,'Historical provider flags as supplied, as of December 2024; not independently verified current findings.')

internal=[]
rr=rows('Banking','Internal & Group'); mode=''
for rn,r in enumerate(rr,1):
    if rn>6 and text(r[0])=='SARANGI METAL WORKS INTERNATIONAL PRIVATE LIMITED': break
    if not isinstance(r[0],(int,float)) or not date(r[1]): continue
    internal.append([date(r[1]),date(r[1])[:7]+'-01',text(r[2]),text(r[3]),number(r[4]) or 0,number(r[5]) or 0,rn])
add('Internal Transfers',[('Date','DateTime'),('Month','DateTime'),('Narration','String'),('Classification','String'),('Debit','Double'),('Credit','Double'),('Source Row','Int64')],internal,'Consolidated internal-transfer detail from Internal & Group. Separate analytical subset; do not add to Raw Data totals.')

# Shared months only: normalized exact-name matches, no fuzzy or inferred settlement matches.
rec=collections.defaultdict(lambda:[0.,0.,0.,0.])
common_start='2024-04-01'; common_end='2024-09-01'
for m,role,p,pk,gstin,v,rn in gp:
    if common_start<=m<=common_end: rec[(m,pk)][0 if role=='Buyer' else 1]+=v
banknames={}
for r in bank:
    m,pk=r[2],r[9]; banknames.setdefault(pk,r[8])
    if common_start<=m<=common_end:
        rec[(m,pk)][2]+=r[5] or 0; rec[(m,pk)][3]+=r[4] or 0
gstkeys={r[3] for r in gp}; bankkeys={r[9] for r in bank}
recon=[]
for (m,pk),v in sorted(rec.items()):
    status='Exact normalized name' if pk in gstkeys and pk in bankkeys and pk!='UNIDENTIFIED' else 'GST only / unmatched bank name' if pk in gstkeys else 'Bank only / unidentified' if pk=='UNIDENTIFIED' else 'Bank only / unmatched GST name'
    recon.append([m,names.get(pk,banknames.get(pk,pk)),pk,status,*v,v[0]-v[2],v[1]-v[3]])
add('Party Reconciliation',[('Month','DateTime'),('Party','String'),('Party Key','String'),('Match Status','String'),('GST Sales','Double'),('GST Purchases','Double'),('Bank Receipts','Double'),('Bank Payments','Double'),('Sales Less Receipts','Double'),('Purchases Less Payments','Double')],recon,'Apr-Sep 2024 only. Exact normalized names (punctuation/spacing/case ignored). GST taxable amounts vs gross bank cash flows incl tax, loans and transfers; variance is NOT an outstanding debtor/creditor balance or proof of mismatch. No GSTIN exists in bank source. Unmatched entries retained.')

coverage=[
('GST','Buyer and supplier totals / concentration','Available','Monthly party values and selected-period share measures.'),
('GST','Export ratio','Available','Bifurcation export values divided by adjusted total revenue.'),
('GST','Filing dates / delays','Available','Supplied due dates and filing dates; delay recomputed.'),
('GST','Late fees','Missing source','No GST late-fee amount field in supplied filing data.'),
('GST','State and revenue breakup','Available','State Wise taxable amounts; party profile covers top parties only.'),
('GST','Intra-group sales / purchases','Needs review','Intra Group shows zero group revenue; financial common directorship list suggests related parties. No authoritative related-party transaction mapping.'),
('GST','HSN product summary','Missing source','No HSN-level transaction schedule supplied.'),
('Banking','Inflows / outflows / credit counts','Available','882 consolidated transactions; repeated account blocks excluded.'),
('Banking','BTO / net credits','Available','Source-reported consolidated net credits; gross credits shown separately.'),
('Banking','Cheque and EMI returns / penalties','Available','Source MoM metrics and transaction categories; dash means not reported.'),
('Banking','Internal transfers','Available','Separate consolidated Internal & Group subset.'),
('Banking','Party flows / loans / cash deposits','Available','Source party/category attribution retained; blank counterparties explicitly unidentified.'),
('Banking','CC utilisation %','Missing source','Utilization sheet says No data available; sanction limit missing. Registered charge amount is not used as a sanction limit.'),
('Reconciliation','Party GST vs banking','Partial','Apr-Sep 2024, exact normalized names only. No invoice or GSTIN link in banking. Cash and GST tax bases differ.'),
('Financial','EBIT / EBITDA / net profit','Available','PAT + interest + current/deferred tax. PDF EBITA adds D&A, labelled EBITDA (PDF EBITA). Includes other income; source reported EBITDA separate.'),
('Financial','Operating profit','Needs review','PDF formula equals EBIT and includes other income. Core operating EBIT excludes Other Income and is separately labelled.'),
('Financial','Promoter net worth','Missing source','Corporate net worth supplied; no personal promoter asset/liability statements.'),
('Financial','DSCR','Missing source','Annual principal repayment absent. Bank EMI payments from a different period cannot substitute.'),
('Financial','Current / quick / working capital ratios','Available','Closing statement balances; working capital ratio equals current ratio.'),
('Financial','Debt equity / adjusted debt equity','Available','Total debt already includes disclosed unsecured borrowings. Standard adjusted ratio avoids counting them twice; PDF literal variant retained separately.'),
('Financial','Interest coverage / TOL-TNW / debt EBITDA','Available','TOL=total current + noncurrent liabilities; TNW=equity less intangible assets.'),
('Financial','Net profit to sales','Available','PAT divided by revenue from operations.'),
('Financial','Operating cash flow / interest','Missing source','No operating cash flow statement supplied.'),
('Financial','Retained earnings / equity','Partial','Only reserves and surplus is available; displayed as a proxy, not certified retained earnings.'),
('Financial','Debtor / creditor / stock days','Available','Closing balances; purchases of stock in trade and COGS (materials + purchases + inventory change).'),
('Financial','Drawing power','Missing source','Eligibility ageing, margins and eligible stock/debtors absent.'),
('Financial','Invoice ageing','Missing source','No invoice-level dates, outstanding amounts or settlements.'),
('Credit','CIBIL / CMR','Missing source','Credit Bureau tab states no reported defaults; no score/CMR report supplied. Does not establish clean bureau status.'),
('Credit','SWOT / review observations','Partial','Evidence-linked historical observations and source flags; no automated lending recommendation.'),
('Data quality','Reporting periods','Needs review','GST Aug2022-Sep2024; banking Apr-Dec2024 with missing dates; financial statements FY2021-22 to FY2023-24. Historical source data, not current 2026 performance.'),
('Data quality','Source EBITDA inconsistency','Needs review','Detailed P&L EBITDA excludes other income; PAT-based EBITDA includes it. Both are exposed; no silent replacement.'),
]
add('Review Coverage',[('Area','String'),('Requirement','String'),('Status','String'),('Evidence or Gap','String')],[list(r) for r in coverage],'Checklist coverage, definitions and evidence gaps. Missing data is not substituted with fabricated values.')

months=[]; d=dt.date(2022,4,1)
while d<=dt.date(2024,12,1):
    months.append([d.isoformat(),d.strftime('%b %Y'),d.year*100+d.month,fy(d),'Yes' if common_start<=d.isoformat()<=common_end else 'No'])
    d=dt.date(d.year+(d.month==12),d.month%12+1,1)
add('Calendar',[('Month','DateTime'),('Month Label','String'),('Month Sort','Int64'),('Financial Year','String'),('Common Period','String')],months,'Month-grain calendar; India April-March financial years. Common Period identifies shared GST/bank April-September 2024 coverage.')

# Compressed, typed import snapshots avoid credential prompts and ensure the PBIP opens reproducibly.
mt={'String':'type text','Double':'type nullable number','Int64':'type nullable number','DateTime':'type nullable date'}
defs=[]
for name,t in tables.items():
    cols=t['columns']; path=OUT/'CreditReviewData'/(name.replace(' ','_')+'.csv'); path.parent.mkdir(exist_ok=True)
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.writer(f); writer.writerow([c for c,_ in cols]); writer.writerows(t['rows'])
    payload=base64.b64encode(gzip.compress(json.dumps(t['rows'],ensure_ascii=False,separators=(',',':')).encode())).decode()
    expr='let\n  Rows = Json.Document(Binary.Decompress(Binary.FromText("'+payload+'", BinaryEncoding.Base64), Compression.GZip)),\n  Data = Table.FromRows(Rows, {'+','.join('"'+n+'"' for n,_ in cols)+'}),\n  Typed = Table.TransformColumnTypes(Data, {'+','.join('{"'+n+'", '+mt[typ]+'}' for n,typ in cols)+'}, "en-US")\nin Typed'
    defs.append({'name':name,'description':t['description'],'mExpression':expr,'columns':[{'name':n,'dataType':typ,'sourceColumn':n,'summarizeBy':'None' if typ in ['String','DateTime','Int64'] else 'Sum'} for n,typ in cols]})
(OUT/'table-definitions.json').write_text(json.dumps(defs),encoding='utf-8')
(OUT/'normalized-data.json').write_text(json.dumps(tables,indent=2),encoding='utf-8')
validation={'bank_rows':len(bank),'gross_credit_entries':sum(r[5] is not None for r in bank),'gross_debit_entries':sum(r[4] is not None for r in bank),'gross_credits':sum((r[5] or 0) for r in bank),'gross_debits':sum((r[4] or 0) for r in bank),'net_credits':sum((r[4] or 0) for r in bm),'gst_revenue':sum(r[1] for r in gm),'gst_purchases':sum(r[4] for r in gm),'table_counts':{k:len(t['rows']) for k,t in tables.items()},'reconciliation_status':dict(collections.Counter(r[3] for r in recon))}
(OUT/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
print(json.dumps(validation,indent=2))
