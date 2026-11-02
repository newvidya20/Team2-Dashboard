import pathlib,json,shutil
BASE=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path(r'C:\Users\loanb\OneDrive\Desktop\Power BI\SarangiCreditReview')
for root in [ROOT,BASE/'output'/'SarangiCreditReview']:
    count=0
    for file in (root/'SarangiCreditReview.Report'/'definition').rglob('visual.json'):
        obj=json.loads(file.read_text(encoding='utf-8'))
        vis=obj.get('visual',{})
        if vis.get('visualType')!='card': continue
        vis['visualContainerObjects']['title'][0]['properties']['fontSize']={'expr':{'Literal':{'Value':'10D'}}}
        vis.setdefault('objects',{}).setdefault('labels',[{'properties':{}}])[0]['properties']['fontSize']={'expr':{'Literal':{'Value':'24D'}}}
        file.write_text(json.dumps(obj,indent=2,ensure_ascii=False),encoding='utf-8'); count+=1
    pages=root/'SarangiCreditReview.Report'/'definition'/'pages'/'pages.json'
    obj=json.loads(pages.read_text()); obj['activePageName']=obj['pageOrder'][0]; pages.write_text(json.dumps(obj,indent=2),encoding='utf-8')
    print(f'Adjusted {count} cards and selected overview: {root}')
shutil.copytree(BASE/'output'/'CreditReviewData',ROOT/'CreditReviewData',dirs_exist_ok=True)
shutil.copy2(BASE/'output'/'validation.json',ROOT/'validation.json')
print('Updated source audit CSVs and validation totals.')
