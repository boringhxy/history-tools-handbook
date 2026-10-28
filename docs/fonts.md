# 网站字体

2026-10-28 起，正文和控件统一使用 Noto Sans SC，标题及原衬线文字统一使用 Noto Serif SC。两者均采用 SIL Open Font License 1.1，允许免费商用和网页嵌入。

字体来自 Google Fonts 官方版本，原始 WOFF2 分片未修改。`assets/fonts/fonts.css` 保留官方的字重范围、Unicode 分片与 `font-display: swap`；浏览器仅加载当前文字需要的分片。字体与网站同源托管，访客不需要连接 Google Fonts 或预先安装字体。

## 许可证与来源

- 正文：`assets/fonts/notosanssc-OFL.txt`
- 标题：`assets/fonts/notoserifsc-OFL.txt`
- 来源网址及文件 SHA-256：`assets/fonts/sources.json`
- 官方项目：<https://github.com/google/fonts/tree/main/ofl/notosanssc>、<https://github.com/google/fonts/tree/main/ofl/notoserifsc>

再分发网站时须保留字体版权及许可证。字体不得单独出售；修改版本还须遵守 OFL 的保留字体名称等条款。使用这些字体不要求网站正文或代码采用 OFL。

## 发布与离线使用

发布、下载或离线复制时，须同时保留 `index.html` 和完整的 `assets/fonts/` 目录，目录相对位置保持不变。不要仅保存 HTML 后宣称开源字体已包含其中。首次在线访问并不保证浏览器已缓存全部分片，完整离线使用请下载整个目录。

页面不再显式指定微软雅黑、苹方、宋体或 Georgia 等专有字体。加载期间、字体请求失败或遇到字体未收录的字符时，浏览器仍可能使用通用后备字体显示文字；后备字体由访客系统决定。
