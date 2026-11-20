import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class SiteStructureTests(unittest.TestCase):
    def test_home_catalogue_and_comparison_are_runtime_pages(self):
        html = (ROOT/'index.html').read_text()
        self.assertEqual(re.findall(r'data-primary-page="([^"]+)"', html), ['home','catalog','comparison'])
        self.assertEqual(set(re.findall(r'class="chapter-page" data-page="([^"]+)"',html)), {'home','catalog','comparison'})
        for name in ['page-intro','page-workflows','page-reading','page-methods','comparison-legacy','profiles-grid','matrix-body','focus-search','flow-carousel']:
            self.assertNotIn('id="'+name+'"',html)
        for block in ['core-platforms-data','focus-platforms-data','material-reading-data']:
            self.assertNotIn('id="'+block+'"',html)

    def test_home_content_is_restored(self):
        html=(ROOT/'index.html').read_text()
        home=re.search(r'<div class="chapter-page" data-page="home".*?</header></div>',html,re.S)
        self.assertIsNotNone(home)
        for text in ['数字人文<br>研究工具指南','从手上的史料出发，找到合适的工具，了解具体的处理方法。','汇聚119个数字人文平台','最新更新：2026-11-20']:
            self.assertIn(text,home[0])

    def test_archived_content_has_complete_navigation(self):
        archive=ROOT/'docs/reference'
        names=['首页与使用指南.md','核心平台档案.md','核心平台能力矩阵.md','五平台专题比较.md','研究流程参考.md','史料处理参考.md','方法与来源.md']
        self.assertTrue((archive/'README.md').is_file())
        for name in names:
            path=archive/name
            self.assertTrue(path.is_file(),name)
            self.assertGreater(path.stat().st_size,200,name)
        if all((archive/name).exists() for name in names):
            profiles=(archive/'核心平台档案.md').read_text()
            self.assertEqual(len(re.findall(r'<a id="profile-[^"]+"',profiles)),27)
            materials=(archive/'史料处理参考.md').read_text()
            self.assertEqual(len(re.findall(r'<a id="reading-(?!example)[^"]+"',materials)),7)
            workflows=(archive/'研究流程参考.md').read_text()
            self.assertEqual(len(re.findall(r'<a id="(?:workflow-|case-)[^"]+"',workflows)),7)

    def test_catalogue_and_comparison_use_canonical_data(self):
        html=(ROOT/'index.html').read_text()
        for name,file,count in [('tool-catalog-data','catalog.json',119),('comparison-platforms-data','platforms.json',122)]:
            path=ROOT/'data'/file
            self.assertTrue(path.is_file(),file)
            if not path.is_file():continue
            canonical=json.loads(path.read_text())
            embedded=json.loads(re.search(r'id="'+name+r'"[^>]*>(.*?)</script>',html,re.S)[1])
            self.assertEqual(embedded,canonical)
            records=canonical if isinstance(canonical,list) else canonical['platforms']
            self.assertEqual(len(records),count)


if __name__=='__main__':
    unittest.main()
