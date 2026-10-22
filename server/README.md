# 受控双平台问答服务

需要 Python 3.9+（系统须提供 Asia/Shanghai 时区）。从项目根目录运行：

```sh
python3 -m server.app --port 8765
```

访问 http://127.0.0.1:8765 。未配置时页面仍可用，问答返回真实的 503 状态。服务只发布 `/`、`/index.html`、`/api/status`、`/api/chat`，不会发布目录、JSON源资料、环境文件或 Python 源码。前端所需资料由 HTML 构建过程内嵌，服务端独立读取 `data/platforms.json`。

## 配置与部署

使用服务管理器导出 [配置示例](.env.example) 中变量。服务不会读取 `.env` 文件。必须同时提供 `OPENAI_API_KEY`、明确选择的 `OPENAI_MODEL`、至少32字符的稳定 `COOKIE_SECRET`、正数 `APP_DAILY_BUDGET_USD` 和 `REQUEST_MAX_COST_USD`。后者不得超过前者。配置无效时问答关闭，不猜测模型或价格。

`REQUEST_MAX_COST_USD` 是管理员按所选模型当前官方价格、最坏输入、最多1800输出token及最多一次搜索给出的保守上界，不是服务计算的实际账单。含推理和工具调用的费用应由管理员一并核算；更换模型、供应商或输入限制后重新核算。按百万分之一美元向上取整。每次请求先原子预留该上界，成功、失败、超时及结果不明都不退还，避免未知费用导致超支。它限制的是应用按管理员上界计算的预算，只有该上界足够保守时才构成真实费用上界；还应设置供应商账户预算。程序不使用虚构的token单价。

每个已签名匿名身份每天5次，默认每个IP每天20次、每分钟6次。日期按 Asia/Shanghai。Cookie为 HttpOnly、SameSite=Strict，HTTPS origin时附 Secure。删除Cookie不能绕过IP与全局预算限制，但匿名机制不能替代登录：换设备/IP仍可能建立新身份，共享IP也可能影响同机构用户。身份使用随机值；数据库只存日期、匿名标识、HMAC IP摘要、分钟和费用预留，不保存完整问答或原始IP。关闭标准HTTP访问日志；反向代理也应关闭问答body日志。数据库不会自动清理，以便重启/同日恢复严格配额；管理员可在备份后清理过去日期，不能删除当日记录。保持数据库与secret持久化，勿使用临时磁盘、复制独立数据库或每次启动更换secret。

公网部署用 HTTPS 反向代理，限制请求体、连接数、并发和超时。内置ThreadingHTTPServer适合本地预览及受控代理后的轻量服务，不能直接充当公网抗滥用边界。默认只绑定127.0.0.1，`--host` 可配置；将公网精确origin写入 `ALLOWED_ORIGINS`，例如 `https://example.org`（不含尾斜杠）。不信任Host头派生origin；没有Origin的POST拒绝。跨域仅在显式allowlist内返回credential CORS，且浏览器SameSite规则仍生效。默认忽略X-Forwarded-For；只有明确在 `TRUSTED_PROXIES` 列出的直接代理地址可提供该头，代理必须覆盖外部用户传入的X-Forwarded-For。不要把任意客户端地址列为可信代理。

自定义 `OPENAI_BASE_URL` 必须HTTPS（兼容Responses API的可信网关，密钥会发往该地址）；测试时仅在显式 `ALLOW_LOOPBACK_TEST_HTTP=1` 下允许loopback HTTP。禁止上游重定向，防止携带密钥跳转。上游45秒超时、返回体最多2MB；客户端请求体64KB、socket超时15秒。错误不返回上游错误正文和secret。不要把密钥写进前端或浏览器配置。

## 接口

- `GET /api/status` → `{available,message,dailyLimit:5,remaining,webSearchAvailable}`。`remaining` 取匿名额度、IP额度与全局预算可支付请求数的最小值；频率限制单独在提交时校验。
- `POST /api/chat`，`Content-Type: application/json` 且精确合法Origin。请求 `{platformIds:[idA,idB],question,material,goal,constraints,history:[{role,content}]}`。平台必须是资料库内两个不同ID；问题最长2000字，material2000、goal1000、constraints1000；history最多8条（4轮），仅user/assistant，每条4000字，总计12000字。历史只作为当前请求数据，不写入磁盘。
- 成功 `{answer,sources:[{id,label,url,evidence,checkedAt}],checkedAt,remaining,webChecked}`；错误 `{error,message}`，使用400/403/413/415/429/502/503等状态。

只检索所选两个记录。事实来源来自声明级数据以及API实际返回、属于所选官方域名的url_citation注解，模型自行写出的来源不进入来源列表。共享托管域名额外收紧：GitHub等仓库必须匹配所选原始资料中的owner/repository路径（GitLab保留嵌套组前缀），不接受其他仓库或路径穿越；github.io、readthedocs.io、wordpress.com等只认可明确配置的租户主机，根域不能授权全部租户。搜索API的域名过滤较宽，最终来源还须通过该路径/租户复核。提及价格/版本/最新/当前或存在资料缺口时，允许最多一次官方域名web_search；`WEB_SEARCH_ENABLED=0`关闭。返回 `webChecked=true` 要求此次实际有完成的搜索调用；可用搜索不代表每个事实均被实时核验。模型答案仍需人工核查：提示要求五部分、逐事实引用、保留未知项、无强制排名、无未证实互操作、最多两个澄清问题。源网页与history都是不可信数据，提示明确拒绝其中的指令。程序不是事实证明器，不保证模型遵从全部写作要求。

## 验证与官方API资料

```sh
python3 -m unittest discover -s tests -p test_agent_server.py -v
```

测试使用注入的Responses格式结果，不发起任何收费API请求。生产模型、账号权限、搜索能力及实际模型输出质量须在管理员配置后验证。

实现依据 [OpenAI Web search](https://developers.openai.com/api/docs/guides/tools-web-search) 和 [Responses create API](https://developers.openai.com/api/reference/resources/responses/methods/create)：使用 `store:false`、`web_search`、`filters.allowed_domains`、`max_tool_calls:1` 及 `include:["web_search_call.action.sources"]`。未显式选择任何默认模型。
