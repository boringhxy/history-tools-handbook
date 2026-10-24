import importlib.util
import json
from collections import Counter
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('comparison_builder', ROOT / 'scripts/build_comparison_data.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

EXPECTED_DIMENSIONS = [
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


class ComparisonDataTests(unittest.TestCase):
    def setUp(self):
        self.data = builder.build(ROOT / 'index.html')
        self.items = {p['id']: p for p in self.data['platforms']}

    def field(self, pid, key):
        return self.items[pid]['fields'][key]

    def test_v2_contract_dimension_order_and_groups(self):
        self.assertEqual(self.data['version'], 2)
        self.assertEqual(self.data['dimensions'], [dict(key=k, label=l, group=g) for k, l, g in EXPECTED_DIMENSIONS])
        self.assertEqual(Counter(d['group'] for d in self.data['dimensions']),
                         {'网站角色': 1, '材料资源': 5, '处理工具': 5, '共同条件': 2})

    def test_count_unique_and_stable_ids(self):
        self.assertEqual(len(self.items), 122)
        self.assertEqual(len(self.data['platforms']), 122)
        for key in ['shidian', 'docusky', 'markus', 'comparativus', 'yunsiku', 'dedu', 'texta', 'tool-1']:
            self.assertIn(key, self.items)
        self.assertEqual(self.items['wuyudian']['aliases'], ['吾与点智能数据平台', '「吾与点」智能数据平台', '吾与点', 'Wuyudian', 'wuyudian'])
        self.assertEqual(self.data['updated'], '2026-10-21')

    def test_fields_and_safe_provenance(self):
        keys = {d['key'] for d in self.data['dimensions']}
        self.assertEqual(len(keys), 13)
        for p in self.items.values():
            self.assertEqual(set(p['fields']), keys)
            self.assertEqual(len(p['aliases']), len(set(p['aliases'])))
            for f in p['fields'].values():
                self.assertEqual(set(f), {'text', 'evidence', 'checkedAt', 'sources'})
                if f['text'] == '资料待补充':
                    self.assertEqual(f, builder.unknown())
                urls = [s['url'] for s in f['sources']]
                self.assertEqual(len(urls), len(set(urls)))
                for source in f['sources']:
                    self.assertRegex(source['url'], r'^https?://')
        self.assertIsNone(self.field('zotero', 'role')['checkedAt'])
        self.assertEqual(self.field('texta', 'tools')['checkedAt'], '2026-10-21')

    def test_processing_materials_do_not_become_platform_resources(self):
        for pid in ['tool-1', 'tool-3', 'tool-4', 'tool-6', 'tool-7', 'tool-97', 'zotero', 'tropy', 'transkribus', 'qgis']:
            for key in ['resource_types', 'resource_scope', 'resource_forms', 'resource_search', 'resource_access']:
                self.assertEqual(self.field(pid, key), builder.unknown(), (pid, key))
        self.assertIn('处理工具', self.field('zotero', 'role')['text'])
        self.assertIn('导入档案照片', self.field('tropy', 'input_materials')['text'])
        self.assertIn('图像或 PDF', self.field('transkribus', 'input_materials')['text'])
        self.assertIn('在线上传', self.field('tool-1', 'input_materials')['text'])
        self.assertIn('具体材料类型与格式待核', self.field('tool-1', 'input_materials')['text'])

    def test_resource_database_has_scoped_resource_provenance(self):
        for key in ['resource_types', 'resource_scope', 'resource_forms', 'resource_search', 'resource_access']:
            cell = self.field('tool-100', key)
            self.assertNotEqual(cell, builder.unknown())
            self.assertTrue(cell['sources'])
            self.assertEqual(cell['evidence'], '目录资料')
        self.assertIn('历史人物', self.field('tool-100', 'resource_types')['text'])
        self.assertIn('下载', self.field('tool-100', 'resource_access')['text'])
        self.assertEqual(self.field('tool-100', 'input_materials'), builder.unknown())
        self.assertIn('材料资源', self.field('tool-100', 'role')['text'])
        self.assertIn('目录应用场景', self.field('tool-100', 'evidence')['text'])

    def test_focus_resources_are_distinct_from_upload_and_coverage(self):
        self.assertIn('材料资源与处理工具', self.field('shidian', 'role')['text'])
        self.assertIn('平台古籍正文', self.field('shidian', 'resource_types')['text'])
        self.assertIn('书影', self.field('shidian', 'resource_forms')['text'])
        self.assertIn('分类', self.field('shidian', 'resource_search')['text'])
        self.assertIn('权限', self.field('shidian', 'input_materials')['text'])
        self.assertNotIn('平台古籍正文', self.field('shidian', 'input_materials')['text'])
        self.assertIn('个人上传', self.field('nju-digital', 'input_materials')['text'])
        self.assertEqual(self.field('nju-digital', 'input_materials')['evidence'], '公开证据不足')
        self.assertIn('不能据此推定覆盖全部近代期刊', self.field('nju-digital', 'resource_scope')['text'])
        self.assertIn('公开研究实例', self.field('docusky', 'resource_types')['text'])
        self.assertIn('不等同于综合史料库', self.field('docusky', 'resource_scope')['text'])
        self.assertIn('DocuXML', self.field('docusky', 'input_materials')['text'])
        self.assertIn('公开对读项目', self.field('dedu', 'resource_types')['text'])
        self.assertIn('原始史料库', self.field('dedu', 'resource_scope')['text'])
        self.assertEqual(self.field('docusky', 'resource_access'), builder.unknown())
        self.assertEqual(self.field('wuyudian', 'resource_access'), builder.unknown())
        self.assertEqual(self.field('texta', 'resource_types'), builder.unknown())
        self.assertEqual(self.field('shidian', 'resource_search')['checkedAt'], '2026-10-19')

    def test_manual_workflow_and_preparation_are_not_automatic_claims(self):
        workflow = self.field('docusky', 'workflow')
        self.assertIn('输入：文本与来源表', workflow['text'])
        self.assertIn('输出：一致的文献及元数据结构', workflow['text'])
        self.assertIn('研究方法建议', workflow['evidence'])
        self.assertIn('明确每篇文献的标识', self.field('docusky', 'preparation')['text'])
        self.assertIn('人工', self.field('wuyudian', 'workflow')['text'])
        self.assertIn('逐条核对同名人物', self.field('wuyudian', 'evidence')['text'])
        self.assertIn('研究方法建议', self.field('wuyudian', 'evidence')['text'])
        for pid in ['shidian', 'nju-digital', 'docusky', 'wuyudian', 'dedu']:
            for key in ['workflow', 'preparation', 'conditions', 'output']:
                self.assertIsNone(self.field(pid, key)['checkedAt'])

    def test_explicit_catalog_conditions_and_preparation_survive_remapping(self):
        self.assertIn('付费使用', self.field('tool-35', 'conditions')['text'])
        self.assertIn('编码与中文分词需预处理', self.field('tool-3', 'preparation')['text'])
        self.assertIn('SVG/PNG', self.field('tool-16', 'output')['text'])
        self.assertIn('有权整理的图像', self.field('shidian', 'preparation')['text'])
        self.assertNotIn('分类、时代与关键词检索', self.field('shidian', 'preparation')['text'])

    def test_separate_markus_capabilities(self):
        self.assertNotIn('自动标记', self.field('comparativus', 'tools')['text'])
        self.assertNotIn('比较多份文本', self.field('markus', 'tools')['text'])
        self.assertIsNone(self.items['comparativus']['profileId'])
        self.assertEqual(self.items['tool-118']['kind'], '机构方法案例')
        self.assertEqual(self.items['tool-100']['kind'], '史料数据库')

    def test_focus_tasks_preserved_exactly_with_resolved_sources_and_date(self):
        html = (ROOT / 'index.html').read_text()
        original = builder.extract(html, 'focus-platforms-data')
        self.assertEqual(sum(bool(p['tasks']) for p in self.items.values()), 5)
        for focus in original:
            tasks = self.items[focus['id']]['tasks']
            self.assertEqual(len(tasks), 12)
            for old, new in zip(focus['tasks'], tasks):
                for key, value in old.items():
                    self.assertEqual(new[key], value)
                self.assertEqual(new['sources'], builder.sources_of([focus['sources'][old['source']]]))
                self.assertEqual(new['checkedAt'], '2026-10-19')

    def test_build_is_deterministic_and_checked_in(self):
        self.assertEqual(self.data, builder.build(ROOT / 'index.html'))
        self.assertEqual(self.data, json.loads((ROOT / 'data/platforms.json').read_text()))


if __name__ == '__main__':
    unittest.main()
