import pathlib,json,uuid,shutil,sys,html,math
BASE=pathlib.Path(__file__).resolve().parent
OUT=BASE/'output'
ROOT=OUT/'SarangiCreditReview'
REPORT=ROOT/'SarangiCreditReview.Report'
MODEL=ROOT/'SarangiCreditReview.SemanticModel'
SOURCE=pathlib.Path(r'C:\Users\loanb\OneDrive\Desktop\Power BI')
SCHEMA='https://developer.microsoft.com/json-schemas/fabric/item/report/definition/'
defs=json.loads((OUT/'measure-definitions.json').read_text())
measure_table={m['name']:m['tableName'] for m in defs}
data=json.loads((OUT/'normalized-data.json').read_text())
def save(p,obj):
    p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(obj,indent=2,ensure_ascii=False),encoding='utf-8')
def uid(): return uuid.uuid4().hex[:20]
def lit(x): return {'expr':{'Literal':{'Value':str(x).lower() if isinstance(x,bool) else str(x) if isinstance(x,(int,float)) else "'"+x.replace("'","''")+"'"}}}
def color(x): return {'solid':{'color':lit(x)}}
def prop(**kw): return [{'properties':kw}]
def col(t,n): return {'Column':{'Expression':{'SourceRef':{'Entity':t}},'Property':n}}
def mea(n): return {'Measure':{'Expression':{'SourceRef':{'Entity':measure_table[n]}},'Property':n}}
def field(x): return col(*x) if isinstance(x,tuple) else mea(x)
def projection(x):
    return {'field':field(x),'queryRef':'.'.join(x) if isinstance(x,tuple) else measure_table[x]+'.'+x,'nativeQueryRef':x[1] if isinstance(x,tuple) else x}
