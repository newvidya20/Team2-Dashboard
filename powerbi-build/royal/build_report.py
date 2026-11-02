"""Build four native PBIR pages. Semantic model is authored/exported by Power BI MCP."""
import json,pathlib,uuid,shutil
B=pathlib.Path(__file__).resolve().parent
ROOT=B/'RoyalEnterprisesCreditReview';R=ROOT/'RoyalEnterprisesCreditReview.Report';MODEL=ROOT/'RoyalEnterprisesCreditReview.SemanticModel'
S='https://developer.microsoft.com/json-schemas/fabric/item/report/definition/'
MM=json.loads((B/'measures.json').read_text(encoding='utf-8'));MT={m['name']:m['tableName'] for m in MM}
NAVY='#132B40';INK='#243B50';MUTED='#6D8091';BG='#F3F6FA';BLUE='#2468A0';TEAL='#128478';AMBER='#A86616';RULE='#E0E7EF'
# Reuse the workspace's schema-validated PBIR layout primitives, without executing its prior report build.
helpers=(B.parent/'redesign_report.py').read_text(encoding='utf-8').split('def uid():',1)[1].split('raw=json.loads',1)[0]
helpers='def uid():'+helpers
helpers=helpers.replace('sarangi-credit-review/four-tabs/','royal-enterprises/four-pages/').replace('SARANGI METAL WORKS INTERNATIONAL PRIVATE LIMITED','ROYAL ENTERPRISES  |  PDF CREDIT REVIEW').replace("'height':1200","'height':getattr(self,'height',1200)")
helpers=helpers.replace("x,y,w,52,{'Values'","x,144,w,68,{'Values'")
exec(helpers)
def categorical(t,c,values):
    return {'name':uid(),'field':field((t,c)),'type':'Categorical','filter':{'Version':2,'From':[{'Name':'s','Entity':t,'Type':0}],'Where':[{'Condition':{'In':{'Expressions':[{'Column':{'Expression':{'SourceRef':{'Source':'s'}},'Property':c}}],'Values':[[{'Literal':{'Value':"'"+v+"'"}}] for v in values]}}}]}}
def coverage(page,section,x,y,w,h):
    v=page.table('Checklist coverage & supporting records',[('Review Coverage','Parameter'),('Review Coverage','Status'),('Review Coverage','Evidence or Requirement')],x,y,w,h,[235,150,w-420],sort=(('Review Coverage','Parameter'),'Ascending'))
    v['filterConfig']={'filters':[categorical('Review Coverage','Page',[section])]}
def height(page,h):
    page.height=h
    for v in page.v:
        if v['position']['y']==1164:v['position']['y']=h-36

p=Page('1. GST Review','Royal Enterprises / GST review parameters','GSTR-3B  |  April 2025-May 2026  |  Amounts in INR crore unless stated  |  Summary returns: party and HSN detail unavailable',1)
p.slicer('Period','Financial Year','GST financial year',32,w=326);p.slicer('Period','Month','GST month',382,w=326)
p.text('GSTIN 27BFJPC3507H1ZP  •  Maharashtra registration',732,156,676,42,11,MUTED,BG)
for m,l,n,x in [('GST Sales Cr','Total outward supplies','Taxable + exempt + zero-rated + non-GST',32),('Exempt Sales Cr','Exempt / nil-rated supplies','Section 3.1(c) • INR crore',382),('GST Filings','Returns supplied','Count within selected period',732),('GST Late Fee','Reported late fee','INR • may relate to previous tax period',1082)]:p.kpi(m,l,n,x)
p.chart('lineChart','Monthly outward supplies  |  INR crore',('Period','Month'),['GST Sales Cr'],32,374,852,260)
p.chart('clusteredColumnChart','Supply composition  |  INR crore',('Period','Month'),['Taxable Sales Cr','Exempt Sales Cr','Zero Rated Cr'],908,374,500,260)
p.table('Filing dates and statutory values  |  INR',[('GST Monthly','Month'),('GST Monthly','Filed On'),('GST Monthly','Total Outward Supplies'),('GST Monthly','Output Tax'),('GST Monthly','Net ITC'),('GST Monthly','Late Fee')],32,658,1376,228,[120,145,265,225,225,180],sort=(('GST Monthly','Month'),'Ascending'))
coverage(p,'GST',32,910,1376,210)
p.text('Zero-rated supplies are shown as declared; export/SEZ split is unavailable. GSTR-3B ITC cannot be used to infer total purchases. No filing-delay days are assumed.',32,1130,1376,26,10,AMBER,BG)

