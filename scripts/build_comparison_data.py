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

DIMENSIONS = [
    ('role', '平台的主要用途', '网站角色'),
    ('resource_types', '提供的材料类型', '材料资源'),
    ('resource_scope', '材料的覆盖范围', '材料资源'),
    ('resource_forms', '材料的呈现形式', '材料资源'),
    ('resource_search', '材料的检索与阅读方式', '材料资源'),
    ('resource_access', '材料的获取方式与使用权限', '材料资源'),
    ('input_materials', '支持处理的自有材料', '处理工具'),
    ('tools', '提供的处理工具与功能', '处理工具'),
    ('preparation', '使用前的材料准备要求', '处理工具'),
    ('workflow', '材料处理的操作流程', '处理工具'),
    ('output', '处理成果与导出方式', '处理工具'),
    ('conditions', '平台的使用条件', '共同条件'),
    ('evidence', '功能依据与使用限制', '共同条件'),
]

# Explicit editorial extraction from catalog functions + scenarios + notes.
# The catalog's materials/layer/region/language fields are NEVER used to prove
# holdings, coverage, resource formats, upload formats or interface languages.
# Each tuple is types, scope, forms, search, access. None means no declaration.
CATALOG_RESOURCES = {
    34: ('抗战史文献', '抗战史专题；具体数据库口径待核', None,
         '抗战史文献检索与 AI 调用；引文须另核', '公开访问方式可能受限；版权与使用口径需核查'),
    35: ('民间账簿、商业票据、契约', '社会经济史专题；具体馆藏来源待核', None,
         '民间账簿、商业票据、契约检索与数据服务', '付费使用；影像版权与著录标准需逐项确认'),
    37: ('数字技术、AI、人文项目、软件、活动与资源导航', None,
         '社区与资源导航；不是单一处理软件', '通过导航发现工具与人文项目；外链质量需自行判断', None),
    40: ('四库类知识查询线索', '四库类知识；服务范围可能变化',
         '智能问答结果；须回查原书影像与版本', '知识检索与智能问答', '小程序入口需复核；不据此承诺原书全文获取'),
    41: ('历史汇率查询数据', '1953 年以来多国货币历史汇率', None,
         '历史汇率查询与换算', None),
    42: ('图书馆书目与馆藏线索', '跨全球图书馆目录；具体成员目录待核',
         '来自异构目录的联合搜索结果', '联合元搜索；去重与版本辨析需人工完成', None),
    43: ('多个网页存档中的历史网页版本', '存档覆盖不完整', '存档网页的历史版本',
         '聚合检索并按时间访问历史版本', '服务与聚合节点状态需逐次核验；遵守 robots 与隐私规范'),
    44: ('图书馆书目与馆藏线索', '面向全球馆藏；实际覆盖范围待确认',
         '联合书目检索结果；官网待复核', '联合书目检索；馆藏实时状态待核', None),
    45: ('瑞士专题地图与历史地图的检索线索', '瑞士专题地图与历史地图',
         '地图联合搜索结果；数字化形式依馆藏', '地图联合搜索；地名需处理多语形式',
         '版权与下载分辨率因馆藏而异'),
    46: ('图书馆与档案馆的馆藏目录线索', '瑞士图书馆与档案馆的历史及现代馆藏',
         '多机构元数据；著录粒度与数字化可用性不一', '馆藏检索与定位', None),
    47: ('历史货币换算参照', '1600—2025 年瑞士法郎及近代早期货币价值', None,
         '按不同指标换算历史货币价值；不能给出唯一现代价值', None),
    48: ('历史手稿转录及元数据', '具体共享项目的覆盖范围待核', '转录及元数据',
         '访问共享的历史手稿转录', '转录规范与版权由项目决定'),
    49: ('汉籍、Kanripo、CText、CBETA与权威档的整合资源',
         '整合上述来源；不同来源许可与文本版本不同', '数字文本与权威档',
         '检索、分析和可视化；分析须记录语料范围', '许可按不同来源核对'),
    51: ('馆藏明人文集数字文本', '特定馆藏的明人文集，不推定覆盖全部古籍',
         '数字文本', '古籍全文检索与分析', '授权及文本质量按平台说明核对'),
    52: ('引得、古籍文本及人物地名资料', '具体数据来源与范围待核；入口需复核',
         '引得与古籍文本', None, '机构版功能与授权可能不同；引用时核对来源'),
    99: ('古籍全文与版本影像', '先秦两汉及传统文献；具体语料与版本需逐项核对',
         '全文、版本影像与引文链接', '字词检索与引文链接', 'API 与再利用须遵守许可；文本来源与校勘状态不一'),
    100: ('历史人物、官职、亲属、交游、地点等资料',
          '中国历代人物传记资料；具体朝代、地区与记录覆盖范围待核', '结构化数据',
          '用于人物身份、官职、亲属及交游核查；具体检索界面与筛选方式待核',
          '目录说明提供数据下载；须回查出处，同名须消歧'),
    101: ('历史行政区、地名、坐标和 GIS 数据', '中国历史地理；具体时点与层级依数据版本',
          '地名、坐标与 GIS 数据', None, None),
    102: ('历史地名及其时空范围、关联资料', '跨区域历史地名；具体数据集范围待核',
          '历史地名数据集', '可用于地名消歧；具体检索方式待核', None),
    103: ('随时间变化的历史地图与要素', '众包历史地图；具体城市、道路、行政区覆盖待核',
          '地图与要素', None, None),
    111: ('数字书库的文本分析数据服务', '大规模数字书库；具体可用语料依准入与版权',
          '非消费性文本分析服务；不等于取得全文', '词频、主题和语料研究工具',
          '受版权限制，许多文本只能非消费性分析；研究环境有准入要求'),
    118: ('多个来源的科学通信数据及转录', '十九世纪科学通信；记录完整度按集合核验',
          '通信数据及转录', '跨集合检索，关联书信、人物与通信语境', '权利按集合核验'),
    119: ('早期近代通信目录', '早期近代通信；具体集合范围待核',
          '通信元数据与基本描述；目录记录不等于全文', '按人物、时间和地点联合检索书信', None),
}
RESOURCE_KEYS = ('resource_types', 'resource_scope', 'resource_forms',
                 'resource_search', 'resource_access')