NAVY='#152C41'; TEAL='#087E83'; GOLD='#C78F33'; INK='#223B50'; MUTED='#62778A'; BG='#F1F5F8'; RED='#B54444'
pages=[]; previews=[]
class Page:
    def __init__(self,title,subtitle,section):
        self.name=uid(); self.title=title; self.subtitle=subtitle; self.section=section; self.visuals=[]; pages.append(self)
        self.text(title,32,22,1536,48,30,'#FFFFFF',NAVY,True)
        self.text(subtitle,32,80,1536,40,12,MUTED,BG)
        self.text(f'SARANGI METAL WORKS INTERNATIONAL PRIVATE LIMITED    /    CREDIT DUE DILIGENCE    /    {section}',32,963,1536,25,9,MUTED,BG)
    def visual(self,typ,title,x,y,w,h,roles=None,objects=None,sort=None,bg='#FFFFFF'):
        n=uid(); vis={'visualType':typ,'drillFilterOtherVisuals':True,'visualContainerObjects':{
            'title':prop(show=lit(bool(title)),text=lit(title),fontSize=lit(13),fontColor=color(INK),bold=lit(True),fontFamily=lit('Segoe UI')),
            'background':prop(show=lit(True),color=color(bg),transparency=lit(0)),
            'border':prop(show=lit(True),color=color('#DFE7ED'),radius=lit(8)),
            'visualHeader':prop(show=lit(False)),
            'general':prop(altText=lit(title or self.title))}}
        if roles:
            vis['query']={'queryState':{role:{'projections':[projection(f) for f in fs]} for role,fs in roles.items()}}
            if sort:
                vis['query']['sortDefinition']={'sort':[{'field':field(sort[0]),'direction':sort[1]}],'isDefaultSort':False}
        if objects: vis['objects']=objects
        obj={'$schema':SCHEMA+'visualContainer/2.4.0/schema.json','name':n,'position':{'x':x,'y':y,'width':w,'height':h,'z':len(self.visuals),'tabOrder':len(self.visuals)},'visual':vis}
        self.visuals.append(obj)
        return obj
    def text(self,text,x,y,w,h,size=13,fg=INK,bg='#FFFFFF',bold=False):
        paragraphs=[{'textRuns':[{'value':line,'textStyle':{'fontFamily':'Segoe UI','fontSize':f'{size}pt','color':fg,'fontWeight':'bold' if bold else 'normal'}}]} for line in text.split('\n')]
        o=self.visual('textbox','',x,y,w,h,objects={'general':prop(paragraphs=paragraphs)},bg=bg)
        o['visual']['visualContainerObjects']['border']=prop(show=lit(False))
    def card(self,m,label,x,y,w=368,h=115,accent=TEAL):
        v=self.visual('card',label,x,y,w,h,{'Values':[m]},objects={'labels':prop(color=color(accent),fontSize=lit(24),labelDisplayUnits=lit(1),labelPrecision=lit(2)),'categoryLabels':prop(show=lit(False))})
        v['visual']['visualContainerObjects']['title'][0]['properties']['fontSize']=lit(10)
    def chart(self,typ,title,axis,values,x,y,w,h,descending=False):
        self.visual(typ,title,x,y,w,h,{'Category':[axis],'Y':values},objects={'legend':prop(show=lit(len(values)>1),position=lit('Top')),'categoryAxis':prop(fontSize=lit(10)),'valueAxis':prop(fontSize=lit(10),labelDisplayUnits=lit(10000000)),'dataPoint':prop(defaultColor=color(TEAL))},sort=(values[0],'Descending') if descending else (axis,'Ascending'))
    def table(self,title,fields,x,y,w,h,sort=None):
        self.visual('tableEx',title,x,y,w,h,{'Values':fields},objects={'grid':prop(gridVertical=lit(False),gridHorizontal=lit(True),rowPadding=lit(7)),'columnHeaders':prop(fontSize=lit(10),fontColor=color('#FFFFFF'),backColor=color(NAVY),wordWrap=lit(True)),'values':prop(fontSize=lit(10),fontColorPrimary=color(INK),wordWrap=lit(True)),'total':prop(totals=lit(False))},sort=sort)
    def slicer(self,t,c,x,y,w=300,h=70):
        self.visual('slicer',c,x,y,w,h,{'Values':[(t,c)]},objects={'data':prop(mode=lit('Dropdown')),'selection':prop(singleSelect=lit(False),selectAllCheckboxEnabled=lit(True))})
    def write(self):
        root=REPORT/'definition'/'pages'/self.name
        save(root/'page.json',{'$schema':SCHEMA+'page/2.1.0/schema.json','name':self.name,'displayName':self.title,'displayOption':'FitToPage','width':1600,'height':1000,'objects':{'background':prop(color=color(BG),transparency=lit(0))}})
        for v in self.visuals: save(root/'visuals'/v['name']/'visual.json',v)

p=Page('01  Credit overview','Historical evidence snapshot | Financials: FY2023-24 default • GST TTM: Oct2023–Sep2024 • Banking: Apr–Dec2024 | Amounts in INR','01 / 08')
p.card('FY Sales','FY2023-24 operating revenue',32,140)
p.card('FY Net Profit','FY2023-24 profit after tax',424,140)
p.card('Banking Turnover','Bank net credits / source BTO',816,140)
p.card('GST TTM Revenue','GST adjusted revenue / stated TTM',1208,140,360)
p.chart('clusteredColumnChart','Operating revenue by financial year • INR',('Financials','Financial Year'),['FY Sales'],32,280,752,280)
p.chart('lineChart','Bank cash movements • INR (axis in crore)',('Calendar','Month Label'),['Gross Inflows','Gross Outflows'],808,280,760,280)
p.text('LEVERAGE & COVERAGE\nFY2023-24 debt/equity: 13.05x. Core operating interest coverage: 1.18x.\nPAT-based EBIT includes other income; both definitions are exposed on the financial page.',32,584,752,146,15,INK,'#FFFFFF')
p.text('REVIEW PRIORITIES\n77 of 112 GST returns were filed late against supplied due dates.\nMissing bank statement dates and limited party-name matching constrain reconciliation.\nSource flags are historical provider observations as of December 2024.',808,584,760,146,15,INK,'#FFFFFF')
p.card('Historical Red Flags','Historical provider red flags',32,754,368,135,RED)
p.card('Missing Requirements','Requirements missing source evidence',424,754,368,135,GOLD)
p.text('Navigate the report tabs for GST, counterparties, banking, reconciliation, financials, filing compliance and evidence coverage.\nThis report is a source-data snapshot. It does not establish current 2026 financial performance or a credit approval.',816,754,752,135,14,INK,'#FFFFFF')

