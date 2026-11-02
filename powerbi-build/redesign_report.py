"""Four readable report tabs, with explicit units and all PDF calculations."""
import pathlib,json,shutil,uuid
B=pathlib.Path(__file__).resolve().parent; D=B/'redesign'
ROOT=D/'FourTabFinal'; R=ROOT/'SarangiCreditReview.Report'; MODEL=ROOT/'SarangiCreditReview.SemanticModel'
OLD=pathlib.Path(r'C:\Users\loanb\OneDrive\Desktop\Power BI\SarangiCreditReview')
# This final staging directory uses stable page and visual IDs. Prior drafts are retained separately.
S='https://developer.microsoft.com/json-schemas/fabric/item/report/definition/'
MM=json.loads((D/'all-measures.json').read_text()); MT={m['name']:m['tableName'] for m in MM}
NAVY='#132B40'; INK='#243B50'; MUTED='#6D8091'; BG='#F3F6FA'; BLUE='#2468A0'; TEAL='#128478'; AMBER='#A86616'; RULE='#E0E7EF'
def uid():return uuid.uuid4().hex[:20]
def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,indent=2,ensure_ascii=False),encoding='utf-8')
def lit(v):return {'expr':{'Literal':{'Value':str(v).lower() if isinstance(v,bool) else str(v)+'D' if isinstance(v,(int,float)) else "'"+v.replace("'","''")+"'"}}}
def color(v):return {'solid':{'color':lit(v)}}
def props(**kw):return [{'properties':kw}]
def field(x):
    t,n,kind=(x[0],x[1],'Column') if isinstance(x,tuple) else (MT[x],x,'Measure')
    return {kind:{'Expression':{'SourceRef':{'Entity':t}},'Property':n}}
def project(x,label=None):
    n=x[1] if isinstance(x,tuple) else x
    d={'field':field(x),'queryRef':'.'.join(x) if isinstance(x,tuple) else MT[x]+'.'+x,'nativeQueryRef':n}
    if label:d['displayName']=label
    return d
