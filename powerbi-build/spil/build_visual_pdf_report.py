"""Keep the approved native dashboard visuals and paginate table overflow."""
import pathlib, json, sys, copy, re, uuid, shutil, collections, math, zipfile
B=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(B.parent.parent/'.powerbi-tools'))
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from pypdf import PdfReader
from jsonschema import Draft7Validator,RefResolver
env={'__file__':str(B/'build_report.py')}
exec((B/'build_report.py').read_text(encoding='utf-8').split('for p in P:p.write()')[0],env)
P=env['P'];Page=env['Page'];lit=env['lit'];props=env['props'];categorical=env['categorical'];save=env['save']
OUT=B/'SudarshanPharmaDashboardFinal';OUT.mkdir(exist_ok=True)
R=OUT/'SudarshanPharmaVisualReview.Report';MODEL=OUT/'SudarshanPharmaCreditReview.SemanticModel'
env['R']=R
T=json.loads((B/'tables.json').read_text(encoding='utf-8'))
DATA={t:[dict(zip([c[0] for c in d['columns']],row)) for row in d['rows']] for t,d in T.items()}
MEAS={m['name']:m for m in json.loads((B/'measures.json').read_text())}
pdfmetrics.registerFont(TTFont('Arial',r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold',r'C:\Windows\Fonts\arialbd.ttf'))
INK=env['INK'];BLUE=env['BLUE'];TEAL=env['TEAL'];BG=env['BG'];MUTED=env['MUTED'];NAVY=env['NAVY']
TABLES={};CHARTS={};CARDS={};CONTROLS={};COVERAGE=[]

def val(v):
    if v is None:return 'Unavailable'
    if isinstance(v,float):return f'{v:,.4f}'.rstrip('0').rstrip('.')
    if isinstance(v,int):return f'{v:,}'
    return str(v)

def decode(v):
    v=v['expr']['Literal']['Value']
    if v.startswith("'"):return v[1:-1].replace("''", "'")
    return float(v.rstrip('D')) if v not in ['true','false'] else v=='true'

def wrap(text,width,size=11):
    lines=[]
    for para in str(text).split('\n'):
        line=''
        for word in para.split():
            if pdfmetrics.stringWidth((line+' '+word).strip(),'Arial',size)*4/3<=width:
                line=(line+' '+word).strip();continue
            if line:lines.append(line);line=''
            while pdfmetrics.stringWidth(word,'Arial',size)*4/3>width:
                n=1
                while n<len(word) and pdfmetrics.stringWidth(word[:n+1],'Arial',size)*4/3<=width:n+=1
                lines.append(word[:n]);word=word[n:]
            line=word
        lines.append(line)
    return lines

def projected(pr):
    field=pr['field'];kind=next(iter(field));o=field[kind]
    return kind,o['Expression']['SourceRef']['Entity'],o['Property']

def apply_filters(rows, filters):
    for f in filters:
        for condition in f.get('filter',{}).get('Where',[]):
            inn=condition['Condition'].get('In')
            if not inn:continue
            keys=[e['Column']['Property'] for e in inn['Expressions']]
            def parse(v):
                raw=v['Literal']['Value']
                if raw.startswith("'"):return raw[1:-1].replace("''", "'")
                if raw=='null':return None
                return float(raw.rstrip('DL'))
            allowed={tuple(parse(v) for v in vs) for vs in inn['Values']}
            rows=[r for r in rows if tuple(r.get(k) for k in keys) in allowed]
    return rows

def measure(name,table,rows,year=None):
    m=MEAS[name];raw=rows if table==m['tableName'] else DATA[m['tableName']]
    if m['tableName']=='Financials' and year:raw=[r for r in raw if r['Financial Year']==year]
    expression=m['expression']
    if name=='Common Gap Cr':return measure('Common Adjusted Cr',table,rows)-measure('Common GST Cr',table,rows)
    if name=='Zero Rated Share':return measure('Zero Rated Cr',table,rows)/measure('GST Sales Cr',table,rows)
    if name=='Credit Entries':return sum(r['Credit']>0 for r in raw)
    if name=='Return Candidates':return sum(r['Return Type']!='No return marker' for r in raw)
    if name=='Internal Credits Cr':return sum(r['Credit'] for r in raw if r['Internal Match']!='No own-account marker')/10000000
    if expression.startswith('COUNTROWS'):return len(raw)
    fields=re.findall(r"SUM\('[^']+'\[([^]]+)\]\)",expression)
    numbers=[sum(r.get(k) or 0 for r in raw) for k in fields]
    if expression.startswith('DIVIDE'):
        divisor=numbers[1] if len(numbers)>1 else float(expression.rsplit(',',1)[1].rstrip(')'))
        return numbers[0]/divisor if divisor else None
    return numbers[0]

def tabledata(v,year=None):
    projections=v['visual']['query']['queryState']['Values']['projections']
    fs=[projected(p) for p in projections];columns=[f for f in fs if f[0]=='Column']
    table=columns[0][1] if columns else fs[0][1]
    raw=apply_filters(DATA[table],v.get('filterConfig',{}).get('filters',[]))
    if year and table in ['Financials','Financial Parameters']:raw=[r for r in raw if r['Financial Year']==year]
    groups=collections.OrderedDict()
    for r in raw:
        key=tuple(r[f[2]] for f in columns);groups.setdefault(key,[]).append(r)
    result=[]
    for key,rs in groups.items():
        row=[]
        for kind,t,n in fs:
            row.append(rs[0][n] if kind=='Column' else measure(n,table,rs,year))
        result.append((row,rs))
    sorts=v['visual']['query'].get('sortDefinition',{}).get('sort',[])
    if sorts:
        sort=projected({'field':sorts[0]['field']});idx=fs.index(sort)
        result.sort(key=lambda a:(a[0][idx] is None,a[0][idx]),reverse=sorts[0]['direction']=='Descending')
    headers=[p.get('displayName',p.get('nativeQueryRef',f[2])) for p,f in zip(projections,fs)]
    widths=[decode(p['properties']['value']) for p in v['visual']['objects'].get('columnWidth',[])]
    w=v['position']['width']-20
    widths=[x*w/sum(widths) for x in widths] if widths else [w/len(fs)]*len(fs)
    return {'headers':headers,'widths':widths,'rows':[r[0] for r in result],'raw':[r[1] for r in result],'fields':fs,'table':table,'original':copy.deepcopy(v)}

def rowheight(row,widths):return max(len(wrap(val(v),w-16)) for v,w in zip(row,widths))*19+18
def headheight(d):return max(len(wrap(h,w-16,10)) for h,w in zip(d['headers'],d['widths']))*18+20
def chunk(d,height):
    groups=[];current=[];used=headheight(d)+48
    for idx,row in enumerate(d['rows']):
        h=rowheight(row,d['widths'])
        assert h+headheight(d)+48<height,('oversized table row',d['table'],idx,h)
        if current and used+h>height:groups.append(current);current=[];used=headheight(d)+48
        current.append(idx);used+=h
    if current:groups.append(current)
    return groups

def filter_chunk(v,d,indices,year=None,dynamic=False):
    # Filter using all projected categorical columns. No row is discarded to fit.
    fields=[f for f in d['fields'] if f[0]=='Column']
    keyfields={'GST Monthly':['Month','GSTIN'],'Financial Parameters':['Financial Year','No'],'Loan Schedule':['No'],'Review Coverage':['Page','Order'],'CC Snapshot':['Account'],'Reconciliation':['Month'],'Financials':['Financial Year']}
    if d['table'] in keyfields:fields=[('Column',d['table'],k) for k in keyfields[d['table']]]
    if dynamic and d['table']=='Financial Parameters':fields=[('Column','Financial Parameters','No')]
    if not fields:return
    vals=[]
    for idx in indices:
        row=d['raw'][idx][0]
        def literal(v):
            if v is None:return 'null'
            if isinstance(v,(int,float)):return str(v)+'D'
            return "'"+str(v).replace("'","''")+"'"
        vals.append([{'Literal':{'Value':literal(row[f[2]])}} for f in fields])
    first=fields[0]
    filt={'name':env['uid'](),'field':env['field']((first[1],first[2])),'type':'Categorical','filter':{'Version':2,'From':[{'Name':'s','Entity':d['table'],'Type':0}],'Where':[{'Condition':{'In':{'Expressions':[{'Column':{'Expression':{'SourceRef':{'Source':'s'}},'Property':f[2]}} for f in fields],'Values':vals}}}]}}
    v.setdefault('filterConfig',{}).setdefault('filters',[]).append(filt)
    if year:v['filterConfig']['filters'].append(categorical('Financial Parameters','Financial Year',[year]))

def remember(v,d,indices,title=None):
    td=copy.copy(d);td['rows']=[d['rows'][i] for i in indices]
    td['title']=title or decode(v['visual']['visualContainerObjects']['title'][0]['properties']['text'])
    TABLES[v['name']]=td

def continuation(source,d,indices,title,index,total,year=None):
    p=Page(title,f'Sudarshan Pharma / {source.title}',f'Continuation {index}/{total} | Complete review rows | INR unless stated | '+(f'FY{year}' if year else 'Original source scope'),len(P)+1)
    # Familiar dashboard card accents and header, with a full-width native table.
    p.text(f'{len(indices)} rows on this page',32,156,326,54,14,TEAL,'#FFFFFF',True)
    p.text('Complete row text and repeated column headers',382,156,676,54,12,INK,'#FFFFFF',True)
    p.text('PDF continuation',1082,156,326,54,12,TEAL,'#FFFFFF',True)
    v=copy.deepcopy(d['original']);v['name']=env['uid']();v['position'].update(x=32,y=238,width=1376,height=880,z=len(p.v),tabOrder=len(p.v))
    # Wider appendix columns reduce wrapping without reducing the font size.
    old=sum(d['widths']);dd=copy.copy(d);dd['widths']=[w*1356/old for w in d['widths']]
    v['visual']['objects']['columnWidth']=[{'selector':{'metadata':pr['queryRef']},'properties':{'value':lit(w)}} for pr,w in zip(v['visual']['query']['queryState']['Values']['projections'],dd['widths'])]
    filter_chunk(v,dd,indices,year);p.v.append(v);remember(v,dd,indices,title)
    return p

# Capture native chart data before modifying report tables.
for p in list(P):
    year='2025-26' if p.title.startswith('4.') else None
    for v in p.v:
        typ=v['visual']['visualType']
        if typ=='card':
            name=projected(v['visual']['query']['queryState']['Values']['projections'][0])[2]
            CARDS[v['name']]=(name,measure(name,MEAS[name]['tableName'],DATA[MEAS[name]['tableName']],year))
        elif typ=='slicer':CONTROLS[v['name']]=year
        elif typ in ['lineChart','clusteredBarChart','clusteredColumnChart']:
            q=v['visual']['query']['queryState'];axis=projected(q['Category']['projections'][0]);names=[projected(x)[2] for x in q['Y']['projections']]
            axisvalues=sorted(set(r[axis[2]] for r in DATA[axis[1]]))
            series=[]
            for key in axisvalues:
                vals=[]
                for name in names:
                    t=MEAS[name]['tableName'];rows=[r for r in DATA[t] if r.get(axis[2])==key]
                    vals.append(measure(name,t,rows))
                series.append((key,vals))
            series=[(key,vals) for key,vals in series if any(any(r.get(axis[2])==key for r in DATA[MEAS[name]['tableName']]) for name in names)]
            CHARTS[v['name']]={'names':names,'series':series,'type':typ}

originals=list(P)
appendices=[]
for p in originals:
    year='2025-26' if p.title.startswith('4.') else None
    for v in list(p.v):
        if v['visual']['visualType']!='tableEx':continue
        d=tabledata(v,year)
        title=decode(v['visual']['visualContainerObjects']['title'][0]['properties']['text'])
        transaction=d['table']=='Bank Transactions' and any(f[2] in ['Party','Date'] for f in d['fields'])
        if transaction:
            # Keep the full interactive scrolling lists on the original summary tabs.
            # The export snapshot shows complete initial rows; appendix holds 15 rows.
            d['rows']=d['rows'][:15];d['raw']=d['raw'][:15]
        groups=chunk(d,v['position']['height'])
        if not groups:continue
        first=groups[0]
        remember(v,d,first,title+(' | Initial rows; 15-row preview follows' if transaction else ' | Continued below'))
        if not transaction:filter_chunk(v,d,first,dynamic=True)
        # Complete tables are repeated in appendices; summaries retain their layout.
        if len(groups)>1 or transaction or d['table']=='Financial Parameters':
            years=['2023-24','2024-25','2025-26'] if d['table']=='Financial Parameters' else [None]
            for yr in years:
                dd=tabledata(d['original'],yr) if yr else copy.copy(d)
                if d['table']=='Loan Schedule':
                    ov=copy.deepcopy(d['original'])
                    ov['visual']['query']['queryState']['Values']['projections']=[env['project'](('Loan Schedule',col[0])) for col in T['Loan Schedule']['columns']]
                    ov['visual']['objects']['columnWidth']=[{'properties':{'value':lit(w)}} for w in [50,240,200,150,180,160,180,196]]
                    dd=tabledata(ov)
                if d['table']=='Financial Parameters':
                    # tabledata must start from the unfiltered original descriptor.
                    ov=copy.deepcopy(d['original']);ov['filterConfig']={'filters':[]};dd=tabledata(ov,yr)
                if transaction:dd['rows']=dd['rows'][:15];dd['raw']=dd['raw'][:15]
                old=sum(dd['widths']);dd['widths']=[w*1356/old for w in dd['widths']]
                pieces=chunk(dd,880)
                for num,ids in enumerate(pieces,1):
                    name=('FY'+yr+' / ' if yr else '')+title.split('|')[0].strip()
                    name=name.replace(' | Scroll to review all 25 parameters','').replace('Scroll to review all 25 parameters','All 25 parameters')
                    name=name[:85]+f' ({num}/{len(pieces)})'
                    continuation(p,dd,ids,name,num,len(pieces),yr)
                COVERAGE.append({'section':title,'year':yr,'rows':len(dd['rows']),'pages':len(pieces),'transactionPreview':transaction})

# Add the full standalone financial statement fields for every year in a compact table.
p=originals[3]
for year in ['2023-24','2024-25','2025-26']:
    row=next(r for r in DATA['Financials'] if r['Financial Year']==year)
    pp=Page(f'FY{year} / Financial statement detail','Sudarshan Pharma / standalone financial statements','All extracted annual statement fields | INR unless stated | '+row['Basis'],len(P)+1)
    pp.text('All annual statement fields retained',32,155,1376,44,15,TEAL,'#FFFFFF',True)
    # Fixed two-column table with native text cells, split into two side-by-side panels.
    entries=list(row.items());half=math.ceil(len(entries)/2)
    for side,subset in enumerate([entries[:half],entries[half:]]):
        y=220
        for j,(key,value) in enumerate(subset):
            x=32+side*700
            text=key+'\n'+val(value)
            h=max(46,len(wrap(text,654,10))*17+10)
            pp.text(text,x,y,676,h,10,INK,'#FFFFFF');y+=h+3
        assert y<1140,('Financial statement panel overflow',year,y)

count=len(P)
oldpages=R/'definition'/'pages'
if oldpages.exists():
    assert oldpages.resolve().is_relative_to(OUT.resolve()) and oldpages.name=='pages'
    shutil.rmtree(oldpages)
for i,p in enumerate(P,1):
    # Replace the obsolete four-page footer and mark table continuation destinations.
    for v in p.v:
        titleprops=v['visual'].get('visualContainerObjects',{}).get('title',[{}])[0].get('properties',{})
        if 'text' in titleprops:
            titleprops['text']=lit(decode(titleprops['text']).replace('Scroll to review all 25 parameters','All parameters on continuation pages'))
        if v['visual']['visualType']!='textbox':continue
        for g in v['visual'].get('objects',{}).get('general',[]):
            for para in g['properties'].get('paragraphs',[]):
                for run in para.get('textRuns',[]):
                    if ' / 04' in run.get('value',''):run['value']=f'{i:02d} / {count:02d} | Credit review'
                    run['value']=run.get('value','').replace('Scroll to review all 25 parameters','Complete parameters on continuation pages')
                    if run.get('value')==p.title:
                        size=min(28,28*1370/max(1370,pdfmetrics.stringWidth(p.title,'ArialBold',28)*4/3))
                        run['textStyle']['fontSize']=str(round(size,1))+'pt'
    p.write()
save(R/'definition'/'pages'/'pages.json',{'$schema':env['S']+'pagesMetadata/1.0.0/schema.json','pageOrder':[p.name for p in P],'activePageName':P[0].name})
src=B/'SudarshanPharmaCreditReview'
for fn in ['report.json','version.json']:shutil.copy2(src/'SudarshanPharmaCreditReview.Report'/'definition'/fn,R/'definition'/fn)
shutil.copytree(src/'SudarshanPharmaCreditReview.Report'/'StaticResources',R/'StaticResources',dirs_exist_ok=True)
shutil.copytree(src/'SudarshanPharmaCreditReview.SemanticModel',MODEL,dirs_exist_ok=True)
shutil.copytree(src/'ExtractedData',OUT/'ExtractedData',dirs_exist_ok=True)
save(R/'.platform',{'$schema':'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json','metadata':{'type':'Report','displayName':'Sudarshan Pharma Visual Review'},'config':{'version':'2.0','logicalId':str(uuid.uuid5(uuid.NAMESPACE_URL,'spil-visual-review'))}})
save(R/'definition.pbir',{'version':'4.0','datasetReference':{'byPath':{'path':'../SudarshanPharmaCreditReview.SemanticModel'}}})
save(OUT/'SudarshanPharmaVisualReview.pbip',{'version':'1.0','artifacts':[{'report':{'path':R.name}}],'settings':{'enableAutoRecovery':True}})
save(OUT/'SudarshanPharmaDashboardFinal.pbip',{'version':'1.0','artifacts':[{'report':{'path':R.name}}],'settings':{'enableAutoRecovery':True}})
save(OUT/'Pagination.json',{'pages':count,'originalDashboardTabs':4,'tableSections':COVERAGE,'transactionRowsRetained':len(DATA['Bank Transactions']),'summaryYear':'2025-26','allYearsPrinted':['2023-24','2024-25','2025-26']})

# Render a shareable vector PDF using the same native layout and source snapshots.
pdf=OUT/'SudarshanPharma_Visual_Review.pdf'
c=canvas.Canvas(str(pdf),pageCompression=1);c.setTitle('Sudarshan Pharma - Visual Credit Review')
def rect(x,y,w,h,color):c.setFillColor(color);c.rect(x,-y-h,w,h,stroke=0,fill=1)
def text(s,x,y,size=11,color=INK,bold=False):
    c.setFillColor(color);c.setFont('ArialBold' if bold else 'Arial',size*4/3);c.drawString(x,-y-size*4/3,str(s))
for p in P:
    height=getattr(p,'height',1200);c.setPageSize((1080,height*.75));c.saveState();c.scale(.75,.75);c.translate(0,height)
    rect(0,0,1440,height,BG)
    for v in p.v:
        pos=v['position'];x,y,w,h=[pos[k] for k in ['x','y','width','height']];vv=v['visual'];typ=vv['visualType']
        containers=vv.get('visualContainerObjects',{})
        background=containers.get('background',[{}])[0].get('properties',{})
        if 'color' in background:rect(x,y,w,h,decode(background['color']['solid']['color']))
        tp=containers.get('title',[{}])[0].get('properties',{})
        title=decode(tp['text']) if 'text' in tp else ''
        if title and typ!='textbox':text(title,x+12,y+8,11,INK,True)
        if typ=='textbox':
            yy=y+5
            for general in vv.get('objects',{}).get('general',[]):
                for para in general['properties'].get('paragraphs',[]):
                    for run in para.get('textRuns',[]):
                        st=run.get('textStyle',{});size=float(st.get('fontSize','11pt').replace('pt',''));lines=wrap(run['value'],w-12,size)
                        for line in lines:text(line,x+6,yy,size,st.get('color',INK),st.get('fontWeight')=='bold');yy+=size*4/3*1.15
        elif typ=='card':
            name,value=CARDS[v['name']];style=MEAS[name]['formatString']
            shown='Unavailable' if value is None else f'{value:,.2f}' if '.00' in style else f'{value:,.0f}'
            text(shown,x+10,y+8,30,TEAL)
        elif typ=='slicer':
            text('FY2025-26' if CONTROLS.get(v['name']) else 'All supplied records',x+12,y+34,11,MUTED)
        elif typ=='tableEx':
            d=TABLES[v['name']];widths=d['widths'];yy=y+40;hh=headheight(d);xx=x+10
            rect(xx,yy,sum(widths),hh,'#EDF2F7')
            for header,width in zip(d['headers'],widths):
                for j,line in enumerate(wrap(header,width-16,10)):text(line,xx+8,yy+8+j*18,10,INK,True)
                xx+=width
            yy+=hh
            for n,row in enumerate(d['rows']):
                rh=rowheight(row,widths);assert yy+rh<=y+h+1,(p.title,d['title'],yy+rh,y+h)
                rect(x+10,yy,sum(widths),rh,'#FFFFFF' if n%2==0 else '#F8FAFC');xx=x+10
                for entry,width in zip(row,widths):
                    for j,line in enumerate(wrap(val(entry),width-16)):text(line,xx+8,yy+8+j*19,11)
                    xx+=width
                yy+=rh
        elif typ in ['lineChart','clusteredBarChart','clusteredColumnChart']:
            chart=CHARTS[v['name']];series=chart['series'];names=chart['names'];colors=[BLUE,TEAL,'#A86616'];gx=x+65;gy=y+55;gw=w-90;gh=h-105
            maxval=max((max(vs) for _,vs in series),default=1) or 1;minval=min(0,min((min(vs) for _,vs in series),default=0));span=maxval-minval
            if typ!='clusteredBarChart':
                for k in range(4):
                    yy=gy+gh*(1-k/3);rect(gx,yy,gw,1,'#E0E7EF');text(f'{minval+span*k/3:,.0f}',x+3,yy-8,8,MUTED)
            if typ=='clusteredBarChart':
                ordered=sorted(series,key=lambda q:-q[1][0]);rh=gh/max(1,len(ordered))
                for k,(key,vs) in enumerate(ordered):
                    text(key,x+12,gy+k*rh,8,MUTED);rect(gx+80,gy+k*rh+4,max(1,(gw-90)*vs[0]/maxval),rh*.55,BLUE)
            else:
                for n,name in enumerate(names):
                    prev=None
                    for k,(key,vs) in enumerate(series):
                        cx=gx+gw*(k+.5)/len(series);cy=gy+gh*(maxval-vs[n])/span
                        if typ=='lineChart':
                            c.setStrokeColor(colors[n%3]);c.setLineWidth(2.5)
                            if prev:c.line(prev[0],-prev[1],cx,-cy)
                            c.setFillColor(colors[n%3]);c.circle(cx,-cy,2.3,stroke=0,fill=1);prev=(cx,cy)
                        else:
                            bw=gw/len(series)*.7/len(names);zero=gy+gh*maxval/span;rect(cx-gw/len(series)*.35+n*bw,min(cy,zero),bw-2,abs(zero-cy),colors[n%3])
                        if n==0 and (len(series)<=6 or k%3==0):text(str(key),cx-25,gy+gh+10,8,MUTED)
                if len(names)>1:
                    for n,name in enumerate(names):text(name,gx+n*gw/len(names),y+30,8,colors[n%3])
    c.restoreState();c.showPage()
c.save()

store=json.loads((B.parent/'schemas'/'schema-store.json').read_text())
for u,s in list(store.items()):
    if '$id' in s:store[s['$id']]=s
checked=0
for f in (R/'definition').rglob('*.json'):
    o=json.loads(f.read_text(encoding='utf-8'));u=o.get('$schema')
    if u:
        errors=list(Draft7Validator(store[u],resolver=RefResolver(u,store[u],store=store)).iter_errors(o));assert not errors,(str(f),errors[0] if errors else None);checked+=1
assert count<=50
for p in P:
    for v in p.v:
        if v['visual']['visualType']=='tableEx' and v['name'] in TABLES:
            d=TABLES[v['name']]
            is_scroll=d['table']=='Bank Transactions' and any(f[2] in ['Party','Date'] for f in d['fields']) and p in originals
            if not is_scroll:
                actual=tabledata(v,'2025-26' if p is originals[3] else None)
                assert len(actual['rows'])==len(d['rows']),(p.title,len(actual['rows']),len(d['rows']))
assert sum(x['rows'] for x in COVERAGE if x['section'].startswith('Facility schedule'))==32
assert sum(x['rows'] for x in COVERAGE if x['year'])==75
assert all(sum(x['rows'] for x in COVERAGE if x['year']==yr)==25 for yr in ['2023-24','2024-25','2025-26'])
reader=PdfReader(str(pdf));assert len(reader.pages)==count
save(OUT/'Validation.json',{'pages':count,'nativeSchemaFiles':checked,'financialParameters':75,'allThreeYears':True,'tableRowBounds':'passed','nativeChartsRetained':len(CHARTS),'nativeCardsRetained':len(CARDS),'transactionPolicy':'Original interactive lists retained; PDF shows 15-row previews across continuation pages.','pdfRenderer':'Source snapshot rendered from the same native layout; Power BI export may differ slightly in font rendering.'})
(OUT/'README.md').write_text('''# Sudarshan Pharma Visual Review

Open SudarshanPharmaVisualReview.pbip in Power BI Desktop. The first four tabs retain the original native charts, KPI cards, filters, colours and dashboard layout. Continuation tabs carry complete review tables, including all 25 parameters for each of the three financial years. All transaction data remains embedded; transaction lists remain scrollable on the summary tab. The PDF prints the first 15 transaction/party rows on continuation pages. Summary tables show their initial complete rows and continue on later tabs.

Share SudarshanPharma_Visual_Review.pdf, or export all report pages from Power BI Desktop. The included PDF uses the same visual layout and extracted source snapshot; native Power BI exports can differ slightly in font rendering. If cards/charts are blank on first open, use Home > Refresh to load the embedded data snapshot. Refresh does not re-extract modified PDFs. Rebuild extraction and this report for changed source data. Original source qualifications and audited accounting bases remain applicable.
''',encoding='utf-8')
with zipfile.ZipFile(B/'SudarshanPharmaVisualReview.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in OUT.rglob('*'):
        if f.is_file() and '.pbi' not in f.parts:z.write(f,f.relative_to(OUT.parent))
print(json.dumps({'pages':count,'charts':len(CHARTS),'cards':len(CARDS),'tableContinuations':COVERAGE,'pdf':str(pdf)},indent=2))