p=Page('02  GST performance','Monthly adjusted taxable values | Aug2022–Sep2024 | Annual and TTM duplicate columns excluded | Charts: axis in crore INR','02 / 08')
p.slicer('Calendar','Financial Year',32,125,360); p.slicer('Calendar','Month Label',424,125,360)
for m,l,x in [('GST Revenue','Adjusted GST revenue',32),('GST Purchases','Purchases & expenses',424),('Export Share','Exports / adjusted revenue',816),('GST Margin Share','Taxable-value margin',1208)]: p.card(m,l,x,218,360)
p.chart('lineChart','Revenue and purchases by month',('Calendar','Month Label'),['GST Revenue','GST Purchases'],32,358,1536,280)
p.chart('clusteredBarChart','Revenue by state / source bucket',('GST State','State'),['State Revenue'],32,660,752,280,True)
p.chart('clusteredColumnChart','Export revenue by month',('Calendar','Month Label'),['GST Exports'],808,660,760,280)

p=Page('03  Buyers & suppliers','GSTIN-valid monthly party detail | Shares use selected period and role | Party names and GSTIN remain traceable to source rows','03 / 08')
p.slicer('Calendar','Financial Year',32,125,360); p.slicer('Calendar','Month Label',424,125,360); p.slicer('GST Parties','Role',816,125,360)
p.chart('clusteredBarChart','Buyers ranked by taxable sales • INR',('GST Parties','Party'),['Buyer Sales'],32,220,752,320,True)
p.chart('clusteredBarChart','Suppliers ranked by taxable purchases • INR',('GST Parties','Party'),['Supplier Purchases'],808,220,760,320,True)
p.table('Counterparty detail • select a role to inspect concentration',[('GST Parties','Role'),('GST Parties','Party'),('GST Parties','GSTIN'),'Party Amount','Party Share'],32,562,1536,378,sort=('Party Amount','Descending'))

p=Page('04  Banking behaviour','Consolidated transactions only | Apr–Dec2024 | Net/BTO measures use source MoM definitions; gross cash flows retain loans, reversals and transfers','04 / 08')
p.slicer('Calendar','Month Label',32,125,360); p.slicer('Bank Transactions','Account',424,125,360)
p.text('Account selection filters transaction visuals only. Consolidated BTO and return metrics remain at source monthly scope.',816,125,752,70,12,MUTED,BG)
for m,l,x in [('Gross Inflows','Gross inflows / selected account',32),('Gross Outflows','Gross outflows / selected account',424),('Credit Entries','Credit entries / selected account',816),('Cheque Return Count','Consolidated inward returns',1208)]: p.card(m,l,x,218,360)
p.chart('lineChart','Gross monthly inflows and outflows • INR',('Calendar','Month Label'),['Gross Inflows','Gross Outflows'],32,358,752,255)
p.chart('clusteredBarChart','Outflows by source classification • INR',('Bank Transactions','Category'),['Gross Outflows'],808,358,760,255,True)
p.table('Party cash flows • source-provided names; blank counterparties retained',[('Bank Transactions','Party'),'Gross Inflows','Gross Outflows','Credit Entries'],32,636,1000,304,sort=('Gross Inflows','Descending'))
p.table('Monthly source metrics',[('Bank Monthly','Month'),'Banking Turnover','Loan Disbursements','Penal Charges'],1056,636,512,220)
p.text('CC UTILISATION: unavailable\nSanction limits are missing.\nRegistered charges are not sanction limits.',1056,871,512,70,11,MUTED,'#FFFFFF')