P=[]
class Page:
    def __init__(self,title,kicker,scope,index):
        self.name=uuid.uuid5(uuid.NAMESPACE_URL,'sarangi-credit-review/four-tabs/'+title).hex[:20];self.title=title;self.v=[];self.interactions=[];self.filters=[];P.append(self)
        self.text('',0,0,1440,102,bg=NAVY)
        self.text(kicker.upper(),32,14,1300,22,10,'#8FC4CB',NAVY,True)
        self.text(title,32,39,1376,49,28,'#FFFFFF',NAVY,True)
        self.text(scope,32,111,1376,26,11,MUTED,BG)
        self.text('SARANGI METAL WORKS INTERNATIONAL PRIVATE LIMITED',32,1164,950,22,9,MUTED,BG)
        self.text(f'{index:02d} / 04     •     Historical source evidence',1030,1164,378,22,9,MUTED,BG)
    def vis(self,typ,title,x,y,w,h,roles=None,objects=None,sort=None,labels=None,bg='#FFFFFF',border=True):
        z=len(self.v);n=uuid.uuid5(uuid.NAMESPACE_URL,self.name+'/visual/'+str(z)).hex[:20]
        conf={'visualType':typ,'drillFilterOtherVisuals':True,'visualContainerObjects':{
          'title':props(show=lit(bool(title)),text=lit(title),fontSize=lit(12),fontColor=color(INK),bold=lit(True),fontFamily=lit('Segoe UI'),titleWrap=lit(False)),
          'background':props(show=lit(True),color=color(bg),transparency=lit(0)),
          'border':props(show=lit(border),color=color(RULE),radius=lit(5)),
          'visualHeader':props(show=lit(False)),
          'general':props(altText=lit(title or self.title))}}
        if objects:conf['objects']=objects
        if roles:
            conf['query']={'queryState':{k:{'projections':[project(f,(labels or {}).get(f)) for f in fs]} for k,fs in roles.items()}}
            if sort:conf['query']['sortDefinition']={'sort':[{'field':field(sort[0]),'direction':sort[1]}],'isDefaultSort':False}
        v={'$schema':S+'visualContainer/2.4.0/schema.json','name':n,'position':{'x':x,'y':y,'width':w,'height':h,'z':z,'tabOrder':z},'visual':conf}
        self.v.append(v);return v
    def text(self,txt,x,y,w,h,size=12,fg=INK,bg='#FFFFFF',bold=False):
        paragraphs=[{'textRuns':[{'value':t,'textStyle':{'fontFamily':'Segoe UI','fontSize':str(size)+'pt','color':fg,'fontWeight':'bold' if bold else 'normal'}}]} for t in txt.split('\n')]
        return self.vis('textbox','',x,y,w,h,objects={'general':props(paragraphs=paragraphs)},bg=bg,border=False)
    def label(self,measure,x,y,w,h=30,size=11):
        return self.vis('card','',x,y,w,h,{'Values':[measure]},objects={'labels':props(color=color(MUTED),fontSize=lit(size),labelDisplayUnits=lit(1)),'categoryLabels':props(show=lit(False))},bg=BG,border=False)
    def kpi(self,measure,label,note,x,w=326,accent=TEAL):
        self.text('',x,218,w,130,bg='#FFFFFF')
        self.text('',x,218,4,130,bg=accent)
        self.text(label,x+16,230,w-32,26,12,INK,'#FFFFFF',True)
        self.vis('card','',x+12,260,w-24,58,{'Values':[measure]},objects={'labels':props(color=color(accent),fontSize=lit(30),labelDisplayUnits=lit(1)),'categoryLabels':props(show=lit(False))},border=False)
        self.text(note,x+16,321,w-32,23,9,MUTED)
    def slicer(self,t,c,label,x,y=152,w=326,sync=False):
        v=self.vis('slicer',label,x,y,w,52,{'Values':[(t,c)]},objects={'data':props(mode=lit('Dropdown')),'selection':props(singleSelect=lit(sync),selectAllCheckboxEnabled=lit(not sync)),'header':props(show=lit(False)),'items':props(fontSize=lit(11),fontColor=color(INK))})
        if sync:v['visual']['syncGroup']={'groupName':'SelectedFinancialYear','fieldChanges':True,'filterChanges':True}
        return v
    def chart(self,typ,title,axis,vals,x,y,w,h,rank=False):
        objects={'legend':props(show=lit(len(vals)>1),position=lit('Top'),fontSize=lit(10)),'categoryAxis':props(fontSize=lit(10),showAxisTitle=lit(False)),'valueAxis':props(fontSize=lit(10),labelDisplayUnits=lit(1),showAxisTitle=lit(False)),'dataPoint':props(defaultColor=color(BLUE)),'labels':props(show=lit(rank),fontSize=lit(10),labelDisplayUnits=lit(1),labelPrecision=lit(2))}
        objects['dataPoint']=[{'properties':{'defaultColor':color(BLUE)}}]+[{'selector':{'metadata':project(m)['queryRef']},'properties':{'fill':color(c)}} for m,c in zip(vals,[BLUE,TEAL,AMBER])]
        return self.vis(typ,title,x,y,w,h,{'Category':[axis],'Y':vals},objects=objects,sort=(vals[0],'Descending') if rank else (axis,'Ascending'))
    def table(self,title,fs,x,y,w,h,widths,labels=None,sort=None):
        objects={'grid':props(gridVertical=lit(False),gridHorizontal=lit(True),rowPadding=lit(9),outlineColor=color(RULE)),
         'columnHeaders':props(fontSize=lit(11),fontColor=color(INK),backColor=color('#EDF2F7'),wordWrap=lit(True),autoSizeColumnWidth=lit(False)),
         'values':props(fontSize=lit(11),fontColorPrimary=color(INK),backColorPrimary=color('#FFFFFF'),backColorSecondary=color('#F8FAFC'),wordWrap=lit(True)),
         'total':props(totals=lit(False)),
         'columnWidth':[{'selector':{'metadata':project(f)['queryRef']},'properties':{'value':lit(width)}} for f,width in zip(fs,widths)]}
        return self.vis('tableEx',title,x,y,w,h,{'Values':fs},objects=objects,labels=labels,sort=sort)
    def limit_months(self,months):
        expr={'Column':{'Expression':{'SourceRef':{'Source':'c'}},'Property':'Month'}}
        self.filters=[{'name':uid(),'field':field(('Calendar','Month')),'type':'Categorical','filter':{'Version':2,'From':[{'Name':'c','Entity':'Calendar','Type':0}],'Where':[{'Condition':{'In':{'Expressions':[expr],'Values':[[{'Literal':{'Value':"datetime'"+m+"T00:00:00'"}}] for m in months]}}}]}}]
    def no_interaction(self,source,targets):
        for t in targets:self.interactions.append({'source':source['name'],'target':t['name'],'type':'NoFilter'})
    def write(self):
        root=R/'definition'/'pages'/self.name
        d={'$schema':S+'page/2.1.0/schema.json','name':self.name,'displayName':self.title,'displayOption':'FitToWidth','width':1440,'height':1200,'objects':{'background':props(color=color(BG),transparency=lit(0))}}
        if self.filters:d['filterConfig']={'filters':self.filters}
        if self.interactions:d['visualInteractions']=self.interactions
        save(root/'page.json',d)
        for v in self.v:save(root/'visuals'/v['name']/'visual.json',v)

