import sys,json,re,datetime,collections
from pathlib import Path
B=Path(__file__).resolve().parent;sys.path.insert(0,str(B.parent.parent/'.powerbi-tools'))
from pypdf import PdfReader
inventory=json.loads((B/'inventory.json').read_text());rows=[];checks=[];fail=[]
def number(s):
    s=re.sub(r'[,\s]','',s).replace('Cr.','').replace('Dr.','').replace('INR','').replace('DR','').replace('CR','')
    if not s or s=='-':return 0.
    return round(float(s),2)
def dt(s):
    s=re.sub(r'\s','',s)
    for f in ['%d-%m-%Y','%d/%m/%Y','%d/%b/%Y','%d-%b-%Y']:
        try:return datetime.datetime.strptime(s,f).date().isoformat()
        except ValueError:pass
    raise ValueError(s)
for item in inventory[:81]:
    no=item['id'];r=PdfReader(B/'sources'/item['file'])
    if r.is_encrypted:r.decrypt('2081SUDA')
    bank='Axis • 1058' if no<14 else 'BOI • 0001' if no<18 else 'ICICI • 0192' if no<32 else 'Indian • 1131' if no<46 else 'Kotak • 5487' if no<53 else 'Union • 0084' if no<67 else 'Union • 0102'
    local=[]
    for pn,p in enumerate(r.pages,1):
        a=[];p.extract_text(visitor_text=lambda t,cm,tm,f,s:a.append((round(tm[4],1),round(tm[5],1),t.strip())) if t.strip() else None)
        # Each bank's physical columns are read separately; wrapped amounts/dates are reassembled.
        axis_smart=bank.startswith('Axis') and no in [4,5,8]
        axis_report=bank.startswith('Axis') and no>=4 and not axis_smart
        icici_new=no==22
        indian_new=bank.startswith('Indian') and any(t=='Remitter' for x,y,t in a)
        if axis_report:
            drx=next((x for x,y,t in a if t in ['DR','CR']),350)
            dates=[(y,t) for x,y,t in a if 40<x<50 and re.fullmatch(r'\d{2}/\d{2}/\d{4}',t)]
            anchors=[(y,max((d for d in dates if d[0]<=y+.1),default=(0,''))[1]) for x,y,t in a if t in ['DR','CR'] and abs(x-drx)<.1];offset=.5
            if no==7:anchors=dates;offset=7
        elif axis_smart:
            anchors=[(y,t) for x,y,t in a if 110<x<120 and re.fullmatch(r'\d{2}/\d{2}/\d{4}',t)];offset=.5
        elif bank.startswith('Axis'):
            anchors=[(y,t) for x,y,t in a if 35<x<60 and re.fullmatch(r'\d{2}-\d{2}-\d{4}',t)];offset=7
        elif icici_new:
            anchors=[(y,t) for x,y,t in a if 0<x<25 and t.isdigit() and y>40];offset=15
        elif bank.startswith('ICICI'):
            anchors=[(y,t) for x,y,t in a if 89<x<92 and t.isdigit()];offset=.5
        elif indian_new:
            anchors=[(y,t) for x,y,t in a if 135<x<140 and re.fullmatch(r'\d{2}/\d{2}',t)];offset=5
        elif bank.startswith('Indian'):
            anchors=[(y,t) for x,y,t in a if 140<x<155 and re.fullmatch(r'\d{2}/\d{2}/(?:\d{4})?',t)];offset=.5
        elif bank.startswith('Kotak'):
            anchors=[(y,t) for x,y,t in a if 80<x<90 and re.fullmatch(r'\d{2}/\d{2}/\d{4}',t)];offset=5
        elif bank.startswith('Union'):
            anchors=[(y,t) for x,y,t in a if 35<x<45 and re.fullmatch(r'\d{2}-\d{2}-\d{4}',t)];offset=.5
        elif no==14:
            anchors=[(y,t) for x,y,t in a if 70<x<90 and re.fullmatch(r'\d{2}-\d{2}-\d{4}',t)];offset=.5
        else:
            anchors=[(y,t) for x,y,t in a if 25<x<35 and re.fullmatch(r'\d{2}-[A-Za-z]{3}-\d{4}',t)];offset=.5
        anchors=sorted(set(anchors),reverse=True)
        for k,(top,label) in enumerate(anchors):
            floor=anchors[k+1][0]+offset if k+1<len(anchors) else (top-100 if top<0 else 25)
            selected=sorted([(x,y,t) for x,y,t in a if floor<y<=top+offset],key=lambda v:-v[1])
            def cell(lo,hi,sep=''):return sep.join(t.replace('\n','') for x,y,t in selected if lo<=x<hi)
            def numeric(lo,hi,depth=0):return ''.join(t.replace('\n','') for x,y,t in selected if lo<=x<hi and y>=top-depth-.1 and re.fullmatch(r'[\d\s,.\-]+|INR\s+[\d\s,.\-]+',t))
            try:
                if axis_report:
                    date=dt(label);amt=number(numeric(260,drx-1));dbcr=cell(drx-1,drx+1);db=amt if 'DR' in dbcr else 0;cr=amt if 'CR' in dbcr else 0;bal=number(numeric(drx+1,445));desc=cell(140,260,' ');ref=cell(445,499)
                elif axis_smart:
                    date=dt(label);amt=number(numeric(470,550));dbcr=cell(550,640);db=amt if 'DR' in dbcr else 0;cr=amt if 'CR' in dbcr else 0;bal=number(numeric(640,735));desc=cell(380,470,' ');ref=cell(290,380)
                elif bank.startswith('Axis'):
                    date=dt(label);dbcr=cell(410,430);amt=number(numeric(340,405));db=amt if 'DR' in dbcr else 0;cr=amt if 'CR' in dbcr else 0;bal=number(numeric(430,478));desc=cell(120,290,' ');ref=cell(290,340)
                elif icici_new:
                    date=dt(cell(180,300).split(' ')[0][:10]);amt=number(numeric(730,820,2));dbcr=cell(695,730);db=amt if 'DR' in dbcr else 0;cr=amt if 'CR' in dbcr else 0;bal=number(numeric(820,920,16));desc=cell(410,695,' ');ref=cell(35,100)
                elif bank.startswith('ICICI'):
                    date=dt(cell(174,180));db=number(numeric(395,434,22));cr=number(numeric(434,473,22));bal=number(numeric(474,530,22));desc=cell(321,395,' ');ref=cell(108,130)
                elif indian_new:
                    date=dt(cell(135,145));db=number(cell(700,810));cr=number(cell(810,930));bs=cell(930,1150);bal=-abs(number(bs)) if 'DR' in bs else number(bs);desc=cell(400,580,' ');ref=cell(580,700)
                elif bank.startswith('Indian'):
                    date=dt(cell(140,158));db=number(cell(420,590));cr=number(cell(255,420));bal=number(cell(590,750));desc=cell(760,1200,' ');ref=''
                elif bank.startswith('Kotak'):
                    date=dt(label);amt=number(cell(500,630));dbcr=cell(635,655);db=amt if 'DR' in dbcr else 0;cr=amt if 'CR' in dbcr else 0;bal=number(cell(695,800));desc=cell(225,370,' ');ref=cell(370,500)
                elif bank.startswith('Union'):
                    date=dt(label);db=number(numeric(450,550));cr=number(numeric(550,640));bal=number(numeric(640,750));desc=cell(100,210,' ');ref=cell(210,280)
                elif no==14:
                    date=dt(label);db=number(numeric(470,550));cr=number(numeric(550,650));bal=number(numeric(680,748))*(-1 if 'Dr' in cell(748,780) else 1);desc=cell(230,470,' ');ref=cell(150,230)
                else:
                    date=dt(label);db=number(numeric(340,420));cr=number(numeric(420,500));bal=number(numeric(520,590));desc=cell(85,275,' ');ref=cell(275,340)
                if not (db or cr):continue
                local.append({'Date':date,'Month':date[:7],'Bank':bank,'Debit':db,'Credit':cr,'Balance':bal,'Narration':desc,'Reference':ref,'Source ID':no,'Source':item['original'].split('/')[-1],'Page':pn,'Sequence':len(local)+1})
            except Exception as e:fail.append({'source':no,'page':pn,'anchor':label,'error':str(e)})
    def error_count(rs):return sum(abs(round(c['Balance']-p['Balance']-c['Credit']+c['Debit'],2))>.05 for p,c in zip(rs,rs[1:]))
    if error_count(list(reversed(local)))<error_count(local):local.reverse()
    errors=[]
    for previous,current in zip(local,local[1:]):
        residual=round(current['Balance']-previous['Balance']-current['Credit']+current['Debit'],2)
        if abs(residual)>.05:errors.append({'sequence':current['Sequence'],'date':current['Date'],'residual':residual,'page':current['Page']})
    checks.append({'source':no,'bank':bank,'rows':len(local),'balance_errors':errors,'parse_failures':sum(x['source']==no for x in fail)})
    rows+=local
    print(no,len(local),'balance_errors',len(errors),flush=True)
(B/'bank-raw.json').write_text(json.dumps(rows,ensure_ascii=False),encoding='utf-8')
(B/'bank-checks.json').write_text(json.dumps(checks,indent=2),encoding='utf-8');(B/'bank-parse-failures.json').write_text(json.dumps(fail,indent=2),encoding='utf-8')
print('TOTAL',len(rows),'FAILURES',len(fail),'BALANCE ERRORS',sum(len(x['balance_errors']) for x in checks))
