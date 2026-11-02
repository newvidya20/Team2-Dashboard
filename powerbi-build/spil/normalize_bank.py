import json,re,collections
from pathlib import Path
B=Path(__file__).resolve().parent;raw=json.loads((B/'bank-raw.json').read_text(encoding='utf-8'))
# Preserve repeated genuine rows within each source; remove only cross-document overlap.
seen=collections.Counter();local=collections.Counter();bank=[];duplicates=[]
for r in raw:
    key=(r['Bank'],r['Date'],r['Debit'],r['Credit'],r['Balance'])
    occurrence=(r['Source ID'],key);local[occurrence]+=1
    if local[occurrence]<=seen[key]:duplicates.append(r);continue
    seen[key]=local[occurrence];bank.append(r)
owned=['921030007131058','022230150000001','054451000192','8026481131','0148095487','696701010050084','696705010000102']
utr=collections.defaultdict(list)
for i,r in enumerate(bank):
    n=r['Narration'].upper();compact=re.sub(r'\s','',n)
    r['Internal Match']='Own-account narration candidate' if 'SUDARSHANPHARMA' in compact or any(a in compact for a in owned) else 'No own-account marker'
    for ref in set(re.findall(r'\b[A-Z]{4}[RHN]\d{12,}',compact)):utr[ref].append(i)
for ref,indices in utr.items():
    debits=[i for i in indices if bank[i]['Debit']>0];credits=[i for i in indices if bank[i]['Credit']>0]
    for i in debits:
        candidates=[j for j in credits if bank[j]['Bank']!=bank[i]['Bank'] and 0<=bank[i]['Debit']-bank[j]['Credit']<=100]
        if len(candidates)==1:bank[i]['Internal Match']=bank[candidates[0]]['Internal Match']='Confirmed reciprocal UTR'
for r in bank:
    n=r['Narration'].upper();compact=re.sub(r'\s','',n)
    r['Return Type']='ECS/NACH return marker' if re.search(r'(ACH|ECS|NACH).*(RETURN|RTN|RET\b)|(?:RETURN|RTN|RET\b).*(ACH|ECS|NACH)',n) else 'Cheque return marker' if re.search(r'(CHEQ|CHQ|CLG).*(RETURN|RTN|RET\b|DISHON)|(?:RETURN|RTN|RET\b|DISHON).*(CHEQ|CHQ|CLG)',n) else 'Other return marker' if re.search(r'RETURN|\bRTN\b|\bRET\b|DISHON',n) else 'No return marker'
    r['Penal Charges']=r['Debit'] if re.search(r'PENAL|PNLCHRG|PEN CHG|PEN CHARG|DISHONOUR|BOUNCE|(?:RET|RETURN|RTN).*(CHG|CHARGE)',n) else 0
    r['Cash Deposit']=r['Credit'] if re.search(r'CASH.*DEP|CASH.*CR|BY.*CASH|CAM/',n) else 0
    r['Loan Credit Candidate']=r['Credit'] if re.search(r'LOAN DISB|BULK LOAN|LOAN AMT|TERM LOAN|FINAGG|VIVRITI|TAP CAPITAL|VANIK|FINCORP|FINANCIAL SERVICES|CHOLAMANDALAM',n) else 0
    r['BTO Eligible']=r['Credit'] if r['Internal Match']=='No own-account marker' and r['Return Type']=='No return marker' and not r['Loan Credit Candidate'] else 0
    party=n
    if r['Internal Match']!='No own-account marker':party='SUDARSHAN PHARMA • OWN ACCOUNT'
    elif n.startswith(('NEFT:','RTGS:')):party=re.split(r'\s+(?:[A-Z]{4}[RHN]|SENDER)',n.split(':',1)[1])[0]
    elif n.startswith('NEFTO-'):party=n[6:]
    elif n.startswith(('RTGS-','NEFT-')):party=re.sub(r'^(?:RTGS|NEFT)-[A-Z0-9\s]+?-','',n)
    elif re.match(r'^(RTGS|NEFT)/',n):
        parts=n.split('/');party=parts[3] if len(parts)>3 else n
    elif re.match(r'^(CLG|BRN-CLG)',n):party=re.sub(r'^.*?(?:PAID TO |CLG/)','',n).split('/')[0]
    party=re.sub(r'\s+',' ',party).strip();r['Party']=party or 'Unresolved narration'
    r['Extracted Sequence']=r['Sequence']
(B/'bank-transactions.json').write_text(json.dumps(bank,ensure_ascii=False),encoding='utf-8')
(B/'overlap-duplicates.json').write_text(json.dumps(duplicates,ensure_ascii=False),encoding='utf-8')
summary={'raw_rows':len(raw),'deduplicated_rows':len(bank),'overlap_rows_removed':len(duplicates),'accounts':sorted({r['Bank'] for r in bank}),'date_range':[min(r['Date'] for r in bank),max(r['Date'] for r in bank)],'confirmed_internal_credit':sum(r['Credit'] for r in bank if r['Internal Match']=='Confirmed reciprocal UTR'),'narration_internal_credit':sum(r['Credit'] for r in bank if r['Internal Match']=='Own-account narration candidate')}
(B/'bank-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8');print(json.dumps(summary,indent=2))
