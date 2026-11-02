"""Extract original statement transactions; retain source page and balance checks."""
import sys,json,re,datetime,collections
from pathlib import Path
B=Path(__file__).resolve().parent
sys.path.insert(0,str(B.parent.parent/'.powerbi-tools'))
from pypdf import PdfReader
rows=[];checks=[]
def money(s):return round(float(s.replace(',','').replace(' ','')),2) if s.strip() and s.strip()!='-' else 0.0
def emit(bank,source,page,seq,date,desc,debit,credit,balance,opening=False):
    rows.append(dict(Bank=bank,Source=source,Page=page,Sequence=seq,Date=date,Month=date[:7],Narration=desc,Debit=debit,Credit=credit,Balance=balance,Opening=opening))
for p in sorted((B/'sources').rglob('*.pdf')):
    if 'Company Banking' not in str(p):continue
    reader=PdfReader(p)
    if reader.is_encrypted:reader.decrypt('GPI064477')
    bank='BOB • 0143' if 'BOB Bank' in str(p) else 'ICICI • 2017' if 'ICICI Bank' in str(p) else 'Vighnaharta • 0023'
    before=len(rows)
    for pn,page in enumerate(reader.pages,1):
        if bank.startswith('ICICI'):
            parts=[]
            page.extract_text(visitor_text=lambda t,cm,tm,f,s:parts.append((round(tm[4],1),round(tm[5],1),t.strip())) if t.strip() else None)
            starts=sorted([(y,int(t)) for x,y,t in parts if abs(x-50)<1 and t.isdigit() and y>70],reverse=True)
            for k,(top,seq) in enumerate(starts):
                floor=starts[k+1][0] if k+1<len(starts) else 70
                def cell(xp):return ''.join(t.replace('\n','') for x,y,t in parts if abs(x-xp)<1 and floor<y<=top)
                date=cell(162.0)
                try:date=datetime.datetime.strptime(date,'%d-%b-%Y').date().isoformat()
                except ValueError:raise ValueError((p.name,pn,seq,date))
                emit(bank,p.name,pn,seq,date,cell(296.3),money(cell(363.5)),money(cell(430.6)),money(cell(497.8)))
        elif bank.startswith('BOB'):
            lines=page.extract_text(extraction_mode='layout').splitlines();current=None
            for line in lines:
                m=re.match(r'^\s*(\d+)\s+(\d{2}-\d{2}-\d{4})\s+(?:(\d{2}-\d{2}-\d{4})\s+)?(.*?)\s{2,}([\d,]+\.\d{2}|-)\s+([\d,]+\.\d{2}|-)\s+([\d,]+\.\d{2})\s*$',line)
                if m:
                    seq,dt,vd,desc,db,cr,bal=m.groups();date=datetime.datetime.strptime(dt,'%d-%m-%Y').date().isoformat()
                    emit(bank,p.name,pn,int(seq),date,desc.strip(),money(db),money(cr),money(bal),'Opening Balance' in desc);current=rows[-1]
                elif current and line.strip() and not re.search(r'Note:|computer-generated|maintained in|Page \d|Account Statement|Serial|Transaction|Value|Description|Number|Debit|Credit|Balance|^\s*No\s|^\s*Date',line):
                    # Continuation narration is to the left of the amount columns.
                    if len(line)-len(line.lstrip())>=30:current['Narration']+=' '+line.strip()
        else:
            current=None
            for line in page.extract_text().splitlines():
                m=re.match(r'^(\d{2}-\d{2}-\d{4})\s+(.*?)\s+([\d,]+\.\d{2})\s+(?:([\d,]+\.\d{2})\s+)?(-?[\d,]+\.\d{2})\s+(Cr|Dr)$',line)
                if m:
                    dt,desc,a,b,bal,side=m.groups();desc=re.sub(r'\s+0$','',desc);date=datetime.datetime.strptime(dt,'%d-%m-%Y').date().isoformat();op='Opening Balance' in desc
                    db=money(a) if desc.startswith('TO') else 0;cr=money(a) if desc.startswith('BY') else 0
                    emit(bank,p.name,pn,len(rows)-before+1,date,desc,db,cr,money(bal)*(1 if side=='Cr' else -1),op);current=rows[-1]
                elif current and line.strip() and not re.search(r'^Page |^Vighnaharta|^Branch |^Rege|^From Date|^Name |^ADDRESS|^BLOCK |^MUMBAI|^Pan |^Mob|^A/c |^Interest|^VGMU|^Last Int|^Date Dr',line):current['Narration']+=' '+line.strip()
    group=rows[before:];prev=None;errors=[]
    for row in group:
        if prev is not None and not row['Opening']:
            residual=round(row['Balance']-prev-row['Credit']+row['Debit'],2)
            if abs(residual)>.02:errors.append({'page':row['Page'],'sequence':row['Sequence'],'residual':residual})
        prev=row['Balance']
    checks.append({'source':p.name,'rows':len(group),'debits':round(sum(r['Debit'] for r in group),2),'credits':round(sum(r['Credit'] for r in group),2),'first_balance':group[0]['Balance'] if group else None,'last_balance':prev,'balance_errors':errors})
