# 원본 엑셀의 "참조" / "스킬점수표" 시트가 바뀌었을 때 data.js를 다시 만드는 스크립트
# 사용법: pip install openpyxl && python tools/extract_data.py 원본.xlsm public/js/data.js
import openpyxl,json,sys
from openpyxl.utils import column_index_from_string as ci
wb=openpyxl.load_workbook(sys.argv[1],data_only=True)
R=wb['참조']; S=wb['스킬점수표']
def v(ws,a): return ws[a].value
def num(x): return 0 if x is None or x=='' else x
D={}
# awakening tables
def awaken(col0,ncols,headers):
    out={}
    colB=ci(col0)
    for r in range(1,80):
        h=R.cell(r,colB).value
        if h in headers:
            blk={}
            for rr in range(r+1,r+12):
                k=R.cell(rr,colB).value
                if k is None: continue
                blk[k]=[num(R.cell(rr,colB+1+j).value) for j in range(ncols)]
            out[h]=blk
    return out
D['batterAwaken']=awaken('B',4,['임팩','시그','골글','국대'])
D['pitcherAwaken']=awaken('N',2,['임팩','시그','골글','국대'])
def table(c0,r0,r1,n):
    out={}
    for r in range(r0,r1+1):
        k=R.cell(r,ci(c0)).value
        if k: out[k]=[num(R.cell(r,ci(c0)+1+j).value) for j in range(n)]
    return out
D['batterTypeCommon']=table('H',22,26,4)
D['pitcherTypeCommon']=table('R',22,26,2)
D['batterSetdeck']=table('H',6,10,4); D['batterEnhance']=table('H',14,18,4)
D['pitcherSetdeck']=table('R',6,10,2); D['pitcherEnhance']=table('R',14,18,2)
# pottuk rows 6..65, cols X..AQ
pt=[]
for r in range(6,66):
    pt.append([num(R.cell(r,c).value) for c in range(ci('X'),ci('AQ')+1)])
D['pottukRows']=pt  # index = refRow-6
# potential AT6:AY21
D['potential']={str(R.cell(r,ci('AT')).value):[num(R.cell(r,ci('AT')+j).value) for j in range(1,6)] for r in range(6,22)}
# skill prob: header in col, window rows header..header+16 (17 rows) ; value in next col
def probblocks(col, headers_exact, start_offset, win):
    c=ci(col); out={}
    for r in range(1,501):
        h=R.cell(r,c).value
        if isinstance(h,str) and h in headers_exact and h not in out:
            rows=[]
            for rr in range(r+start_offset, r+start_offset+win):
                a=R.cell(rr,c).value; b=R.cell(rr,c+1).value
                if isinstance(a,(int,float)) and not isinstance(a,bool):
                    rows.append([a, b if b is not None else 0])
            out[h]=rows
    return out
D['skillProbBatter']=probblocks('BA',['골글','시그','임팩','국대','라올'],0,17)
D['skillProbPitcher']=probblocks('BD',['골글','시그','임팩','국대','라올'],0,17)
D['skillProbReliever']=probblocks('BG',['골글','시그','임팩','국대','라올'],0,17)
# 훈재: OFFSET(BK1, MATCH(h,BJ:BJ,0),0,16) => rows h+1..h+16
D['trainProb']=probblocks('BJ',['골글','시그','임팩','국대','라올'],1,16)
D['specialProb']=probblocks('BM',['골글','시그','임팩','국대','라올','임팩(F)','시그(F)'],1,16)
D['potteum']={R.cell(r,ci('BP')).value:R.cell(r,ci('BQ')).value for r in range(6,11)}
def skills(c0):
    out=[]
    for r in range(4,301):
        n=S.cell(r,ci(c0)).value
        if n is None: continue
        out.append([n]+[S.cell(r,ci(c0)+j).value for j in range(1,7)])
    return out
D['skillBatter']=skills('B'); D['skillPitcher']=skills('I')
D['skillDate']=S['B2'].value
print(json.dumps({k:(len(v) if hasattr(v,'__len__') else v) for k,v in D.items()},ensure_ascii=False))
open(sys.argv[2] if len(sys.argv)>2 else 'public/js/data.js','w').write('// 원본 엑셀(참조 / 스킬점수표 시트)에서 자동 추출한 데이터\nexport const DATA = '+json.dumps(D,ensure_ascii=False)+';\n')