p=Page('05  GST × bank reconciliation','Shared period: Apr–Sep2024 only | Exact names after case / punctuation / spacing normalization | No inferred or fuzzy settlement matches','05 / 08')
p.slicer('Party Reconciliation','Match Status',32,125,500)
p.text('GST amounts exclude GST tax. Bank receipts/payments are gross cash and may include transfers or loans. Variance is a review prompt, not an outstanding balance.',556,125,1012,70,13,INK,'#FFF4DF')
for m,l,x in [('Common GST Sales','GST buyer taxable sales',32),('Common Bank Receipts','Gross bank receipts',424),('Sales Cash Variance','Taxable sales less gross receipts',816),('Name Match Coverage','Receipts with exact GST party name',1208)]: p.card(m,l,x,218,360)
p.chart('clusteredColumnChart','Shared-month sales vs gross receipts • INR',('Calendar','Month Label'),['Common GST Sales','Common Bank Receipts'],32,358,1000,250)
p.card('Unmatched Bank Receipts','Receipts requiring party identification',1056,358,512,115,GOLD)
p.text('MATCHING LIMITS\nNo party GSTIN or invoice reference is supplied in bank data. Exact name matches establish identity candidates, not invoice-level payment reconciliation.',1056,490,512,118,12,MUTED,'#FFFFFF')
p.table('Triangular review • GST sales & purchases vs bank receipts & payments',[('Party Reconciliation','Party'),('Party Reconciliation','Match Status'),'Common GST Sales','Common Bank Receipts','Sales Cash Variance','Common GST Purchases','Common Bank Payments','Purchases Cash Variance'],32,630,1536,310,sort=('Common Bank Receipts','Descending'))

p=Page('06  Financial & credit ratios','Detailed statements in INR | Financial measures use latest selected FY; default FY2023-24 | Closing balances used for collection / stock days','06 / 08')
p.slicer('Financials','Financial Year',32,125,360)
p.text('PDF “EBITA” adds depreciation and amortization; labelled EBITDA below. PAT-based EBITDA includes other income. Source-reported EBITDA is shown separately.',424,125,1144,70,12,INK,'#FFF4DF')
for m,l,x in [('Current Ratio','Current assets / liabilities',32),('Quick Ratio','Quick ratio',424),('Debt Equity Ratio','Total debt / equity',816),('Operating Interest Coverage','Core operating interest coverage',1208)]: p.card(m,l,x,218,360)
p.chart('clusteredColumnChart','PAT-based EBITDA vs source EBITDA • INR',('Financials','Financial Year'),['EBITDA - PDF EBITA','FY Reported EBITDA','FY Net Profit'],32,358,752,250)
p.table('Profitability & leverage by fiscal year',[('Financials','Financial Year'),'FY Sales','FY Net Profit','Net Profit Margin','TOL TNW Ratio','Debt Reported EBITDA'],808,358,760,250)
p.table('Liquidity, capital and collection periods',[('Financials','Financial Year'),'Working Capital','Debtor Days','Creditor Days','Stock Days','Reserves Equity Proxy'],32,630,1536,170)
p.text('DEFINITIONS\nEBIT = PAT + finance costs + current/deferred tax. Operating EBIT excludes Other Income. TOL = current + non-current liabilities.\nTotal debt already includes disclosed unsecured borrowings. Reserves/equity is a proxy; promoter personal net worth is unavailable.\nDSCR, drawing power and OCF/interest remain blank until supporting schedules are supplied.',32,820,1536,120,13,MUTED,'#FFFFFF')