# These records explicitly describe both supplied resources and operations upon
# them. All others in CATALOG_RESOURCES are resource/navigation providers only.
CATALOG_BOTH = {34, 41, 47, 48, 49, 51, 102, 103, 111}

# Explicit catalog declarations selected from the original functions/notes.
# Whole notes remain in evidence; only relevant clauses appear as conditions.
CATALOG_INPUT = {
    1: '目录说明涉及在线上传；具体材料类型与格式待核；版权与隐私须先评估。',
    8: '表格数据导入；具体格式待核。',
    33: '目录说明涉及上传图像；须有授权，具体格式待核。',
    87: 'IIIF manifest；质量须先检查。',
    106: '学术 PDF；扫描 PDF 需先 OCR，不据此推定适用古籍。',
}
CATALOG_CONDITIONS = {
    2: '需命令行和参数调优。', 4: '部署与语料索引需要技术支持；须处理授权和用户权限。',
    6: '商业云服务；免费账户能力有限。', 7: '依赖在线底图与外部媒体。',
    14: '工作簿和数据默认公开；敏感或未授权数据不宜上传。',
    15: '免费方案公开发布。', 20: '服务条件与模型范围需向官网确认。',
    21: '商业服务与 API 计费。', 23: '闭源付费。',
    26: '商业云服务；免费额度与接口有限。',
    34: '公开访问方式可能受限。', 35: '付费使用。',
    52: '机构版功能与授权可能不同。', 54: '注册与数据上传政策需确认。',
    55: '平台服务条款、项目私密性与导出能力需先测试。',
    56: '商业平台；价格、授权、数据导出和项目保存需合同明确。',
    58: '开放范围可能受限。', 59: '合作馆藏的开放级别不同；下载、再利用须看授权。',
    60: '商业平台；数据权属需约定。', 66: '需要编程与算力。',
    67: '研究型代码；环境配置和模型泛化能力需测试。',
    68: '依赖 VS Code 与扩展生态；先确认数据格式和版本兼容。',
    71: '命令行工具；训练与评估需要专业知识。',
    72: '项目仓库已标注 maintenance mode；新项目需评估后续维护。',
    73: '偏工程化，部署复杂；组件版本与 METS/ALTO 兼容需管理。',
    77: '部署依赖宿主平台；版本兼容和反垃圾机制需测试。',
    81: '高级协作能力可能属商业版。',
    83: '现代系统兼容和维护状态需先测试。',
    87: '复杂定制需要前端开发。', 88: '注释、IIIF 和权限需其他组件。',
    91: '实施需迁移、权限、插件和运维规划。',
    97: '托管与高级功能方案需确认。',
    108: '技术栈复杂；需要专业运维、迁移与长期升级预算。',
    111: '受版权限制，许多文本只能非消费性分析；研究环境有准入要求。',
    112: '商业付费且格式锁定风险。', 113: '商业付费；关注云端隐私。',
    114: '商业付费。', 115: '商业许可。', 117: '商业软件。',
}
CATALOG_PREPARATION = {
    3: '不同编码与中文分词需预处理。',
    10: '人文数据需自行设计节点与边语义。',
    11: '项目必须先定制 schema 与标注规范；TEI 是标准，不是开箱即用软件。',
    24: '需自行做版面分析、图像预处理和质量评估；古籍模型需定制。',
    26: '复杂数据应提前建模。',
    62: '新词、古语、专名与异体字影响分词；需领域词表。',
    74: '需训练数据；这是模型层工具。', 81: '先设计数据与标签模式。',
    85: '先转录与编码；需遵守 EVT 支持的 TEI 子集。',
    87: '需优质 IIIF manifest。',
    95: '录音授权、隐私和敏感段落访问控制必须先处理。',
    97: '先设计本体与出处字段。',
    106: '扫描 PDF 需先 OCR。',
    107: '与社群共同制定访问、描述和权属规则。',
    110: '设计金标准、重复标注与志愿者伦理；材料须脱敏。',
    114: '团队需统一代码本并管理版本。',
}
CATALOG_OUTPUT_FUNCTIONS = {16, 20, 82, 106}

