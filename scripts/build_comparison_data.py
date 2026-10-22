#!/usr/bin/env python3
"""Deterministic, offline migration of the handbook's existing evidence.

Core narrative is editorial synthesis, not a functional test. Catalog descriptions
never establish upload/export formats or account conditions. Focus declarations
retain their source-level evidence and task limitations.
"""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

DIMENSIONS = [('position','定位'),('materials','材料类型'),('input','输入条件'),
              ('capabilities','主要能力'),('conditions','使用条件'),('review','人工复核'),
              ('output','成果输出'),('limits','限制与风险'),('collaboration','协作与衔接'),('sources','资料来源')]


def unknown():
    return dict(text='资料待补充', evidence='资料待补充', checkedAt=None, sources=[])


def sources_of(values):
    result = []
    for value in values:
        label, url = (value.get('label','资料来源'), value.get('url','')) if isinstance(value,dict) else value
        parsed = urlsplit(url)
        if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password:
            continue
        if url not in [s['url'] for s in result]:
            result.append(dict(label=label,url=url))
    return result


def date_of(text):
    dates = re.findall(r'(?<![0-9])(20\d{2}-\d{2}-\d{2})(?![0-9])', text or '')
    return max(dates) if dates else None


def declaration(text, sources, evidence='核心档案整理', checked=None):
    if isinstance(text,list):
        text = '；'.join(text)
    if not text:
        return unknown()
    return dict(text=text,evidence=evidence,checkedAt=checked,sources=sources)


def extract(html, name):
    match = re.search(r'<script\b[^>]*\bid=[\"\']'+re.escape(name)+r'[\"\'][^>]*>(.*?)</script>',html,re.S)
    if not match:
        raise ValueError('Missing embedded data: '+name)
    return json.loads(match.group(1))


def kind_of(tool):
    if '案例' in tool.get('sourceCategory',''):
        return '机构方法案例'
    if tool.get('layer') == '史料数据库与检索资源':
        return '史料数据库'
    if tool.get('layer') == '辅助工具与技术底座':
        return '配套工具'
    if tool.get('sourceCategory') in ('机构案例','方法案例') or any(s in tool.get('name','') for s in ['实验室','研究中心','数字人文中心']):
        return '机构方法案例'
    return '处理工具'


def build(path):
    html = Path(path).read_text(encoding='utf-8')
    cores = extract(html,'core-platforms-data')
    catalog = extract(html,'tool-catalog-data')
    focus = {x['id']:x for x in extract(html,'focus-platforms-data')}
    # Original visible focus-intro method note dates this topic's task matrix.
    # This baseline does not establish a date for each overview declaration.
    baseline_match = re.search(r'资料核对：(20[0-9]{2}-[0-9]{2}-[0-9]{2})[^<]*本专题依据官方公开资料', html)
    focus_baseline = baseline_match.group(1) if baseline_match else None
    by_name = {x['name']:x for x in cores}
    by_id = {x['id']:x for x in cores}
    platforms = []
    for tool in catalog:
        core = by_name.get(tool.get('coreName'))
        pid = ('comparativus' if tool['name']=='COMPARATIVUS' else core['id']) if core else 'tool-'+str(tool['id'])
        # The combined editorial profile must never be inherited wholesale.
        if pid in ('markus','comparativus'):
            core = None
        platforms.append(make_platform(pid, tool, core, focus.get(pid), focus_baseline))
    for pid in ('yunsiku','dedu','texta'):
        platforms.append(make_platform(pid,None,by_id[pid],focus.get(pid),focus_baseline))
    dates = [f['checkedAt'] for p in platforms for f in p['fields'].values() if f['checkedAt']]
    return dict(version=1,updated=max(dates) if dates else None,
                dimensions=[dict(key=k,label=v) for k,v in DIMENSIONS],platforms=platforms)