p=Page('07  Filing & source flags','Filing delays recomputed from supplied dates, not current statutory advice | Provider flags are historical source observations, not independently verified','07 / 08')
p.slicer('GST Filings','State',32,125,360); p.slicer('GST Filings','Return',424,125,360); p.slicer('Calendar','Financial Year',816,125,360)
for m,l,x in [('Filings Reviewed','Returns with filing dates',32),('Late Filings','Returns filed after supplied due date',424),('Late Filing Share','Delayed share',816),('Maximum Filing Delay','Longest filing delay',1208)]: p.card(m,l,x,218,360)
p.table('Return-by-return filing trail',[('GST Filings','GSTIN'),('GST Filings','Return'),('GST Filings','Month'),('GST Filings','Due Date'),('GST Filings','Filing Date'),('GST Filings','Delay Days')],32,358,1536,275,sort=(('GST Filings','Delay Days'),'Descending'))
p.table('Historical credit / governance flags • supplied as of December 2024',[('Source Flags','Severity'),('Source Flags','Area'),('Source Flags','Flag')],32,655,1536,285)

p=Page('08  Evidence & methodology','Requirement coverage against CREDIT DUE DILIGENCE – REVIEW PARAMETERS | Missing evidence is visible and is never replaced with a zero or an assumed value','08 / 08')
p.slicer('Review Coverage','Area',32,125,360); p.slicer('Review Coverage','Status',424,125,360)
p.card('Requirements Reviewed','Checklist items in selected scope',816,125,360,110)
p.card('Missing Requirements','Items requiring additional source evidence',1208,125,360,110,GOLD)
p.table('Evidence register • definitions, source limitations and follow-up',[('Review Coverage','Area'),('Review Coverage','Requirement'),('Review Coverage','Status'),('Review Coverage','Evidence or Gap')],32,258,1536,440)
p.text('EVIDENCE-BASED SWOT / REVIEW NOTES\nStrength: FY2023-24 operating revenue and PAT increased vs prior year in the supplied statements.\nWeakness: high debt/equity (13.05x), thin PAT margin (0.86%) and core interest coverage (1.18x).\nOpportunity: collect invoice/GSTIN mappings, missing statement dates and debt schedules to improve underwriting evidence.\nThreat: historical delayed GST filings and provider litigation/governance flags require verification and follow-up.',32,720,1000,220,13,INK,'#FFFFFF')
p.text('SNAPSHOT & REFRESH\nImported values are embedded for reproducibility.\nPower BI Refresh reloads the embedded snapshot.\nTo update from revised Excel workbooks, rerun the extraction script and replace model table expressions.\nNo source workbooks were edited.',1056,720,512,220,13,MUTED,'#FFFFFF')

REPORT.mkdir(parents=True,exist_ok=True); MODEL.mkdir(parents=True,exist_ok=True)
for p in pages: p.write()
save(REPORT/'definition'/'pages'/'pages.json',{'$schema':SCHEMA+'pagesMetadata/1.0.0/schema.json','pageOrder':[p.name for p in pages],'activePageName':pages[0].name})
shutil.copytree(SOURCE/'testin1.Report'/'StaticResources',REPORT/'StaticResources',dirs_exist_ok=True)
r=json.loads((SOURCE/'testin1.Report'/'definition'/'report.json').read_text())
save(REPORT/'definition'/'report.json',r)
shutil.copy2(SOURCE/'testin1.Report'/'definition'/'version.json',REPORT/'definition'/'version.json')
save(REPORT/'definition.pbir',{'version':'4.0','datasetReference':{'byPath':{'path':'../SarangiCreditReview.SemanticModel'}}})
save(MODEL/'definition.pbism',{'version':'4.2','settings':{}})
save(ROOT/'SarangiCreditReview.pbip',{'version':'1.0','artifacts':[{'report':{'path':'SarangiCreditReview.Report'}}],'settings':{'enableAutoRecovery':True}})
for path,typ in [(REPORT,'Report'),(MODEL,'SemanticModel')]:
    save(path/'.platform',{'$schema':'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json','metadata':{'type':typ,'displayName':'Sarangi Credit Review'},'config':{'version':'2.0','logicalId':str(uuid.uuid4())}})