# Directly selected core workflow statements about users' material. Indices are
# tied to the preserved embedded core records, not inferred from broad tags.
CORE_INPUT_STEPS = {
    'zotero': [0], 'tropy': [0], 'transkribus': [0], 'openrefine': [0],
    'inception': [0], 'heurist': [1], 'qgis': [0, 2], 'gephi': [0, 1],
    'omeka-s': [1], 'archivematica': [0], 'yunsiku': [0],
    'escriptorium': [0], 'recogito': [0], 'catma': [0],
    'tei-publisher': [1, 2], 'fromthepage': [0], 'webrecorder': [1],
    'elan': [0], 'atom': [1], 'mirador': [0, 1], 'texta': [0, 1],
}
# Preparatory steps are editorial research advice, not automatic platform steps.
CORE_PREPARATION_STEPS = {
    'heurist': [0], 'qgis': [0], 'gephi': [0], 'omeka-s': [0],
    'tei-publisher': [0, 1, 2], 'webrecorder': [0], 'elan': [0, 1],
    'mirador': [0], 'texta': [0],
}
# Only explicit statements of produced/exported objects are selected. No export
# format is inferred from a platform name, technology, or generic handoff.
CORE_OUTPUT_STEPS = {
    'zotero': [4], 'tropy': [4], 'transkribus': [5], 'openrefine': [4],
    'inception': [5], 'heurist': [4], 'qgis': [4], 'gephi': [5],
    'omeka-s': [4], 'archivematica': [4], 'yunsiku': [5],
    'escriptorium': [5], 'recogito': [5], 'tei-publisher': [5],
    'fromthepage': [5], 'webrecorder': [3], 'elan': [5], 'atom': [5],
    'mirador': [5], 'texta': [3],
}


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
    # Source sentences can already end in a full stop before a joined separator.
    text = re.sub(r'。\s*；', '；', text)
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
    return dict(version=2,updated=max(dates) if dates else None,
                dimensions=[dict(key=k,label=v,group=g) for k,v,g in DIMENSIONS],platforms=platforms)


