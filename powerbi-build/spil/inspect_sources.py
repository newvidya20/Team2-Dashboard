import sys,json,zipfile,re
from pathlib import Path
B=Path(__file__).resolve().parent
sys.path.insert(0,str(B.parent.parent/'.powerbi-tools'))
from pypdf import PdfReader
B.mkdir(exist_ok=True)
for d in ['sources','text','layout','scans']:(B/d).mkdir(exist_ok=True)
z=zipfile.ZipFile('C:/Users/loanb/Downloads/SUDARSHAN PHARMA INDUSTRIES LIMITED.zip')
inventory=[]
for no,item in enumerate(i for i in z.infolist() if not i.is_dir()):
    name=f'{no:03d}'+Path(item.filename).suffix.lower();p=B/'sources'/name;p.write_bytes(z.read(item))
    record={'id':no,'original':item.filename,'file':name,'size':item.file_size}
    if p.suffix=='.pdf':
        try:
            r=PdfReader(p)
            if r.is_encrypted:
                for password in ['','2081SUDA']:
                    if r.decrypt(password):break
            pages=[page.extract_text() or '' for page in r.pages]
            record.update(pages=len(pages),chars=sum(map(len,pages)))
            (B/'text'/f'{no:03d}.txt').write_text('\n'.join(f'\n--- PAGE {i+1} ---\n{t}' for i,t in enumerate(pages)),encoding='utf-8')
            if 'Banking/' in item.filename:
                (B/'layout'/f'{no:03d}.txt').write_text('\n'.join(f'\n--- PAGE {i+1} ---\n'+page.extract_text(extraction_mode='layout') for i,page in enumerate(r.pages)),encoding='utf-8')
        except Exception as e:record['error']=str(e)
    inventory.append(record)
(B/'inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
print(json.dumps({'files':len(inventory),'errors':[x for x in inventory if 'error' in x],'scans':[x for x in inventory if x.get('chars')==0],'financials':[x for x in inventory if "Financial's/" in x['original']]},indent=2))