# A standalone inspection preview of the real page structure; native charts render in Power BI.
preview=['<!doctype html><meta charset="utf-8"><title>Sarangi Credit Review — page preview</title><style>body{background:#dfe7ed;font-family:Segoe UI;margin:0;padding:25px}nav{position:sticky;top:0;background:#152c41;padding:14px;z-index:1000}a{color:white;margin-right:15px;font-size:12px}.page{position:relative;background:'+BG+';width:1600px;height:1000px;margin:30px auto;box-shadow:0 8px 40px #52677930}.v{position:absolute;box-sizing:border-box;border-radius:8px;padding:12px;overflow:hidden;background:white;border:1px solid #dfe7ed}.label{font-size:16px;font-weight:600;color:'+INK+'}.placeholder{color:'+MUTED+';font-size:13px;margin-top:18px}table{border-collapse:collapse;font-size:11px;width:100%}td,th{text-align:left;padding:6px;border-bottom:1px solid #e4e9ed}th{background:'+NAVY+';color:white}</style><nav>']
preview+=['<a href="#'+p.name+'">'+html.escape(p.title)+'</a>' for p in pages]; preview+=['</nav>']
for p in pages:
    preview.append('<section class="page" id="'+p.name+'">')
    for v in p.visuals:
        pos=v['position']; conf=v['visual']; typ=conf['visualType']; title=conf['visualContainerObjects']['title'][0]['properties']['text']['expr']['Literal']['Value'][1:-1]
        content='<div class="label">'+html.escape(title)+'</div>'
        bg='#FFFFFF'
        if typ=='textbox':
            paras=conf['objects']['general'][0]['properties']['paragraphs']; run=paras[0]['textRuns'][0]; sz=run['textStyle']['fontSize']; fg=run['textStyle']['color']; bg=conf['visualContainerObjects']['background'][0]['properties']['color']['solid']['color']['expr']['Literal']['Value'][1:-1]
            content=''.join('<div style="font-size:'+sz+';color:'+fg+';font-weight:'+run['textStyle']['fontWeight']+'">'+html.escape(t['textRuns'][0]['value'])+'</div>' for t in paras)
        else:
            fs=[f for role in conf.get('query',{}).get('queryState',{}).values() for f in role['projections']]
            content+='<div class="placeholder">'+html.escape(' · '.join(f['nativeQueryRef'] for f in fs))+'</div>'
            content+='<div class="placeholder">'+('Interactive chart — renders in Power BI' if typ!='slicer' else 'Interactive dropdown slicer')+'</div>'
        preview.append('<div class="v" style="left:'+str(pos['x'])+'px;top:'+str(pos['y'])+'px;width:'+str(pos['width'])+'px;height:'+str(pos['height'])+'px;background:'+bg+'">'+content+'</div>')
    preview.append('</section>')
(ROOT/'LayoutPreview.html').write_text(''.join(preview),encoding='utf-8')
shutil.copytree(OUT/'CreditReviewData',ROOT/'CreditReviewData',dirs_exist_ok=True)
shutil.copy2(OUT/'validation.json',ROOT/'validation.json')
save(ROOT/'BuildManifest.json',{'pages':len(pages),'visuals':sum(len(p.visuals) for p in pages),'tables':len(data),'measures':len(defs),'source':str(SOURCE),'snapshot':True})
print(json.dumps({'project':str(ROOT),'pages':len(pages),'visuals':sum(len(p.visuals) for p in pages)},indent=2))