def workflow_steps(core, mapping):
    return [core['workflow'][i] for i in mapping.get(core['id'], [])]


def focus_tasks(focus, indices):
    """Resolve sources only from the original tasks used for this declaration."""
    tasks = [focus['tasks'][i] for i in indices]
    sources = sources_of([focus['sources'][task['source']] for task in tasks])
    return tasks, sources


def apply_focus(fields, focus, baseline):
    """Separate supplied resources from users' input using explicit topic text."""
    pid = focus['id']
    fs = sources_of(focus['sources'])
    fd = date_of(focus.get('checkedAt', ''))

    def overview(key, text, evidence='专题资料整理', sources=None):
        fields[key] = declaration(text, fs if sources is None else sources, evidence, fd)

    def task_notes(key, indices):
        tasks, sources = focus_tasks(focus, indices)
        labels = list(dict.fromkeys(task['evidence'] for task in tasks))
        overview(key, '；'.join(task['note'] for task in tasks), '；'.join(labels), sources)
        # Exact task-derived declarations retain the explicitly dated topic baseline.
        fields[key]['checkedAt'] = fd or baseline

    if pid == 'shidian':
        overview('role', '材料资源与处理工具：公开古籍阅读与项目整理分别进行。' + focus['goal'])
        overview('resource_types', '平台古籍正文与书影。')
        overview('resource_forms', '古籍正文与书影；阅读可图文对照。')
        task_notes('resource_search', [0, 3, 4, 5])
        overview('resource_access', focus['permission'] + '批量全文与影像的获取条件须按项目核对。')
        task_notes('input_materials', [1])
        tool_indices = [2, 6, 7, 8, 9, 10]
    elif pid == 'nju-digital':
        overview('role', '材料资源与处理工具：近代红色资源与平台整体文献处理能力；个人上传与期刊模块权限尚未确认。')
        overview('resource_types', focus['materials'], sources=sources_of([focus['sources'][0]]))
        overview('resource_scope', focus['materials'], sources=sources_of([focus['sources'][0]]))
        task_notes('resource_search', [3, 4, 5])
        overview('resource_access', focus['permission'] + '全文、书目、影像的获取方式与批量下载条件均待核。')
        task_notes('input_materials', [1])
        tool_indices = [2, 6, 7, 8, 9, 10]
    elif pid == 'docusky':
        overview('role', '处理工具为主，另有公开研究实例：' + focus['goal'])
        task_notes('resource_types', [0])
        overview('resource_scope', '公开研究实例不等同于综合史料库；核心仍是个人材料组织。',
                 sources=sources_of([focus['sources'][0]]))
        overview('input_materials', focus['materials'], sources=sources_of([focus['sources'][1], focus['sources'][2]]))
        tool_indices = [2, 3, 4, 6, 7, 8, 9, 10]
    elif pid == 'wuyudian':
        overview('role', '处理工具为主，另有数据社区共享：' + focus['goal'])
        task_notes('resource_types', [0])
        overview('resource_scope', '数据社区共享不等同于综合古籍文库；具体可用数据集范围待核。',
                 sources=sources_of([focus['sources'][1]]))
        overview('input_materials', focus['materials'], sources=sources_of([focus['sources'][0]]))
        tool_indices = [2, 3, 4, 6, 7, 8, 9, 10]
    else:  # DEDU
        overview('role', '处理工具为主，提供公开对读成果阅读：' + focus['goal'])
        task_notes('resource_types', [0])
        overview('resource_scope', '公开项目包括多语言佛典对读；这是对读成果样例，不等同于原始史料库或自动翻译。')
        overview('resource_forms', '公开对读项目；表格式文本对应与树状结构导航。')
        task_notes('resource_search', [0, 3, 4])
        overview('resource_access', '可浏览公开对读项目；编辑与分享依项目权限。',
                 sources=sources_of([focus['sources'][1], focus['sources'][2]]))
        task_notes('input_materials', [1])
        tool_indices = [2, 6, 7, 8, 9, 10]

    task_notes('tools', tool_indices)
    steps = focus['steps']
    rendered = [f"{i + 1}. 输入：{step[0]} → 操作：{step[1]} → 输出：{step[2]}"
                for i, step in enumerate(steps)]
    overview('workflow', '研究流程建议（含人工核查，不代表自动完成）：\n' + '\n'.join(rendered), '研究方法建议')
    prep = [f"材料：{steps[0][0]}；准备：{steps[0][1]}"]
    if pid == 'shidian':
        prep = ['准备有权整理的图像／粗校文本，先核对底本与校订状态；上传条件依项目权限。']
    elif pid == 'nju-digital':
        prep = ['个人材料上传准入尚未确认；研究前先核实资源目录、时间范围和可访问范围。']
    if pid in ('docusky', 'wuyudian'):
        prep.append(f"材料：{steps[1][0]}；准备：{steps[1][1]}")
    overview('preparation', '研究者准备建议：' + '；'.join(prep), '研究方法建议')
    overview('output', focus['output'])
    overview('conditions', focus['permission'])
    # Explicitly label method suggestions within the common evidence cell; they
    # are not promoted to official feature declarations by the combined field.
    prior = fields['evidence']
    overview('evidence', '\n'.join(filter(None, [
        prior['text'] if prior['text'] != '资料待补充' else '',
        '研究方法建议·人工检查：' + focus['check'],
        '研究方法建议·下一步衔接：' + focus['handoff'],
        '资料依据：' + '；'.join(s['label'] for s in fs),
    ])), '资料整理；研究方法建议', sources_of(prior['sources'] + fs))
    return [dict(task, sources=sources_of([focus['sources'][task['source']]]),
                 checkedAt=fd or baseline) for task in focus['tasks']]