raw=json.loads((B/'output'/'normalized-data.json').read_text(encoding='utf-8'))
p=Page('GST','Credit due diligence / tax & trade','Taxable values in ₹ crore · export sales remain separate from named domestic buyers · GST data ends September 2024',1)
p.limit_months([r[0] for r in raw['GST Monthly']['rows']])
p.slicer('Calendar','Financial Year','GST financial year',32,w=326);p.slicer('Calendar','Month Label','GST month',382,w=326)
p.label('GST Period',732,156,676,42,12)
for m,l,n,x in [('GST Revenue Cr','Adjusted sales','₹ crore · selected GST period',32),('GST Purchases Cr','Purchases & expenses','₹ crore · selected GST period',382),('Export Share','Export share','Exports / adjusted sales',732),('Late Filing Share','Delayed GST filings','Selected taxable months · supplied due dates',1082)]:p.kpi(m,l,n,x)
p.chart('lineChart','Monthly sales and purchases  |  ₹ crore',('Calendar','Month Label'),['GST Revenue Cr','GST Purchases Cr'],32,374,852,254)
p.chart('clusteredBarChart','Six largest buyers  |  ₹ crore',('GST Parties','Party'),['Top Buyer Cr'],908,374,500,254,True)
p.chart('clusteredBarChart','Revenue by state / source bucket  |  ₹ crore',('GST State','State'),['State Revenue Cr'],32,650,676,230,True)
p.chart('clusteredBarChart','Six largest suppliers  |  ₹ crore',('GST Parties','Party'),['Top Supplier Cr'],732,650,676,230,True)
p.table('Buyer / supplier concentration',[('GST Parties','Role'),('GST Parties','Party'),'Party Amount Cr','Party Share'],32,902,676,220,[90,335,110,95],{'Party Amount Cr':'₹ crore','Party Share':'Share'},sort=('Party Amount Cr','Descending'))
p.table('Filing date & delay trail',[('GST Filings','State'),('GST Filings','Return'),('GST Filings','Filing Date'),('GST Filings','Delay Days')],732,902,676,220,[170,120,185,115],sort=(('GST Filings','Delay Days'),'Descending'))
p.text('Evidence gaps: HSN detail and late-fee amounts are absent. Related-party mapping needs verification; group revenue is zero in the supplied group summary.',32,1130,1376,26,10,AMBER,BG)

