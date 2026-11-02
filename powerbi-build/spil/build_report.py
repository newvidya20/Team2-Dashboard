"""Four native Power BI report pages using the previously approved dashboard layout."""
import json,pathlib,uuid,shutil
B=pathlib.Path(__file__).resolve().parent;ROOT=B/'SudarshanPharmaCreditReview';R=ROOT/'SudarshanPharmaCreditReview.Report';MODEL=ROOT/'SudarshanPharmaCreditReview.SemanticModel'
S='https://developer.microsoft.com/json-schemas/fabric/item/report/definition/'
MM=json.loads((B/'measures.json').read_text(encoding='utf-8'));MT={m['name']:m['tableName'] for m in MM}
NAVY='#132B40';INK='#243B50';MUTED='#6D8091';BG='#F3F6FA';BLUE='#2468A0';TEAL='#128478';AMBER='#A86616';RULE='#E0E7EF'
helpers=(B.parent/'redesign_report.py').read_text(encoding='utf-8').split('def uid():',1)[1].split('raw=json.loads',1)[0]
helpers='def uid():'+helpers
helpers=helpers.replace('sarangi-credit-review/four-tabs/','sudarshan-pharma/four-pages/').replace('SARANGI METAL WORKS INTERNATIONAL PRIVATE LIMITED','SUDARSHAN PHARMA INDUSTRIES LIMITED | PDF CREDIT REVIEW').replace("'height':1200","'height':getattr(self,'height',1200)").replace("x,y,w,52,{'Values'","x,144,w,68,{'Values'")
exec(helpers)
def categorical(t,c,values):return {'name':uid(),'field':field((t,c)),'type':'Categorical','filter':{'Version':2,'From':[{'Name':'s','Entity':t,'Type':0}],'Where':[{'Condition':{'In':{'Expressions':[{'Column':{'Expression':{'SourceRef':{'Source':'s'}},'Property':c}}],'Values':[[{'Literal':{'Value':"'"+v+"'"}}] for v in values]}}}]}}
def coverage(p,section,x,y,w,h):
    v=p.table('Checklist coverage & supporting records',[('Review Coverage','Parameter'),('Review Coverage','Status'),('Review Coverage','Evidence or Requirement')],x,y,w,h,[240,170,w-445],sort=(('Review Coverage','Parameter'),'Ascending'))
    v['filterConfig']={'filters':[categorical('Review Coverage','Page',[section])]}
def height(p,h):
    p.height=h
    for v in p.v:
        if v['position']['y']==1164:v['position']['y']=h-36

p=Page('1. GST Review','Sudarshan Pharma / GST review parameters','74 GSTR-3B documents | April 2025-July 2026 | Five registrations | INR crore unless stated | Registration-state scope',1);height(p,1400)
p.slicer('Period','Financial Year','GST financial year',32,w=326);p.slicer('Period','Month','GST month',382,w=326);p.slicer('GST Monthly','Registration State','Registration state',732,w=326)
p.text('Telangana starts Oct 2025 in supplied records',1082,153,326,50,10,AMBER,BG)
for m,l,n,x in [('GST Sales Cr','Declared outward supplies','Before any inter-registration elimination',32),('Zero Rated Cr','Zero-rated supplies','Export vs SEZ split unavailable',382),('GST Filings','GST documents supplied','One document has no ARN/date',732),('GST Late Fee','Reported late fee','INR • may relate to earlier tax periods',1082)]:p.kpi(m,l,n,x)
p.chart('lineChart','Monthly declared supplies | INR crore',('Period','Month'),['GST Sales Cr'],32,374,852,260)
p.chart('clusteredBarChart','Registration-state supplies | INR crore',('GST Monthly','Registration State'),['GST Sales Cr'],908,374,500,260,True)
p.table('Filing and return evidence | INR',[('GST Monthly','Month'),('GST Monthly','Registration State'),('GST Monthly','Filed On'),('GST Monthly','Total Outward Supplies'),('GST Monthly','Output Tax'),('GST Monthly','Late Fee'),('GST Monthly','Filing Evidence')],32,658,1376,296,[110,145,130,220,180,150,340],sort=(('GST Monthly','Month'),'Ascending'))
coverage(p,'GST',32,978,1376,248)
p.text('SOURCE EXCEPTION\nHaryana February 2026 displays FILED but has no ARN, ARN date or taxpayer name. Filing date remains unavailable; the document is not treated as independently verified filing evidence.\nState breakdown is by GST registration, not buyer location. Gross declarations may include inter-branch supplies.',32,1248,1376,82,11,AMBER)
p.text('Buyer/supplier concentration, HSN, party reconciliation and export-only ratios need GSTR-1/GSTR-2B or invoice ledgers. ITC cannot establish purchase turnover.',32,1340,1376,30,10,MUTED,BG)

