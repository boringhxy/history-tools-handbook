# 上传与发布说明

## 一、创建仓库

1. 登录 GitHub，点击右上角 `+`，选择 `New repository`。
2. 仓库名填写 `history-tools-handbook`。
3. 可见性选择 `Public`。
4. 不勾选自动创建 README、`.gitignore` 或 License，然后创建仓库。

## 二、上传压缩包中的内容

先在本地解压本资料包。上传时应上传 `history-tools-handbook` 文件夹内的全部内容，而不是把 ZIP 文件本身上传到仓库。

需要保留以下文件和目录：

- `index.html`
- `README.md`
- `CITATION.cff`
- `UPLOAD_GUIDE.md`
- `.nojekyll`
- `.github/workflows/pages.yml`

如果使用 GitHub 网页上传，建议把解压后的整个文件夹拖入上传区域，以免遗漏以英文句点开头的隐藏文件。

## 三、启用 GitHub Pages

1. 打开仓库的 `Settings`。
2. 在左侧选择 `Pages`。
3. 在 `Build and deployment` 的 `Source` 中选择 `GitHub Actions`。
4. 返回 `Actions` 页面，等待 `Deploy static handbook to Pages` 工作流完成。

发布成功后，默认网址为：

`https://boringhxy.github.io/history-tools-handbook/`

以后修改 `index.html` 并提交到 `main` 分支，网站会自动重新发布。

## 四、上传前注意

- 本资料包不包含原始 Excel、开发脚本或本地 Git 历史。
- 若修改仓库名称，GitHub Pages 网址也会相应变化；请同步修改 `README.md` 和 `CITATION.cff` 中的网址。
- 如果 GitHub Actions 没有自动运行，可进入 `Actions`，选择工作流后点击 `Run workflow`。