p=Page('Finance','Credit due diligence / statements','Audited statement schedules · ₹ crore throughout · year selector controls KPIs and comparison, while trend charts retain all years',2)
p.slicer('Review Year','Financial Year','Financial year · default 2023–2024',32,w=326,sync=True)
p.label('Finance Header',382,153,1026,46,12)
for m,l,n,x in [('Finance Revenue Cr','Operating revenue','₹ crore · selected financial year',32),('Finance EBITDA Cr','Operating EBITDA','₹ crore · source statement definition',382),('Finance PAT Cr','Profit after tax','₹ crore · after current and deferred tax',732),('Finance TNW Cr','Tangible net worth','₹ crore · corporate equity less intangibles',1082)]:p.kpi(m,l,n,x)
p.chart('clusteredColumnChart','Revenue trend  |  ₹ crore',('Financials','Financial Year'),['Finance Revenue Cr'],32,374,676,254)
p.chart('clusteredColumnChart','Operating EBITDA and PAT  |  ₹ crore',('Financials','Financial Year'),['Finance EBITDA Cr','Finance PAT Cr'],732,374,676,254)
p.table('Statements  |  prior vs selected financial year',[('Statement Layout','Line Item'),'Statement Prior Cr','Statement Current Cr','Statement Change'],32,650,880,472,[365,155,165,130],{'Statement Prior Cr':'Prior FY · Cr','Statement Current Cr':'Selected FY · Cr','Statement Change':'Change %'},sort=(('Statement Layout','Line Item'),'Ascending'))
p.table('Evidence-based SWOT · selected FY',[('Credit Notes','Topic'),'Credit Interpretation'],936,650,472,315,[110,315],{'Credit Interpretation':'Observation'},sort=(('Credit Notes','Topic'),'Ascending'))
p.text('UNDERWRITING FOLLOW-UP\nObtain annual debt repayments and operating cash flow. Verify source court/GST flags and obtain a current bureau report. Corporate equity does not establish promoter personal net worth.',936,983,472,139,11,INK)
p.text('Source operating EBITDA excludes other income. PDF-derived EBIT/EBITDA and every financial ratio are explained in Financial Calculations.',32,1130,1376,26,10,MUTED,BG)

p=Page('Banking','Credit due diligence / cash conduct','Consolidated supplied statements · April–December 2024 · same month selection applies to all banking KPIs · amounts in ₹ crore unless marked INR',3)
p.limit_months([r[0] for r in raw['Bank Monthly']['rows']])
month_sel=p.slicer('Calendar','Month Label','Banking month',32,w=326)
p.label('Bank Period',382,153,1026,46,12)
for m,l,n,x in [('Bank Inflows Cr','Gross credits','₹ crore · loans/transfers retained',32),('BTO Cr','Banking turnover','₹ crore · source net credits',382),('Credit Entries','Credit entries','Includes four zero-value source credits',732),('Cheque Return Count','Inward cheque returns','Source consolidated monthly return count',1082)]:p.kpi(m,l,n,x,accent=TEAL if x!=1082 else AMBER)
p.chart('lineChart','Cash flow trend  |  ₹ crore',('Calendar','Month Label'),['Bank Inflows Cr','Bank Outflows Cr'],32,374,852,254)
p.table('Cash conduct & exceptions',[('Bank Controls','Control'),'Bank Control Result'],908,374,500,350,[280,170],{'Bank Control Result':'Result'},sort=(('Bank Controls','Control'),'Ascending'))
p.table('Party receipts and payments',[('Bank Transactions','Party'),'Bank Inflows Cr','Bank Outflows Cr','Credit Entries'],32,650,852,258,[425,130,135,100],{'Bank Inflows Cr':'Receipts · Cr','Bank Outflows Cr':'Payments · Cr','Credit Entries':'Credits'},sort=('Bank Inflows Cr','Descending'))
p.text('Statement dates are missing in the source. BTO reflects the supplied records; sanction limits and utilisation schedules are not supplied.',908,742,500,166,12,AMBER)
recon=p.table('GST–bank review  |  fixed shared period: April–September 2024',[('Party Reconciliation','Party'),'Common GST Sales Cr','Common Receipts Cr',('Party Reconciliation','Match Status')],32,930,880,192,[390,125,125,180],{'Common GST Sales Cr':'GST sales · Cr','Common Receipts Cr':'Receipts · Cr'},sort=('Common Receipts Cr','Descending'))
match=p.label('Name Match Display',936,930,472,40,10)
p.text('Reconciliation is kept at the shared April–September period, independent of the month selector.\nGST values exclude tax; bank cash includes timing differences, financing and transfers. Variance is not a debtor balance. No fuzzy name matches are accepted.',936,982,472,140,11,INK)
p.no_interaction(month_sel,[recon,match])
# Page-level month scope is Apr–Dec; reconciliation rows themselves only contain Apr–Sep.
p.text('Internal transfers are an analytical subset of gross flows, not an additional flow to add. A blank source EMI-return field is shown as “Not reported”.',32,1130,1376,26,10,MUTED,BG)