p=Page('2. Banking Review','Royal Enterprises / banking review parameters','Three supplied accounts  |  July 2025-June 2026  |  Amounts in INR crore  |  Candidate flags require narration review',2);height(p,1500)
p.slicer('Period','Month','Bank month',32,w=326);p.slicer('Bank Transactions','Bank','Account',382,w=326);p.slicer('Bank Transactions','Return Type','Return markers',732,w=326)
p.text('6,274 transactions • running balances checked',1082,156,326,46,10,MUTED,BG)
for m,l,n,x in [('Bank Credits Cr','Gross credits','All deposits, including transfers/financing',32),('Bank Debits Cr','Gross debits','All withdrawals • INR crore',382),('Adjusted BTO Cr','Adjusted BTO candidate','Excludes confirmed internal / loan / returns',732),('Credit Entries','Credit entries','Positive-value deposits',1082)]:p.kpi(m,l,n,x)
p.chart('lineChart','Monthly inflows / outflows  |  INR crore',('Period','Month'),['Bank Credits Cr','Bank Debits Cr'],32,374,852,260)
p.table('Account flow summary  |  INR crore',[('Bank Transactions','Bank'),'Bank Credits Cr','Bank Debits Cr','Internal Credits Cr','Cash Deposits Cr'],908,374,500,260,[160,78,78,78,78],sort=(('Bank Transactions','Bank'),'Ascending'))
p.table('Party-wise receipts and payments  |  INR crore',[('Bank Transactions','Party'),'Bank Credits Cr','Bank Debits Cr','Credit Entries'],32,658,852,260,[470,115,115,110],sort=('Bank Credits Cr','Descending'))
p.table('Narration classification controls',[('Bank Transactions','Return Type'),'Return Candidates','Penal Charge Candidates','Loan Candidates Cr'],908,658,500,260,[190,90,100,90],sort=(('Bank Transactions','Return Type'),'Ascending'))
p.table('Transaction evidence  |  INR  |  scroll for source narration and page',[('Bank Transactions','Date'),('Bank Transactions','Bank'),('Bank Transactions','Party'),('Bank Transactions','Debit'),('Bank Transactions','Credit'),('Bank Transactions','Internal Match'),('Bank Transactions','Source'),('Bank Transactions','Page')],32,942,1376,260,[100,160,300,120,120,180,250,55],sort=(('Bank Transactions','Date'),'Ascending'))
coverage(p,'Banking',32,1226,1376,184)
p.text('BTO is an analytical candidate, not verified sales. Return-marker counts count entries, not distinct failed payments. Bureau p2 reports historical 96% WC utilisation on 7 July 2026.',32,1424,1376,32,10,AMBER,BG)

