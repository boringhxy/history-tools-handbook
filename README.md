# 数字人文研究工具指南

网站包含**首页**、**平台目录**与**平台对比**三个栏目。首页采用灰粉古籍纸卡封面，其他阅读材料已整理为本地Markdown文档，见[参考资料索引](docs/reference/README.md)。

## 网站栏目

- **首页**：古籍纸卡封面、渐显标题、栏目入口、收录数量与资料更新日期。
- **平台目录**：119项工具与资源，默认只显示深色检索框与“展开全部”按钮。输入关键词显示匹配项；按钮可展开全部119项或收起，收起时隐藏卡片、结果数及打印工具。
- **平台对比**：从122项对象中选择两个，按六个研究阶段查看13个维度；保留名称与别名搜索、交换、差异筛选、来源、复制报告、分享、打印和研究助手。

两个数量口径不同：比较资料在原119项目录外增加云四库、DEDU和Texta。MARKUS与COMPARATIVUS分别保留自己的能力。原文档中的27份核心档案、五平台专题、研究流程与史料方法均已归档，没有因精简界面而丢弃。

页面默认进入首页；旧矩阵与平台档案链接进入对比工作台，其他无效链接回到首页。

## 本地使用

直接在浏览器打开 `index.html`，目录和基础比较均可离线使用。复制网页时同时保留完整 `assets/` 目录，包含封面插画、字体及两套SIL OFL 1.1许可证。正文使用Noto Sans SC，标题使用Noto Serif SC，详见[字体说明](docs/fonts.md)。

网站默认不连接 API、不自动检查问答服务，也不提供共享密钥。对比页的“自行接入 AI”包含配置、计费和启动教程；访客可使用自己的模型账户，主动连接后才启用问答表单。基础比较和导出不调用模型。

需要研究助手时，先按页面教程配置环境变量，再从项目目录启动受控服务：

```sh
python3 -m server.app --port 8765
```

访问 http://127.0.0.1:8765 。问答需另外配置服务端模型、密钥、稳定签名密钥和预算；未配置时显示真实状态并禁用发送，目录与基础比较仍可用。配置、限额、隐私和部署边界见[问答服务说明](server/README.md)。

“打印筛选结果”保存当前匹配的全部目录条目，“打印全部目录”保存119项；对比页有自己的打印和完整报告入口。打印结束恢复筛选、分页与展开状态。

## 本地Markdown资料

[docs/reference/](docs/reference/README.md) 包含首页与使用指南、27份核心档案、能力矩阵、五平台专题比较、研究流程、史料处理、方法与来源七份正文及索引。保留原有出处、核实日期、未知能力与示范流程的限制说明。资料迁移不代表进行了新一轮平台功能实测。

## 维护与构建

- `data/catalog.json`：119项目录的维护来源。
- `data/platforms.json`：122项比较对象及其13字段、证据、来源和核实日期的维护来源。
- `catalog.js`：目录筛选、分页、三栏目路由与目录打印。
- `comparison/`：对比界面、样式、引擎和问答交互源文件。
- `index.html`：三栏目页面与基础样式；构建会在标记区内嵌资料和交互代码，以保留离线结构。

修改资料或交互源文件后运行：

```sh
python3 scripts/build_comparison.py
python3 scripts/build_comparison.py --check
python3 -m unittest discover -s tests -v
node tests/test_navigation.cjs
node tests/test_comparison.cjs
```

浏览器验收需要在所用Python环境安装Playwright并安装Google Chrome；先启动本地服务，再运行：

```sh
python3 tests/test_site_browser.py --url http://127.0.0.1:8765 --screenshots /tmp/handbook-preview
```

该验收用浏览器测试夹具验证研究助手界面，不调用真实付费模型。

旧的七栏目页面和一次性资料迁移脚本不再作为当前运行代码保留，可通过Git历史追溯。来源更新须逐项核对，不以材料标签推定平台资源，不以普通导出推定批量导出，不把跨平台建议写成已验证直连。

## 发布与引用

正式网站：https://boringhxy.github.io/history-tools-handbook/ 。主分支包含三栏目精简、首页恢复及自行接入 API 教程。GitHub Pages支持目录与基础比较；公开研究助手仍需单独部署受控后端。

机器可读引用见[CITATION.cff](CITATION.cff)，变更记录见[CHANGELOG.md](CHANGELOG.md)。