# Exact reciprocal amounts on the same date, across owned accounts; exclude ambiguous pairs.
transactions=[r for r in rows if not r['Opening']]
for r in transactions:r['Internal Match']='No confirmed pair'
for r in transactions:
    if not r['Debit']:continue
    candidates=[s for s in transactions if s['Bank']!=r['Bank'] and s['Date']==r['Date'] and abs(s['Credit']-r['Debit'])<.01 and s['Internal Match']=='No confirmed pair']
    # Account ownership cue is required, not amount/date alone.
    cues=r['Narration'].upper()
    if len(candidates)==1 and (re.search(r'ROYAL|NEERAJ|OWN|SELF|1000023|00000143|05002017',cues) or re.search(r'ROYAL|NEERAJ|OWN|SELF',candidates[0]['Narration'].upper())):
        r['Internal Match']=candidates[0]['Internal Match']='Confirmed reciprocal transfer'
for r in transactions:
    n=r['Narration'].upper()
    r['Return Type']='ECS/NACH return candidate' if re.search(r'(ACH|ECS|NACH).*(RET|RTN|RETURN)|(?:RET|RTN|RETURN).*(ACH|ECS|NACH)',n) else 'Cheque return candidate' if re.search(r'(CHQ|CHEQ|CLG).*(RET|RTN|RETURN)|(?:RET|RTN|RETURN).*(CHQ|CHEQ|CLG)',n) else 'Other return candidate' if re.search(r'RETURN|\bRTN\b|\bRET\b',n) else 'No return marker'
    r['Cash Deposit']=r['Credit'] if re.search(r'CASH.*DEP|CASH.*CR|CASH DEPOSIT|BY.*CASH|CAM/',n) else 0
    r['Penal Charges']=r['Debit'] if re.search(r'PENAL|PENALTY|BOUNCE|(?:RET|RTN|RETURN).*(CHG|CHARGE)|(?:CHG|CHARGE).*(RET|RTN|RETURN)',n) else 0
    r['Loan Credit Candidate']=r['Credit'] if re.search(r'FINANCE|FINCAP|CAPITAL|LOAN|LENDING|SAISON|FINSERV|FINCORP|SIEMENS|EPIMONEY|NEOGROWTH|PROTIUM',n) else 0
    n=re.sub(r'\s+',' ',n).strip(); party=n
    if r['Bank'].startswith('Vighnaharta'):
        party=re.sub(r'^(?:BY|TO)\s+TRF\s*','',n)
        party=re.sub(r'^(?:CR\. FOR RTGS:[A-Z0-9]+\s*|IRTGS:|RTGS:)','',party)
        party=re.sub(r'\s+RATN[A-Z0-9]+.*','',party)
    elif n.startswith(('NEFT-','RTGS-')):party=re.sub(r'^(?:NEFT|RTGS)-[A-Z0-9]+-','',n)
    elif n.startswith('ACHDR/'):party=n.split('/')[1]
    elif n.startswith(('RTGS/','RTGS:','NEFT/')):party=n.split('/')[-1]
    elif n.startswith('UPI/'):party=next((v for v in n.split('/') if '@' in v),n)
    r['Party']=party.strip() or 'Unresolved narration'
    r['BTO Eligible']=r['Credit'] if r['Internal Match']!='Confirmed reciprocal transfer' and not r['Loan Credit Candidate'] and r['Return Type']=='No return marker' else 0
(B/'bank-transactions.json').write_text(json.dumps(transactions,indent=2,ensure_ascii=False),encoding='utf-8')
(B/'bank-checks.json').write_text(json.dumps(checks,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(checks,indent=2,ensure_ascii=False))