def make_platform(pid, tool, core, focus, focus_baseline=None):
    fields = {key: unknown() for key, _, _ in DIMENSIONS}
    all_sources = []
    aliases = []
    role_label = '处理工具'
    if tool:
        ts = sources_of([dict(label=tool['name'] + '：目录来源', url=tool['url'])])
        all_sources += ts
        td = date_of(tool.get('updated', '') + ' ' + tool.get('notes', ''))

        def catalog_field(key, text):
            fields[key] = declaration(text, ts, '目录资料', td)

        resource = CATALOG_RESOURCES.get(tool['id'])
        if resource:
            for key, text in zip(RESOURCE_KEYS, resource):
                catalog_field(key, text)
            role_label = '材料资源与处理工具' if tool['id'] in CATALOG_BOTH else '材料资源'
        elif not ts:
            role_label = '角色待核实'
        catalog_field('role', role_label + '。目录功能描述：' + tool['functions'] +
                      '；目录应用场景：' + tool['scenarios'])
        catalog_field('tools', '目录功能描述：' + tool['functions'])
        # Only an explicit import declaration proves users' input in catalog-only
        # records. Nothing is guessed from the materials tags or OCR capability.
        catalog_field('input_materials', CATALOG_INPUT.get(tool['id']))
        catalog_field('conditions', CATALOG_CONDITIONS.get(tool['id']))
        fields['preparation'] = declaration(CATALOG_PREPARATION.get(tool['id']), ts, '研究方法建议', td)
        if tool['id'] in CATALOG_OUTPUT_FUNCTIONS:
            catalog_field('output', '目录功能说明：' + tool['functions'])
        catalog_field('evidence', '\n'.join(filter(None, [
            '目录功能描述：' + tool.get('functions', ''),
            '目录应用场景：' + tool.get('scenarios', ''),
            '目录核实状态：' + tool.get('verification', ''),
            '使用限制：' + tool.get('notes', ''),
            '资料状态：' + tool.get('updated', ''),
        ])))
        aliases += [tool['name']]
    if core:
        cs = sources_of(core.get('sources', []))
        all_sources += cs
        cd = date_of(core.get('evidence', ''))

        def core_field(key, text, evidence='核心档案整理'):
            fields[key] = declaration(text, cs, evidence, cd)

        core_field('role', '处理工具：' + core['position'])
        core_field('tools', core.get('capabilities'))
        core_field('input_materials', workflow_steps(core, CORE_INPUT_STEPS))
        core_field('preparation', workflow_steps(core, CORE_PREPARATION_STEPS), '研究方法建议')
        core_field('workflow', '研究流程建议（含人工处理与核查）：\n' +
                   '\n'.join(f"{i+1}. {step}" for i, step in enumerate(core['workflow'])), '研究方法建议')
        output = workflow_steps(core, CORE_OUTPUT_STEPS)
        if pid == 'texta':
            output += [core['capabilities'][0]]  # Explicit TXT/HTML/DOCX declaration.
        core_field('output', output)
        core_field('conditions', '；'.join(filter(None, [core.get('deployment'), core.get('openness')])))
        previous = fields['evidence']
        core_field('evidence', '\n'.join(filter(None, [
            previous['text'] if previous['text'] != '资料待补充' else '',
            '核心档案限制：' + '；'.join(core.get('limits', [])),
            '研究方法建议·核查：' + core.get('evidence', ''),
            '研究方法建议·衔接（不代表已验证直连）：' + core.get('connections', ''),
            '资料依据：' + '；'.join(s['label'] for s in cs),
        ])), '核心档案整理；研究方法建议')
        fields['evidence']['sources'] = sources_of(previous['sources'] + cs)
        # The date belongs to the core archive text, not all catalog declarations.
        if pid == 'texta':
            # The source names database/read entrances, not supplied material types.
            role_label = '材料资源与处理工具'
            core_field('role', role_label + '：' + core['position'])
        aliases += [core['name']]
    tasks = []
    if focus:
        tasks = apply_focus(fields, focus, focus_baseline)
        all_sources += sources_of(focus['sources'])
        aliases += [focus['name']]
        role_label = '材料资源与处理工具' if pid in ('shidian', 'nju-digital') else '处理工具'
    all_sources = sources_of(all_sources)
    name = core['name'] if core else tool['name']
    extras = {'wuyudian': ['吾与点', 'Wuyudian'], 'shidian': ['识典', 'Shidian'],
              'nju-digital': ['南大平台', '南京大学平台'], 'docusky': ['DocuSky', '数位人文学术研究平台'],
              'dedu': ['DEDU', '对读'], 'texta': ['Texta', '数字文献学'],
              'yunsiku': ['云四库', 'Yun Si Ku'], 'zotero': ['Zotero', '佐特罗']}
    aliases += extras.get(pid, [])
    if core:
        aliases.append(pid)
    aliases = list(dict.fromkeys([name] + aliases))
    # Additional objects have explicit entry points rather than a catalog row.
    entry = tool.get('url', '') if tool else {
        'yunsiku': 'https://aiysk.net/',
        'dedu': 'https://dedu.dila.edu.tw/home/',
        'texta': 'https://texta.studio/',
    }.get(pid, '')
    website = sources_of([dict(label=name, url=entry)])
    return dict(id=pid, name=name, website=website[0]['url'] if website else None, aliases=aliases, kind=kind_of(tool) if tool else '处理工具',
                roleLabel=role_label,
                materials=core.get('materials', []) if core else tool.get('materials', []),
                stages=core.get('stages', []) if core else tool.get('stages', []),
                officialDomains=sorted({urlsplit(s['url']).hostname for s in all_sources}),
                fields=fields, tasks=tasks, profileId=core['id'] if core else None)


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