p=Page('Financial Calculations','Credit due diligence / formula & evidence register','All 25 numbered parameters from the credit due diligence PDF · results carry formula, evidence status and interpretation',4)
p.slicer('Review Year','Financial Year','Financial year · default 2023–2024',32,w=326,sync=True)
p.slicer('Calculation Register','Category','Calculation category',382,w=326)
p.slicer('Calculation Register','Evidence Status','Evidence status',732,w=326)
p.label('Register Scope',1082,152,326,52,11)
for m,l,n,x in [('Current Ratio','Current ratio','Current assets / current liabilities',32),('Quick Ratio','Quick ratio','Inventory excluded from current assets',382),('Debt Equity Ratio','Debt / equity','Interest-bearing debt / corporate equity',732),('Operating Interest Coverage','Core interest cover','Operating EBIT excludes other income',1082)]:p.kpi(m,l,n,x,accent=BLUE if x<732 else TEAL)
p.label('PDF Header',32,365,1376,36,12)
p.table('PDF calculation register  |  scroll within the table to review all parameters',[('Calculation Register','No'),('Calculation Register','Parameter'),('Calculation Register','Formula'),'Calculation Result',('Calculation Register','Evidence Status'),('Calculation Register','Interpretation')],32,414,1376,576,[40,235,295,150,150,445],{'Calculation Result':'Result','Evidence Status':'Evidence'},sort=(('Calculation Register','No'),'Ascending'))
p.text('FORMULA DISCIPLINE\nPDF “EBITA” adds both depreciation and amortization; it is labelled EBITDA. PDF operating profit equals EBIT and includes other income.\nDebt already includes unsecured borrowings; the literal adjusted-ratio caveat is disclosed. DSCR requires annual principal repayments, not later-period bank EMI totals.',32,1010,1376,112,11,INK)
p.text('Missing inputs stay “Not available”. Reserves / equity is a disclosed proxy for retained earnings. No bureau score, drawing power or promoter personal net worth is inferred.',32,1130,1376,26,10,AMBER,BG)

for p in P:p.write()
save(R/'definition'/'pages'/'pages.json',{'$schema':S+'pagesMetadata/1.0.0/schema.json','pageOrder':[p.name for p in P],'activePageName':P[0].name})
for name in ['report.json','version.json']:shutil.copy2(OLD/'SarangiCreditReview.Report'/'definition'/name,R/'definition'/name)
shutil.copytree(OLD/'SarangiCreditReview.Report'/'StaticResources',R/'StaticResources',dirs_exist_ok=True)
for folder in [R,MODEL]:folder.mkdir(parents=True,exist_ok=True)
shutil.copy2(OLD/'SarangiCreditReview.Report'/'.platform',R/'.platform')
shutil.copy2(OLD/'SarangiCreditReview.SemanticModel'/'.platform',MODEL/'.platform')
save(R/'definition.pbir',{'version':'4.0','datasetReference':{'byPath':{'path':'../SarangiCreditReview.SemanticModel'}}})
save(MODEL/'definition.pbism',{'version':'4.2','settings':{}})
save(ROOT/'SarangiCreditReview.pbip',{'version':'1.0','artifacts':[{'report':{'path':'SarangiCreditReview.Report'}}],'settings':{'enableAutoRecovery':True}})
shutil.copytree(OLD/'CreditReviewData',ROOT/'CreditReviewData',dirs_exist_ok=True)
save(ROOT/'BuildManifest.json',{'revision':'Four-tab credit review','pages':[p.title for p in P],'pageCount':4,'visuals':sum(len(p.v) for p in P),'PDFParameters':25,'snapshot':True})
save(D/'page-map.json',[{'title':p.title,'name':p.name,'visuals':len(p.v)} for p in P])
print(json.dumps({'pages':[p.title for p in P],'visuals':sum(len(p.v) for p in P)},indent=2))