p=Page('3. Banking & GST Reconciliation','Royal Enterprises / triangular report','Common-period aggregate bridge  |  July 2025-May 2026 (11 months)  |  INR crore  |  Party-level GST data not supplied',3)
p.slicer('Period','Month','Comparison month',32,w=326)
p.text('Party-level reconciliation: pending GSTR-1 / sales ledger with GSTINs',382,154,1026,48,13,AMBER,BG,True)
for m,l,n,x in [('Common GST Cr','GST booked supplies','Includes exempt / nil-rated outward supplies',32),('Common Credits Cr','Gross banking credits','Only months shared with GST',382),('Common Adjusted Cr','Adjusted receipt candidate','Transfers / loan / return markers excluded',732),('Common Gap Cr','Cash less GST supplies','Timing / tax / scope difference • not debtors',1082)]:p.kpi(m,l,n,x,accent=AMBER if x==1082 else TEAL)
p.chart('clusteredColumnChart','Shared-month GST vs banking  |  INR crore',('Reconciliation','Month'),['Common GST Cr','Common Credits Cr','Common Adjusted Cr'],32,374,852,260)
p.text('HOW TO READ THE GAP\nGST is booked supply, bank credits are cash. Taxes, collections of earlier invoices, advances, transfers and finance can differ.\n\nUnconfirmed internal transfers and unidentified financing may remain in adjusted credits. No party match or unexplained turnover conclusion is asserted.',908,374,500,260,12,INK)
p.table('Monthly reconciliation bridge  |  INR',[('Reconciliation','Month'),('Reconciliation','GST Supplies'),('Reconciliation','Gross Bank Credits'),('Reconciliation','Internal Credits'),('Reconciliation','Loan Candidates'),('Reconciliation','Adjusted Credit Candidates')],32,658,1376,230,[120,230,230,230,230,265],sort=(('Reconciliation','Month'),'Ascending'))
coverage(p,'Reconciliation',32,912,1376,100)
p.text('PARTY-WISE MATCHING REQUIREMENT\nSupply GSTR-1 B2B/export tables and the customer ledger with GSTIN, invoice/date, tax-inclusive amount and opening receivables. Confirm bank-name aliases before matching receipts.\nGSTR-2B / purchase ledger is also needed for supplier analysis. June 2026 GST and April-June 2025 banking are outside the shared period.',32,1036,1376,86,11,INK)
p.text('A zero value is used only where the source declares zero. Missing party-level GST values are not treated as zero and no artificial party variances are calculated.',32,1130,1376,26,10,AMBER,BG)