p=Page('2. Banking Review','Sudarshan Pharma / banking review parameters','Seven supplied accounts | April 2025-August 2026 | Coverage varies; August partial | INR crore unless stated',2);height(p,1800)
p.slicer('Period','Month','Bank month',32,w=326);p.slicer('Bank Transactions','Bank','Account',382,w=326);p.slicer('Bank Transactions','Return Type','Return markers',732,w=326)
p.text('25,180 entries • 378 overlap rows removed',1082,153,326,50,10,MUTED,BG)
for m,l,n,x in [('Bank Credits Cr','Gross credits','Includes inter-account movements / finance',32),('Bank Debits Cr','Gross debits','All supplied statement withdrawals',382),('Adjusted BTO Cr','Adjusted BTO candidate','Own-account / loan / return markers excluded',732),('Credit Entries','Credit entries','Positive-value deposit entries',1082)]:p.kpi(m,l,n,x)
p.chart('lineChart','Monthly inflows / outflows | INR crore',('Period','Month'),['Bank Credits Cr','Bank Debits Cr'],32,374,852,260)
p.table('Account flows | INR crore',[('Bank Transactions','Bank'),'Bank Credits Cr','Bank Debits Cr','Internal Credits Cr'],908,374,500,260,[180,100,100,100],sort=(('Bank Transactions','Bank'),'Ascending'))
p.table('Party-wise receipts and payments | INR crore',[('Bank Transactions','Party'),'Bank Credits Cr','Bank Debits Cr','Credit Entries'],32,658,852,250,[470,110,110,110],sort=('Bank Credits Cr','Descending'))
p.table('Returns and penal-charge candidates',[('Bank Transactions','Return Type'),'Return Candidates','Penal Charge Candidates','Loan Candidates Cr'],908,658,500,250,[180,85,115,95],sort=(('Bank Transactions','Return Type'),'Ascending'))
p.text('CASH CREDIT UTILISATION | Obligation schedule dated 30 June 2026 | Independent of bank-month filter',32,930,1376,32,14,INK,BG,True)
p.table('CC source snapshot and statement differences | INR',[('CC Snapshot','Account'),('CC Snapshot','Sanctioned'),('CC Snapshot','Schedule Outstanding'),('CC Snapshot','Schedule Utilisation'),('CC Snapshot','Statement Drawn'),('CC Snapshot','Statement Less Schedule')],32,976,1376,220,[220,200,220,190,210,240],sort=(('CC Snapshot','Account'),'Ascending'))
p.text('June schedule limits are not applied to earlier months. Karnataka statements, and Kotak/Union CC limits, are absent. A blank statement balance means no matching 30 June entry. Different source balances are preserved for review.',32,1208,1376,52,11,AMBER,BG)
p.table('Transaction evidence | INR | Source ID resolves to SourceInventory.json',[('Bank Transactions','Date'),('Bank Transactions','Bank'),('Bank Transactions','Party'),('Bank Transactions','Debit'),('Bank Transactions','Credit'),('Bank Transactions','Internal Match'),('Bank Transactions','Source ID'),('Bank Transactions','Page')],32,1280,1376,250,[110,160,300,140,140,260,80,55],sort=(('Bank Transactions','Date'),'Ascending'))
coverage(p,'Banking',32,1552,1376,174)
p.text('All 25,558 raw rows passed within-statement running-balance checks. Reciprocal UTR transfers are confirmed; ownership narration remains a candidate. Return entries are not distinct failed-payment events.',32,1734,1376,28,10,MUTED,BG)

