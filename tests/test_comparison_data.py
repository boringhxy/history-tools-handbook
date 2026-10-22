import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('comparison_builder', ROOT / 'scripts/build_comparison_data.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class ComparisonDataTests(unittest.TestCase):
    def setUp(self):
        self.data = builder.build(ROOT / 'index.html')
        self.items = {p['id']: p for p in self.data['platforms']}

    def test_count_unique_and_stable_ids(self):
        self.assertEqual(len(self.items), 122)
        self.assertEqual(len(self.data['platforms']), 122)
        for key in ['shidian','docusky','markus','comparativus','yunsiku','dedu','texta','tool-1']:
            self.assertIn(key, self.items)

    def test_fields_and_safe_provenance(self):
        keys = {d['key'] for d in self.data['dimensions']}
        self.assertEqual(len(keys), 10)
        for p in self.items.values():
            self.assertEqual(set(p['fields']), keys)
            self.assertEqual(len(p['aliases']), len(set(p['aliases'])))
            for f in p['fields'].values():
                self.assertEqual(set(f), {'text','evidence','checkedAt','sources'})
                if f['text'] == '资料待补充':
                    self.assertEqual(f, builder.unknown())
                for source in f['sources']:
                    self.assertRegex(source['url'], r'^https?://')
        self.assertEqual(self.items['tool-1']['fields']['input'], builder.unknown())
        self.assertEqual(self.items['zotero']['fields']['input'], builder.unknown())
        self.assertEqual(self.items['zotero']['fields']['position']['checkedAt'], None)
        self.assertEqual(self.items['texta']['fields']['capabilities']['checkedAt'], '2026-10-21')

    def test_separate_markus_capabilities(self):
        self.assertNotIn('自动标记', self.items['comparativus']['fields']['capabilities']['text'])
        self.assertNotIn('比较多份文本', self.items['markus']['fields']['capabilities']['text'])
        self.assertIsNone(self.items['comparativus']['profileId'])
        self.assertEqual(self.items['tool-118']['kind'], '机构方法案例')
        self.assertEqual(self.items['tool-100']['kind'], '史料数据库')

    def test_focus_tasks_are_preserved_with_resolved_sources(self):
        focus = [p for p in self.items.values() if p['tasks']]
        self.assertEqual(len(focus), 5)
        for p in focus:
            self.assertEqual(len(p['tasks']), 12)
            for task in p['tasks']:
                self.assertTrue(task['sources'])
                self.assertIn('note', task)

    def test_focus_editorial_provenance_and_dates(self):
        for pid in ['shidian', 'nju-digital', 'docusky', 'wuyudian', 'dedu']:
            fields = self.items[pid]['fields']
            for key in ['review', 'collaboration']:
                self.assertEqual(fields[key]['evidence'], '研究方法建议')
                self.assertIsNone(fields[key]['checkedAt'])
            self.assertEqual(fields['position']['evidence'], '专题资料整理')
            self.assertIsNone(fields['position']['checkedAt'])
            for task in self.items[pid]['tasks']:
                self.assertEqual(task['checkedAt'], '2026-10-19')

    def test_build_is_deterministic_and_checked_in(self):
        self.assertEqual(self.data, builder.build(ROOT / 'index.html'))
        self.assertEqual(self.data, json.loads((ROOT / 'data/platforms.json').read_text()))

if __name__ == '__main__':
    unittest.main()
