# 双平台对比 Agent 执行记录

目标：在原手册中提供122项可选对象、朱红暖白双平台工作台与独立的受控问答服务。

- [x] 资料：119目录＋云四库/DEDU/Texta；声明级证据与MARKUS/COMPARATIVUS隔离。
- [x] 界面：2:1桌面布局、手机标签、搜索/交换/差异/任务/分享/打印/复制、旧链接。
- [x] 服务：服务端模型与官方搜索、五轮匿名限额、IP/频率/持久预算保护、无完整问答日志。
- [x] 验证：数据/逻辑/API测试、浏览器桌面手机/键盘/离线/打印与旧功能回归。
- [x] 交付：本地预览、部署配置说明、验证证据与未配置服务的真实状态。

接口契约：data/platforms.json 为 {version, updated, dimensions:[{key,label}], platforms:[{id,name,aliases,kind,materials,stages,officialDomains,fields:{[key]:{text,evidence,checkedAt,sources:[{label,url}]}},tasks:[],profileId}]}。
维度key：position,materials,input,capabilities,conditions,review,output,limits,collaboration,sources。
缺失值：text='资料待补充', evidence='资料待补充', checkedAt=null, sources=[]。
前端状态接口 GET /api/status 返回 {available,message,dailyLimit,remaining?,webSearchAvailable?}。
POST /api/chat 请求 {platformIds:[idA,idB],question,material,goal,constraints,history:[{role,content}]}，Cookie管理匿名身份。
响应 {answer,sources:[{id,label,url,evidence,checkedAt}],checkedAt,remaining,webChecked}。
失败响应 {error,message}，HTTP 400/429/503/502 等。所有问答由服务端生成，无演示回答。

执行说明：原生工作树工具无法识别父目录中的子仓库，因此在原子仓库创建 feat/dual-platform-agent 分支完成。本地实现和测试已完成；模型密钥／型号／预算未配置，问答如实关闭，未生产发布。
