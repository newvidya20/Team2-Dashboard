"""Build a bounded, paginated PDF and matching native Power BI print pages.

Transaction-derived lists are explicit 15-row previews. Other review records
are complete. The original interactive report and embedded model are retained.
"""
import sys, json, pathlib, uuid, shutil, math, re, collections, zipfile
B = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(B.parent.parent / '.powerbi-tools'))
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4, landscape
from pypdf import PdfReader
from jsonschema import Draft7Validator, RefResolver

ORIGINAL = B / 'SudarshanPharmaCreditReview'
OUT = B / 'SudarshanPharmaPrintReady'
OUT.mkdir(exist_ok=True)
T = json.loads((B / 'tables.json').read_text(encoding='utf-8'))
W, H = landscape(A4)
FONT, SIZE, LEAD = 'Arial', 9, 12.7
pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', r'C:\Windows\Fonts\arialbd.ttf'))
NAVY, TEAL, INK, MUTED, BG = '#132B40', '#128478', '#243B50', '#6D8091', '#F3F6FA'
PAGES, RECORDS = [], []

def save(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')

def value(v):
    if v is None: return '[unavailable]'
    if v == '': return '[blank in source]'
    if isinstance(v, bool): return str(v)
    if isinstance(v, float): return f'{v:,.6f}'.rstrip('0').rstrip('.')
    return str(v)

def wrap(text, width=W-88, size=SIZE):
    result = []
    for paragraph in str(text).splitlines() or ['']:
        line = ''
        for word in paragraph.split():
            if pdfmetrics.stringWidth((line+' '+word).strip(), FONT, size) <= width:
                line = (line+' '+word).strip()
                continue
            if line: result.append(line); line = ''
            while pdfmetrics.stringWidth(word, FONT, size) > width:
                n = 1
                while n < len(word) and pdfmetrics.stringWidth(word[:n+1], FONT, size) <= width: n += 1
                result.append(word[:n]); word = word[n:]
            line = word
        result.append(line)
    return result

def page(section):
    p = {'section': section, 'items': [], 'y': 89.0}
    PAGES.append(p)
    return p

def block(section, text, record=None):
    lines = wrap(text)
    # Extremely long evidence is continued explicitly, never clipped.
    while lines:
        p = PAGES[-1] if PAGES and PAGES[-1]['section'] == section else page(section)
        available = int((H-43-p['y']-12)//LEAD)
        if available < min(len(lines), 3): p = page(section); available = int((H-43-p['y']-12)//LEAD)
        take = min(len(lines), available)
        part, lines = lines[:take], lines[take:]
        height = take*LEAD+12
        p['items'].append({'kind':'text', 'text':'\n'.join(part), 'x':32, 'y':p['y'], 'w':W-64, 'h':height, 'size':SIZE, 'record':record})
        p['y'] += height+5
        if lines: page(section)

def records(section, table, rows=None, prefix=None):
    data = T[table]
    rows = data['rows'] if rows is None else rows
    cols = [c[0] for c in data['columns']]
    prefix = prefix or re.sub('[^A-Z]', '', table.upper())[:5]
    for n, row in enumerate(rows, 1):
        rid = f'{prefix}-{n:04d}'
        text = rid+' | '+' | '.join(c+': '+value(v) for c,v in zip(cols,row))
        RECORDS.append({'id':rid, 'table':table, 'row':row, 'columns':cols})
        block(section, text, rid)

def dictrows(table):
    return [dict(zip([c[0] for c in T[table]['columns']], r)) for r in T[table]['rows']]

def summary(section, lines):
    page(section)
    for title, text in lines: block(section, title.upper()+'\n'+text)

gst, banks, fin = dictrows('GST Monthly'), dictrows('Bank Transactions'), dictrows('Financials')
cr = lambda v: f'INR {v/10000000:,.2f} crore'
summary('01 / Review dashboard', [
    ('Sudarshan Pharma Industries Limited', 'Complete review analysis with transaction previews. All three audited financial years are printed separately. Amounts in detail records are INR unless a field explicitly states a ratio or other unit.'),
    ('GST review', f"74 supplied GSTR-3B returns across five registrations. Declared outward supplies: {cr(sum(r['Total Outward Supplies'] for r in gst))}. Zero-rated supplies: {cr(sum(r['Zero Rated Sales'] for r in gst))}. Period: April 2025-July 2026; registration coverage varies."),
    ('Banking review', f"25,180 transactions across seven accounts. Gross credits: {cr(sum(r['Credit'] for r in banks))}. Gross debits: {cr(sum(r['Debit'] for r in banks))}. Adjusted BTO candidate: {cr(sum(r['BTO Eligible'] for r in banks))}. Candidate classifications are not verified sales. April 2025-August 2026; August partial."),
    ('Triangular reconciliation', 'All 16 shared months are printed with coverage counts. Aggregate bank receipts and GST declarations differ in scope, tax and timing; their gap is not a debtor balance.'),
    ('Finance and credit analysis', 'FY2023-24 previous GAAP, FY2024-25 restated Ind AS, FY2025-26 Ind AS. All 75 financial parameters, all 32 loan facilities, the CC snapshot and review coverage are included.'),
    ('Transaction previews', 'Bank transaction evidence, party receipt/payment lists and return/charge evidence show the initial 15 rows. The original interactive Power BI report retains every transaction and its scrollable lists. This PDF identifies each preview explicitly.')])

section='02 / Three-year financial dashboard'
page(section)
for f in fin:
    block(section, f"FY{f['Financial Year']} | {f['Statement Status']}\nRevenue: {cr(f['Sales'])} | PAT: {cr(f['PAT'])} | EBITDA: {cr(f['EBITDA'])} | Debt: {cr(f['Total Debt'])} | Operating cash flow: {cr(f['Operating Cash Flow'])}\nBasis: {f['Basis']} | Source: {f['Source']}")
block(section, 'EVIDENCE-BASED SWOT\nStrength: revenue and PAT growth. Weakness: rising debt, receivables and inventory; negative FY2025/26 operating cash flow. Opportunity: validate collections and working capital. Threat: financing dependence and differences in source account coverage. No bureau report was supplied; no credit score or sanction recommendation is inferred.')
block(section, 'COMPARABILITY NOTE\nFY2024 operating cash flow includes short-term borrowing movements. FY2025 is restated Ind AS. The older net-worth certificate uses a different basis. Projected CMA is excluded from audited actuals.')

section='02 / Three-year financial trends'
p=page(section)
for field,label in [('Sales','Operating revenue'),('PAT','Profit after tax'),('Total Debt','Total financial debt')]:
    block(section,label.upper()+' | INR crore | All three years shown together')
    p=PAGES[-1]
    maximum=max(f[field] for f in fin)
    for f in fin:
        y=p['y']
        p['items'].append({'kind':'text','text':'FY'+f['Financial Year'],'x':32,'y':y,'w':128,'h':22,'size':SIZE,'bg':BG})
        p['items'].append({'kind':'text','text':'','x':170,'y':y+4,'w':430*f[field]/maximum,'h':12,'size':SIZE,'bg':TEAL})
        p['items'].append({'kind':'text','text':f"{f[field]/10000000:,.2f}",'x':620,'y':y,'w':W-652,'h':22,'size':SIZE,'bg':BG})
        p['y']+=25
block(section,'Revenue and PAT increased across the supplied standalone years. Debt also rose. Read these trends with the complete annual statements, all 25 parameters per year and basis qualifications below.')

records('03 / GST return details - complete', 'GST Monthly', prefix='GST')
records('04 / Banking and GST monthly bridge - complete', 'Reconciliation', prefix='REC')

# All banking summary groups are printed, rather than relying on a visual viewport.
section='05 / Banking account and monthly flows'
groups=collections.defaultdict(lambda: [0.,0.,0.,0,0.])
for r in banks:
    for k in [('Account',r['Bank']),('Month',r['Month'])]:
        a=groups[k]; a[0]+=r['Credit'];a[1]+=r['Debit'];a[2]+=r['BTO Eligible'];a[3]+=1
        if r['Internal Match'] != 'No own-account marker': a[4]+=r['Credit']
for (kind,key),a in sorted(groups.items()):
    block(section, f'{kind}: {key} | Gross credits: {cr(a[0])} | Gross debits: {cr(a[1])} | Adjusted BTO candidate: {cr(a[2])} | Entries: {a[3]:,} | Own-account credit markers: {cr(a[4])}')

section='06 / Banking classification summaries'
returns=collections.defaultdict(lambda:[0,0.,0.])
for r in banks:
    a=returns[r['Return Type']];a[0]+=1;a[1]+=r['Penal Charges'];a[2]+=r['Loan Credit Candidate']
for k,a in sorted(returns.items()): block(section, f'Return type: {k} | Narration entries: {a[0]:,} | Penal-charge candidates: INR {a[1]:,.2f} | Loan-credit candidates: {cr(a[2])}')
block(section, f"Cash deposit candidates: {cr(sum(r['Cash Deposit'] for r in banks))}. Return markers count entries, not distinct failed-payment events. See complete classification caveats later in this report.")
records('07 / Cash credit utilisation - complete', 'CC Snapshot', prefix='CC')

section='08 / Party receipts and payments - top 15 preview'
parties=collections.defaultdict(lambda:[0.,0.,0])
for r in banks:
    a=parties[r['Party']];a[0]+=r['Credit'];a[1]+=r['Debit'];a[2]+=int(r['Credit']>0)
block(section, f'PREVIEW: 15 of {len(parties):,} statement party names, ordered by gross credits descending, then party name. No fuzzy identity merges. Full party list remains scrollable in the interactive report.')
for n,(k,a) in enumerate(sorted(parties.items(),key=lambda x:(-x[1][0],x[0]))[:15],1):
    block(section, f'{n:02d}. Party: {k} | Gross credits: {cr(a[0])} | Gross debits: {cr(a[1])} | Credit entries: {a[2]:,}')

ordered=sorted(banks,key=lambda r:(r['Date'],r['Bank'],str(r['Source ID']),r['Page']))
preview=[ [r[c[0]] for c in T['Bank Transactions']['columns']] for r in ordered[:15]]
section='09 / Bank transaction evidence - first 15 rows'
block(section,'PREVIEW: first 15 of 25,180 transactions, sorted by date, account, source and page. Every field for these 15 rows is printed. Full transactions remain available in the original interactive report and its extracted CSV.')
records(section,'Bank Transactions',preview,'TXN')
flagged=[r for r in ordered if r['Return Type']!='No return marker' or r['Penal Charges']>0]
section='10 / Return and penal evidence - first 15 rows'
block(section, f'PREVIEW: first {min(15,len(flagged))} of {len(flagged):,} return/penal candidate entries in chronological order. Full candidate entries remain in the interactive dashboard. Candidate markers require source review.')
records(section,'Bank Transactions',[[r[c[0]] for c in T['Bank Transactions']['columns']] for r in flagged[:15]],'FLAG')

for year in ['2023-24','2024-25','2025-26']:
    records(f'11 / FY{year} - complete financial statements','Financials',[r for r in T['Financials']['rows'] if r[0]==year],f'FIN{year[:4]}')
    records(f'12 / FY{year} - all 25 credit parameters','Financial Parameters',[r for r in T['Financial Parameters']['rows'] if r[0]==year],f'PAR{year[:4]}')
records('13 / Loan obligations - all 32 facilities','Loan Schedule',prefix='LOAN')
records('14 / Review parameter coverage - complete','Review Coverage',prefix='COV')

# Retain every original dashboard text note, including source exceptions and SWOT.
notes=[]
for p in sorted((ORIGINAL/'SudarshanPharmaCreditReview.Report'/'definition'/'pages').glob('*/visuals/*/visual.json')):
    v=json.loads(p.read_text(encoding='utf-8'))['visual']
    if v['visualType']!='textbox':continue
    for g in v.get('objects',{}).get('general',[]):
        text='\n'.join(''.join(r.get('value','') for r in para.get('textRuns',[])) for para in g['properties'].get('paragraphs',[]))
        # Layout labels and stale navigation instructions are replaced by print headings.
        if len(text)>110 and 'Scroll to review' not in text and text not in notes:notes.append(text)
for note in notes:block('15 / Original review notes and source exceptions',note)
readme=(ORIGINAL/'README.md').read_text(encoding='utf-8')
evidence=readme.split('## Verified source facts',1)[1].split('## Data, validation and refresh',1)[0]
for para in evidence.split('\n\n'):
    if para.strip(): block('16 / Evidence, interpretation and source mapping',para.strip().replace('## ','').replace('**','').replace('`',''))

count=len(PAGES)
pdfpath=OUT/'SudarshanPharma_Full_Review.pdf'
c=canvas.Canvas(str(pdfpath),pagesize=(W,H),pageCompression=1)
c.setTitle('Sudarshan Pharma Industries Limited - Complete Credit Review')
c.setAuthor('Credit Review')
for i,p in enumerate(PAGES,1):
    c.setFillColor(BG);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(NAVY);c.rect(0,H-69,W,69,fill=1,stroke=0)
    c.setFillColor('#8FC4CB');c.setFont('Arial',9);c.drawString(32,H-23,'SUDARSHAN PHARMA INDUSTRIES LIMITED | CREDIT REVIEW')
    c.setFillColor('#FFFFFF');c.setFont('ArialBold',17);c.drawString(32,H-49,p['section'])
    c.setFillColor(MUTED);c.setFont('Arial',8);c.drawString(32,H-80,'Complete analysis | Explicit 15-row transaction previews | Detail amounts INR unless stated')
    for item in p['items']:
        c.setFillColor(item.get('bg','#FFFFFF'));c.rect(item['x'],H-item['y']-item['h'],item['w'],item['h'],fill=1,stroke=0)
        c.setFillColor(INK);c.setFont(FONT,SIZE)
        for j,line in enumerate(item['text'].split('\n')):c.drawString(item['x']+6,H-item['y']-12-j*LEAD,line)
    c.setFillColor(MUTED);c.setFont('Arial',8)
    c.drawString(32,22,'Standalone audited actuals | Source qualifications retained | 23 October 2026')
    c.drawRightString(W-32,22,f'Page {i} of {count} | '+('Continuation' if i>1 and PAGES[i-2]['section']==p['section'] else 'Section start'))
    c.showPage()
c.save()

# Matching native PBIR fixed text pages; no table viewport can hide print content.
S='https://developer.microsoft.com/json-schemas/fabric/item/report/definition/'
def lit(v):return {'expr':{'Literal':{'Value':str(v).lower() if isinstance(v,bool) else str(v)+'D' if isinstance(v,(float,int)) else "'"+v.replace("'","''")+"'"}}}
def prop(**kw):return [{'properties':kw}]
def col(v):return {'solid':{'color':lit(v)}}
model='SudarshanPharmaCreditReview.SemanticModel'
shutil.copytree(ORIGINAL/model,OUT/model,dirs_exist_ok=True)
nativefiles=[]
for pack,start in enumerate(range(0,count,50),1):
    name=f'SudarshanPharma_Print_{pack:02d}'
    report=OUT/(name+'.Report');definition=report/'definition'
    definition.mkdir(parents=True,exist_ok=True)
    oldpages=definition/'pages'
    if oldpages.exists():
        assert oldpages.resolve().is_relative_to(OUT.resolve()) and oldpages.name=='pages'
        shutil.rmtree(oldpages)
    source=ORIGINAL/'SudarshanPharmaCreditReview.Report'
    shutil.copytree(source/'StaticResources',report/'StaticResources',dirs_exist_ok=True)
    for fn in ['report.json','version.json']:shutil.copy2(source/'definition'/fn,definition/fn)
    save(report/'.platform',{'$schema':'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json','metadata':{'type':'Report','displayName':name},'config':{'version':'2.0','logicalId':str(uuid.uuid5(uuid.NAMESPACE_URL,name))}})
    save(report/'definition.pbir',{'version':'4.0','datasetReference':{'byPath':{'path':'../'+model}}})
    save(OUT/(name+'.pbip'),{'version':'1.0','artifacts':[{'report':{'path':name+'.Report'}}],'settings':{'enableAutoRecovery':True}})
    order=[]
    for idx in range(start,min(start+50,count)):
        p=PAGES[idx];pid=uuid.uuid5(uuid.NAMESPACE_URL,'spil-print-page-'+str(idx)).hex[:20];order.append(pid)
        folder=definition/'pages'/pid
        save(folder/'page.json',{'$schema':S+'page/2.1.0/schema.json','name':pid,'displayName':f'{idx+1:02d} '+p['section'],'displayOption':'FitToPage','width':W*4/3,'height':H*4/3,'objects':{'background':prop(color=col(BG),transparency=lit(0))}})
        items=[{'text':'SUDARSHAN PHARMA INDUSTRIES LIMITED | CREDIT REVIEW','x':26,'y':4,'w':W-52,'h':26,'size':10,'bg':NAVY,'fg':'#8FC4CB'}, {'text':p['section'],'x':26,'y':27,'w':W-52,'h':38,'size':17,'bg':NAVY,'fg':'#FFFFFF'}, {'text':'Complete analysis | 15-row transaction previews | Detail amounts INR unless stated','x':26,'y':68,'w':W-52,'h':22,'size':8,'bg':BG,'fg':MUTED}]+p['items']+[{'text':f'Standalone audited actuals | Source qualifications retained                       Page {idx+1} of {count}','x':26,'y':H-33,'w':W-52,'h':25,'size':8,'bg':BG,'fg':MUTED}]
        for z,it in enumerate(items):
            vid=uuid.uuid5(uuid.NAMESPACE_URL,pid+'/text/'+str(z)).hex[:20]
            visual={'$schema':S+'visualContainer/2.4.0/schema.json','name':vid,'position':{'x':it['x']*4/3,'y':it['y']*4/3,'width':it['w']*4/3,'height':it['h']*4/3,'z':z,'tabOrder':z},'visual':{'visualType':'textbox','objects':{'general':prop(paragraphs=[{'textRuns':[{'value':line,'textStyle':{'fontFamily':'Arial','fontSize':str(it['size'])+'pt','color':it.get('fg',INK)}}]} for line in it['text'].split('\n')])},'visualContainerObjects':{'background':prop(show=lit(True),color=col(it.get('bg','#FFFFFF')),transparency=lit(0)),'border':prop(show=lit(False)),'visualHeader':prop(show=lit(False))}}}
            save(folder/'visuals'/vid/'visual.json',visual)
    save(definition/'pages'/'pages.json',{'$schema':S+'pagesMetadata/1.0.0/schema.json','pageOrder':order,'activePageName':order[0]})
    nativefiles.append({'project':name+'.pbip','firstPage':start+1,'lastPage':min(start+50,count)})

shutil.copytree(ORIGINAL/'ExtractedData',OUT/'ExtractedData',dirs_exist_ok=True)
for fn in ['SourceInventory.json','BankBalanceChecks.json','LiveModelChecks.json']:
    if (ORIGINAL/fn).exists():shutil.copy2(ORIGINAL/fn,OUT/fn)
save(OUT/'PrintManifest.json',{'pages':count,'paper':'A4 landscape','fontSizePt':SIZE,'transactionPreviewRows':15,'sections':[{'section':p['section'],'page':i+1} for i,p in enumerate(PAGES)],'powerBiPacks':nativefiles,'completeTables':{k:len(T[k]['rows']) for k in ['GST Monthly','Reconciliation','Financials','Financial Parameters','Loan Schedule','CC Snapshot','Review Coverage']},'interactiveOriginal':'../SudarshanPharmaCreditReview/SudarshanPharmaCreditReview.pbip','snapshot':True})

# Validate PDF record coverage, page bounds, exact bank preview count and native schemas.
reader=PdfReader(str(pdfpath));assert len(reader.pages)==count
pdftext='\n'.join(p.extract_text() for p in reader.pages)
compact=re.sub(r'\s+','',pdftext)
for r in RECORDS:
    assert r['id'] in pdftext,r['id']
    for v in r['row']:assert re.sub(r'\s+','',value(v)) in compact,(r['id'],value(v))
assert len([r for r in RECORDS if r['table']=='Financial Parameters'])==75
assert len([r for r in RECORDS if r['id'].startswith('TXN-')])==15
for p in PAGES:
    for it in p['items']:
        assert it['y']+it['h']<=H-43
        for line in it['text'].split('\n'):assert pdfmetrics.stringWidth(line,FONT,SIZE)<=W-88+.01
store=json.loads((B.parent/'schemas'/'schema-store.json').read_text())
for u,s in list(store.items()):
    if '$id' in s:store[s['$id']]=s
validated=0
for f in OUT.glob('*.Report/definition/**/*.json'):
    obj=json.loads(f.read_text(encoding='utf-8'));u=obj.get('$schema')
    if u:
        errors=list(Draft7Validator(store[u],resolver=RefResolver(u,store[u],store=store)).iter_errors(obj))
        assert not errors, str(f)+': '+str(errors[0] if errors else '')
        validated+=1
save(OUT/'PrintValidation.json',{'pdfPages':count,'recordCoverage':'passed','recordsPrinted':len(RECORDS),'lineWidths':'passed','pageBounds':'passed','nativeSchemaFiles':validated,'bankPreviewRows':15,'allFinancialParameters':75,'sourceDatasetModified':False,'nativeDesktopRendering':'Not separately visually verified; original interactive project retained.'})
readme='''# Sudarshan Pharma - PDF-ready credit review

Share **SudarshanPharma_Full_Review.pdf**. It contains complete analysis and explicitly labelled transaction previews. No scrolling is required to read the PDF. Continuation pages preserve all non-transaction review records and all three audited financial years.

Bank transactions, party receipt/payment detail and return/penal evidence are limited to 15 preview rows each in this PDF. All 25,180 bank transactions remain in ExtractedData and the original interactive Power BI report. The original dashboard and its year filters are unchanged.

The native Power BI Print projects reproduce the printable snapshot using fixed text pages. Open the numbered .pbip files with their adjacent folders intact. Each pack has no more than 50 pages, the standard Power BI PDF export limit. Export every page in each pack in filename order if recreating the complete PDF. Printed pages carry continuous global page numbers. These are fixed source snapshots; refreshing does not re-extract changed source PDFs or recalculate printed text. Re-run build_print_report.py after rebuilding source data to update the printable report. The interactive dashboard remains the report for filtering and scrolling.

All GST records, all 16 reconciliation months, all 75 annual financial parameters, complete annual financial records, all 32 loan facilities, all five CC snapshots, account/month summaries, coverage checks, original explanatory notes and source qualifications are printed. SourceInventory.json and the original extraction artifacts retain provenance. Missing values are labelled unavailable; blank source fields are labelled explicitly. Financial details use INR; summary amounts explicitly labelled crore are converted to crore. FY2024 previous GAAP and FY2025 restated Ind AS are retained with the comparability notes.

PrintManifest.json lists pages and pack boundaries. PrintValidation.json records automatic PDF coverage, layout and native schema checks. The original interactive deliverable is ../SudarshanPharmaCreditReview/SudarshanPharmaCreditReview.pbip.
'''
(OUT/'README.md').write_text(readme,encoding='utf-8')
with zipfile.ZipFile(B/'SudarshanPharmaPrintReady.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in OUT.rglob('*'):
        if f.is_file() and '.pbi' not in f.parts:z.write(f,f.relative_to(OUT.parent))
print(json.dumps({'pdf':str(pdfpath),'pages':count,'packs':nativefiles,'recordsPrinted':len(RECORDS),'nativeSchemaFiles':validated},indent=2))