def make_platform(pid, tool, core, focus, focus_baseline=None):
    fields = {k:unknown() for k,_ in DIMENSIONS}
    all_sources = []
    aliases = []
    if tool:
        ts = sources_of([dict(label=tool['name']+'：目录来源',url=tool['url'])])
        all_sources += ts
        td = date_of(tool.get('updated','')+' '+tool.get('notes',''))
        def catalog_field(key,text):
            fields[key] = declaration(text,ts,'目录资料',td)
        catalog_field('position', '目录用途：'+tool['scenarios'] if tool.get('scenarios') else None)
        catalog_field('materials',tool.get('materials'))
        catalog_field('capabilities','目录功能描述：'+tool['functions'] if tool.get('functions') else None)
        catalog_field('limits',tool.get('notes'))
        aliases += [tool['name']]
    if core:
        cs = sources_of(core.get('sources',[]))
        all_sources += cs
        cd = date_of(core.get('evidence',''))
        def core_field(key,text):
            fields[key] = declaration(text,cs,'核心档案整理',cd)
        for key in ('position','materials','capabilities','limits'):
            core_field(key,core.get(key))
        # Only explicit format-bearing upload/import/export statements establish IO.
        explicit_input = [step for step in core.get('workflow',[])
                          if re.search(r'导入|上传',step) and re.search(r'CSV|Excel|JSON|PDF|XML|UTF-8',step,re.I)]
        explicit_output = [step for step in core.get('workflow',[])
                           if '导出' in step and re.search(r'CSV|Excel|JSON|PDF|XML|TEI|TXT|HTML|DOCX|BibTeX|RIS',step,re.I)]
        core_field('input',explicit_input)
        core_field('output',explicit_output)
        core_field('conditions','；'.join(filter(None,[core.get('deployment'),core.get('openness')])))
        core_field('review',core.get('evidence'))
        # Connections are suggested research workflows, never guaranteed integration.
        core_field('collaboration', '研究衔接建议（不代表已验证直连）：'+core['connections'] if core.get('connections') else None)
        aliases += [core['name']]
    tasks = []
    if focus:
        fs = sources_of(focus['sources'])
        all_sources += fs
        fd = date_of(focus.get('checkedAt',''))
        task_date = fd or focus_baseline
        for key,value in [('position','goal'),('materials','materials'),('input','materials'),('conditions','permission'),('review','check'),('output','output'),('collaboration','handoff')]:
            fields[key] = declaration(focus.get(value),fs,
                                      '研究方法建议' if value in ('check','handoff') else '专题资料整理',fd)
        for task in focus['tasks']:
            # Keep the original source index and all original task statements.
            resolved = sources_of([focus['sources'][task['source']]])
            tasks.append(dict(task,sources=resolved,checkedAt=task_date))
        aliases += [focus['name']]
    all_sources = sources_of(all_sources)
    if all_sources:
        fields['sources'] = declaration('；'.join(s['label'] for s in all_sources),all_sources,'资料索引',None)
    name = core['name'] if core else tool['name']
    # Stable human-search aliases without conflating the two separate tools.
    extras = {'wuyudian':['吾与点','Wuyudian'],'shidian':['识典','Shidian'],
              'nju-digital':['南大平台','南京大学平台'],'docusky':['DocuSky','数位人文学术研究平台'],
              'dedu':['DEDU','对读'],'texta':['Texta','数字文献学'],
              'yunsiku':['云四库','Yun Si Ku'],'zotero':['Zotero','佐特罗']}
    aliases += extras.get(pid,[])
    if core:
        aliases.append(pid)
    aliases = list(dict.fromkeys([name]+aliases))
    return dict(id=pid,name=name,aliases=aliases,kind=kind_of(tool) if tool else '处理工具',
                materials=core.get('materials',[]) if core else tool.get('materials',[]),
                stages=core.get('stages',[]) if core else tool.get('stages',[]),
                officialDomains=sorted({urlsplit(s['url']).hostname for s in all_sources}),
                fields=fields,tasks=tasks,profileId=core['id'] if core else None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).resolve().parents[1]
    parser.add_argument('--source',type=Path,default=root/'index.html')
    parser.add_argument('--output',type=Path,default=root/'data/platforms.json')
    args=parser.parse_args()
    result=build(args.source)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"Wrote {len(result['platforms'])} comparison objects to {args.output}")

if __name__ == '__main__':
    main()