p=Page('4. Financial & Credit Analysis','Royal Enterprises / income tax & audit review','Three financial years  |  INR crore  |  Profit is before proprietor personal income tax  |  FY2025-26 is provisional',4);height(p,1800)
year=p.slicer('Finance Year','Financial Year','Select financial year',32,w=676,sync=True)
year['position']['height']=72
year['position']['y']=140
year['visual']['objects']['data']=props(mode=lit('Basic'))
year['visual']['objects']['general']=props(orientation=lit(1),filter={'filter':categorical('Finance Year','Financial Year',['2025-26'])['filter']})
p.text('2023-24 audited  •  2024-25 audited  •  2025-26 provisional',732,156,676,44,12,AMBER,BG,True)
for m,l,n,x in [('Finance Sales Cr','Sales','INR crore • selected statement year',32),('Finance Profit Cr','Reported net profit','Before proprietor personal income tax',382),('Finance EBITDA Cr','EBITDA','Reported pre-tax profit + interest + D&A',732),('Finance Debt Cr','Total debt','Includes friends/relatives borrowing',1082)]:p.kpi(m,l,n,x)
trend1=p.chart('clusteredColumnChart','Three-year sales trend  |  INR crore',('Financials','Financial Year'),['Finance Sales Cr'],32,374,676,218)
trend2=p.chart('clusteredColumnChart','Three-year profit and debt  |  INR crore',('Financials','Financial Year'),['Finance Profit Cr','Finance Debt Cr'],732,374,676,218)
p.no_interaction(year,[trend1,trend2])
p.table('Selected-year credit ratios',[('Financials','Financial Year'),('Financials','Statement Status'),'Debt Equity','Current Ratio','Interest Cover','Reported Margin'],32,616,1376,144,[180,190,225,225,225,225],sort=(('Financials','Financial Year'),'Ascending'))
p.text('ALL 25 FINANCIAL & CREDIT PARAMETERS  •  Results and evidence update with the year filter',32,780,1376,34,15,INK,BG,True)
p.table('Formula, result and evidence register  |  scroll to see all 25 parameters',[('Financial Parameters','No'),('Financial Parameters','Parameter'),('Financial Parameters','Formula'),('Financial Parameters','Result'),('Financial Parameters','Evidence'),('Financial Parameters','Interpretation')],32,830,1376,528,[45,230,260,200,170,420],sort=(('Financial Parameters','No'),'Ascending'))
p.text('LOAN OBLIGATIONS  •  7 JULY 2026 SNAPSHOT  •  Separate from the selected annual statements',32,1380,1376,30,14,INK,BG,True)
p.table('Loan schedule  |  INR',[('Loan Schedule','Lender'),('Loan Schedule','Security'),('Loan Schedule','Sanctioned'),('Loan Schedule','Disbursed'),('Loan Schedule','Monthly EMI')],32,1424,852,188,[260,150,160,160,160],sort=(('Loan Schedule','Lender'),'Ascending'))
p.text('SOURCE TOTAL DISCREPANCY\nEMI rows total INR56.87 lakh/month. Printed total is INR54.45 lakh; the difference INR2.42 lakh equals the Siemens EMI.\nNo annual DSCR is inferred.',908,1424,500,188,11,AMBER)
p.text('EVIDENCE-BASED SWOT & BUREAU SNAPSHOT\nStrength: rising sales/profit. Weakness: rising debt/receivables. Opportunity: verify collections. Threat: provisional figures and bureau-reported 96% WC utilisation. On 7 Jul 2026: personal CIBIL 756 (p1), dispute under review dated 25 Apr 2023; company 31 open, 17 closed, 0 delinquent (p2), rank a dash. Full personal account histories have not been reviewed.',32,1634,1376,88,11,INK)
p.text('YEAR CORRECTION: The folder says FY2026-27, but the provisional balance sheet and P&L explicitly say 31 March 2026. Displayed as FY2025-26.',32,1730,1376,28,10,AMBER,BG)

for p in P:p.write()
save(R/'definition'/'pages'/'pages.json',{'$schema':S+'pagesMetadata/1.0.0/schema.json','pageOrder':[p.name for p in P],'activePageName':P[0].name})
old=B.parent/'output'/'SarangiCreditReview'/'SarangiCreditReview.Report'
for name in ['report.json','version.json']:shutil.copy2(old/'definition'/name,R/'definition'/name)
shutil.copytree(old/'StaticResources',R/'StaticResources',dirs_exist_ok=True)
for folder,typ in [(R,'Report'),(MODEL,'SemanticModel')]:
    save(folder/'.platform',{'$schema':'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json','metadata':{'type':typ,'displayName':'Royal Enterprises Credit Review'},'config':{'version':'2.0','logicalId':str(uuid.uuid5(uuid.NAMESPACE_URL,'royal-enterprises/'+typ))}})
save(R/'definition.pbir',{'version':'4.0','datasetReference':{'byPath':{'path':'../RoyalEnterprisesCreditReview.SemanticModel'}}})
save(MODEL/'definition.pbism',{'version':'4.2','settings':{}})
save(ROOT/'RoyalEnterprisesCreditReview.pbip',{'version':'1.0','artifacts':[{'report':{'path':'RoyalEnterprisesCreditReview.Report'}}],'settings':{'enableAutoRecovery':True}})
save(ROOT/'BuildManifest.json',{'company':'Royal Enterprises','pages':[p.title for p in P],'visuals':sum(len(p.v) for p in P),'financialYears':['2023-24','2024-25','2025-26'],'provisionalYear':'2025-26','snapshot':True,'dataChecks':json.loads((B/'data-checks.json').read_text())})
print(json.dumps({'pages':[p.title for p in P],'visuals':sum(len(p.v) for p in P)},indent=2))
