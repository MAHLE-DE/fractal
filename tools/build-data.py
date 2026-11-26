"""Snapshot sem caminhos absolutos; Python somente no desenvolvimento."""
import argparse, collections as C, datetime as D, json, math, re, subprocess
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('--source',type=Path,default=Path('../link_normas')); a=p.parse_args()
root=Path(__file__).resolve().parents[1]; source=a.source
def read(p): return json.loads((source/p).read_text(encoding='utf-8'))
cad=read('02_BANCO_ATUAL/cadastro_canonico_v3_SEM_URL_SHAREPOINT.json'); records={r['document_no']:r for r in cad['records']}
result=read('10_EXTRATOR/saida/resultado_05_DOCUMENTS.json')
# Normas finais validas sem codigo no formato novo (decisao F9 do usuario, mapa versionado do link_normas).
# Elas nao estao no Valid-Documents, mas sao citadas como norma vigente; entram no anel como no proprio.
# Titulo: como as normas citantes o descrevem (o mapa nao traz titulo).
FINAL_LEGACY={'W-B-0718':'Identification, specification and marking of special characteristics'}
versioned=read('02_BANCO_ATUAL/mapa_normas_v1.json')['codigos']
for d,title in FINAL_LEGACY.items():
 if versioned.get(d,{}).get('status')!='LEGADO_SEM_SUCESSOR': print('aviso: mapa sem a decisao F9 de',d,'(usa a decisao registrada aqui)')
 records[d]=dict(document_no=d,title=versioned.get(d,{}).get('titulo') or title,previous_document_no='',language='',local_file_name='',finalLegacy=True)
mp='02_BANCO_ATUAL/mapa_base/mapa_normas_v1.json'
if not (source/mp).exists(): mp='02_BANCO_ATUAL/mapa_normas_v1.json'
mapping=read(mp)['codigos']
def group(d):
 m=re.match(r'[SGW]-([A-Z])-([A-Z]{2})-(\d{2})',records[d].get('previous_document_no') or '')
 return m.groups() if m else ('-','-','--')
ids=sorted(records,key=lambda d:(d.split('-')[0],group(d),d)); positions={d:i for i,d in enumerate(ids)}
nodes=[dict(id=d,category=d.split('-')[0],group=group(d)[0],type=group(d)[1],title=records[d]['title'],previous=records[d].get('previous_document_no') or '',language=records[d]['language'],finalLegacy=bool(records[d].get('finalLegacy')),file=records[d].get('local_file_name') or '',aliases=sorted(k for k,v in mapping.items() if v.get('atual')==d and v.get('status') in ('VIGENTE','RESOLVIDO')),angle=2*math.pi*i/len(ids)) for i,d in enumerate(ids)]
hierarchy=[]
for cat in sorted({n['category'] for n in nodes}):
 groups=[]
 for gp in sorted({n['group'] for n in nodes if n['category']==cat}):
  ns=[n for n in nodes if n['category']==cat and n['group']==gp]; groups.append(dict(id=gp,angle=sum(n['angle'] for n in ns)/len(ns),nodes=[n['id'] for n in ns]))
 ns=[n for n in nodes if n['category']==cat]; hierarchy.append(dict(id=cat,angle=sum(n['angle'] for n in ns)/len(ns),groups=groups))
def ancestors(d):
 n=nodes[positions[d]]; c=next(c for c in hierarchy if c['id']==n['category']); g=next(g for g in c['groups'] if g['id']==n['group']); return [n['angle'],g['angle'],c['angle']]
edges=[]; public=[]; legacy=[]
for row in result['correlacoes']:
 x,y=row['pai'],row['citada']
 if row['tipo']=='interna' and x in records and y in records and x!=y:
  aa,bb=ancestors(x),ancestors(y)
  controls=[[aa[0],1],[aa[1],.76],[aa[2],.40],[0,0],[bb[2],.40],[bb[1],.76],[bb[0],1]]
  edges.append(dict(source=x,target=y,evidence=row['evidencia'],pages=row['paginas'],rawCodes=row.get('codigo_bruto',[]),mapStatus=row.get('status_mapa',''),controls=controls,beta=.85))
 elif row['tipo'] in ('publica','regulatoria'): public.append(dict(source=x,target=y,evidence=row['evidencia'],pages=row['paginas'],rawCodes=row.get('codigo_bruto',[]),mapStatus=row.get('status_mapa','')))
 elif row['tipo']=='interna': legacy.append((x,y))
assert len({(e['source'],e['target']) for e in edges})==len(edges)
adj={d:set() for d in ids}
for e in edges: adj[e['source']].add(e['target']); adj[e['target']].add(e['source'])
shared=C.defaultdict(set)
for e in public: shared[e['target']].add(e['source'])
for x,y in legacy: shared[y].add(x)
for ds in shared.values():
 ds=sorted(ds & records.keys())
 for d in ds[1:]: adj[ds[0]].add(d); adj[d].add(ds[0])
seen=set(); comps=[]
for d in ids:
 if d in seen: continue
 stack=[d]; cc=set(); seen.add(d)
 while stack:
  x=stack.pop(); cc.add(x)
  for y in sorted(adj[x]-seen): seen.add(y); stack.append(y)
 comps.append(cc)
connected=set(max(comps,key=len)); pending=sorted(set(ids)-connected); affinities=[]; history=C.defaultdict(set)
for r in result['descartes']:
 if r['pai'] in records and r['motivo'] in ('retirado_mapa','excluido_decisao','historica','marcada_retirada'): history[r['citada']].add(r['pai'])
for layer in ('ancestral','familia','grupo','categoria'):
 remaining=[]
 for d in pending:
  if layer=='ancestral': candidates=set().union(*(v for v in history.values() if d in v))
  elif layer=='familia': candidates={x for x in ids if group(x)==group(d) and group(d)[0]!='-'}
  elif layer=='grupo': candidates={x for x in ids if group(x)[:2]==group(d)[:2] and group(d)[0]!='-'}
  else: candidates=({x for x in ids if x!=d and x.split('-')[0]==d.split('-')[0] and group(x)[0]==group(d)[0]} or {x for x in ids if x!=d and x.split('-')[0]==d.split('-')[0]})
  choices=sorted((candidates & connected)-{d})
  if choices: affinities.append(dict(source=d,target=choices[0],layer=layer,notCitation=True)); connected.add(d)
  else: remaining.append(d)
 pending=remaining
dates=re.search(r'Valid-Documents-(\d{4}-\d{2}-\d{2})',str(cad.get('sources',{}).get('valid_documents','')))
commit=subprocess.check_output(['git','rev-parse','origin/main'],cwd=source,text=True).strip()
assert not subprocess.check_output(['git','diff','origin/main','--','10_EXTRATOR/saida/resultado_05_DOCUMENTS.json'],cwd=source)
data=dict(meta=dict(validDocuments=dates[1] if dates else None,sourceCommit=commit,generatedAt=D.datetime.now(D.timezone.utc).isoformat(),nodes=len(nodes),vigentes=sum(not n['finalLegacy'] for n in nodes),finalLegacy=sorted(FINAL_LEGACY),byCategory=dict(sorted(C.Counter(n['category'] for n in nodes).items())),edges=len(edges),public=len(public),map=mp),nodes=nodes,edges=edges,public=public,affinities=affinities,hierarchy=hierarchy)
(root/'data/cascade-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(data['meta'])