p=Page('3. Banking & GST Reconciliation','Sudarshan Pharma / triangular report','Availability-based comparison | April 2025-July 2026 | INR crore | Account and registration coverage differs by month',3);height(p,1400)
p.slicer('Period','Month','Comparison month',32,w=326)
p.text('Party-level reconciliation pending GSTR-1 / invoice and customer GSTIN ledgers',382,154,1026,48,13,AMBER,BG,True)
for m,l,n,x in [('Common GST Cr','GST declared supplies','Gross registration supplies • tax excluded',32),('Common Credits Cr','Gross bank credits','Available accounts in shared GST months',382),('Common Adjusted Cr','Adjusted receipt candidate','Own-account / loan / return markers excluded',732),('Common Gap Cr','Cash less GST declarations','Scope/timing/tax gap • not a debtor balance',1082)]:p.kpi(m,l,n,x,accent=AMBER if x==1082 else TEAL)
p.chart('clusteredColumnChart','Monthly GST vs banking | INR crore',('Reconciliation','Month'),['Common GST Cr','Common Credits Cr','Common Adjusted Cr'],32,374,852,260)
p.text('COMPARISON LIMITS\nThis is an availability bridge, not full entity reconciliation. Earlier months have fewer bank accounts and four GST registrations. Telangana records start Oct 2025.\n\nGST can include branch transfers. Bank cash can include prior-period collections, advances, finance and unidentified internal transfers.',908,374,500,260,12,INK)
p.table('Monthly bridge with coverage counts | INR',[('Reconciliation','Month'),('Reconciliation','GST Supplies'),('Reconciliation','Gross Bank Credits'),('Reconciliation','Adjusted Credit Candidates'),('Reconciliation','GST Registrations'),('Reconciliation','Bank Accounts With Entries'),('Reconciliation','Coverage')],32,658,1376,324,[110,200,200,215,110,110,355],sort=(('Reconciliation','Month'),'Ascending'))
coverage(p,'Reconciliation',32,1006,1376,184)
p.text('REQUIRED FOR PARTY-WISE RECONCILIATION\nCustomer ledger with GSTIN, invoice/date, gross amount, opening receivables and receipt allocations; GSTR-1 B2B/export tables; verified bank-name aliases. For suppliers, add GSTR-2B and purchase ledger.\nInter-registration GST elimination and June 2026 Union 0102 statement coverage also need verification. August bank statements are partial and August GST is not supplied.',32,1210,1376,100,11,INK)
p.text('Missing party GST values stay unavailable. No zero-valued party GST amounts, fuzzy name matches or artificial party variances are generated.',32,1336,1376,30,10,AMBER,BG)

p=Page('4. Financial & Credit Analysis','Sudarshan Pharma / income tax & audit review','Standalone audited statements | INR crore | FY2024 previous GAAP; FY2025 restated Ind AS; FY2026 Ind AS',4);height(p,1800)
year=p.slicer('Finance Year','Financial Year','Select financial year',32,w=676,sync=True);year['position'].update(y=140,height=72)
year['visual']['objects']['data']=props(mode=lit('Basic'))
year['visual']['objects']['general']=props(orientation=lit(1),filter={'filter':categorical('Finance Year','Financial Year',['2025-26'])['filter']})
p.text('All three years audited • latest FY2025-26',732,156,676,44,12,TEAL,BG,True)
for m,l,n,x in [('Finance Sales Cr','Operating revenue','Standalone • selected financial year',32),('Finance PAT Cr','Profit after tax','After exceptional items and income tax',382),('Finance EBITDA Cr','EBITDA • PDF formula','PAT + tax + finance costs + D&A',732),('Finance Debt Cr','Total debt','Current + noncurrent borrowings + leases',1082)]:p.kpi(m,l,n,x)
a=p.chart('clusteredColumnChart','Three-year operating revenue | INR crore',('Financials','Financial Year'),['Finance Sales Cr'],32,374,676,218)
b=p.chart('clusteredColumnChart','PAT and operating cash flow | INR crore',('Financials','Financial Year'),['Finance PAT Cr','Finance CFO Cr'],732,374,676,218);p.no_interaction(year,[a,b])
p.table('Selected-year credit ratios',[('Financials','Financial Year'),('Financials','Statement Status'),'Debt Equity','Current Ratio','Interest Cover','PAT Margin'],32,616,1376,144,[180,190,225,225,225,225],sort=(('Financials','Financial Year'),'Ascending'))
p.text('ALL 25 FINANCIAL & CREDIT PARAMETERS | Results and evidence follow the selected year',32,780,1376,34,15,INK,BG,True)
p.table('Formula, result and evidence register | Scroll to review all 25 parameters',[('Financial Parameters','No'),('Financial Parameters','Parameter'),('Financial Parameters','Formula'),('Financial Parameters','Result'),('Financial Parameters','Evidence'),('Financial Parameters','Interpretation')],32,830,1376,528,[45,230,260,200,170,420],sort=(('Financial Parameters','No'),'Ascending'))
p.text('LOAN OBLIGATIONS | 30 June 2026 snapshot | 32 facilities; funded and non-funded exposures kept distinct',32,1380,1376,30,14,INK,BG,True)
p.table('Facility schedule | INR',[('Loan Schedule','Lender'),('Loan Schedule','Facility Type'),('Loan Schedule','Sanctioned'),('Loan Schedule','Outstanding'),('Loan Schedule','Monthly EMI')],32,1424,852,188,[275,175,150,150,150],sort=(('Loan Schedule','Lender'),'Ascending'))
p.text('SOURCE TOTAL EXCEPTION\nEntered EMI rows total INR51.32 lakh/month. Printed total INR3.23 lakh includes numeric cells only and misses text-formatted amounts.\nLC / derivative limits are not annual funded debt. Missing EMI stays blank.',908,1424,500,188,11,AMBER)
p.text('EVIDENCE-BASED SWOT\nStrength: revenue and PAT growth. Weakness: rising debt, receivables and inventory; negative FY2025/26 operating cash flow. Opportunity: validate collections and working capital. Threat: financing dependence and differences in source account coverage. No bureau report was supplied; no credit score or sanction recommendation is inferred.',32,1634,1376,88,11,INK)
p.text('BASIS NOTE: FY2024 CFO includes short-term borrowing movements. FY2025 is restated Ind AS; the older net-worth certificate uses a different basis. Projected CMA excluded.',32,1730,1376,28,10,AMBER,BG)

for p in P:p.write()
save(R/'definition'/'pages'/'pages.json',{'$schema':S+'pagesMetadata/1.0.0/schema.json','pageOrder':[p.name for p in P],'activePageName':P[0].name})
old=B.parent/'output'/'SarangiCreditReview'/'SarangiCreditReview.Report'
for name in ['report.json','version.json']:shutil.copy2(old/'definition'/name,R/'definition'/name)
shutil.copytree(old/'StaticResources',R/'StaticResources',dirs_exist_ok=True)
for folder,typ in [(R,'Report'),(MODEL,'SemanticModel')]:save(folder/'.platform',{'$schema':'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json','metadata':{'type':typ,'displayName':'Sudarshan Pharma Credit Review'},'config':{'version':'2.0','logicalId':str(uuid.uuid5(uuid.NAMESPACE_URL,'sudarshan-pharma/'+typ))}})
save(R/'definition.pbir',{'version':'4.0','datasetReference':{'byPath':{'path':'../SudarshanPharmaCreditReview.SemanticModel'}}})
save(MODEL/'definition.pbism',{'version':'4.2','settings':{}})
save(ROOT/'SudarshanPharmaCreditReview.pbip',{'version':'1.0','artifacts':[{'report':{'path':'SudarshanPharmaCreditReview.Report'}}],'settings':{'enableAutoRecovery':True}})
save(ROOT/'BuildManifest.json',{'company':'Sudarshan Pharma Industries Limited','pages':[p.title for p in P],'visuals':sum(len(p.v) for p in P),'financialYears':['2023-24','2024-25','2025-26'],'basis':'Standalone, FY2025 restated Ind AS; FY2024 prior GAAP','snapshot':True,'dataChecks':json.loads((B/'data-checks.json').read_text())})
print(json.dumps({'pages':[p.title for p in P],'visuals':sum(len(p.v) for p in P)},indent=2))
