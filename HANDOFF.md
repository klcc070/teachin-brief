# teachin-brief 接手文档

## 文件说明
- scripts/teachin/lib.mjs       核心库:抓取/解码/解析/关键词扫描。该站正文 base64+zlib 内嵌、解码偏移每页随机,decodeEmbedded 已动态解析,严禁写死偏移
- scripts/teachin/update.mjs    增量更新入口(--mail/--notify/--render/--note/--rescan)
- scripts/teachin/template.mjs  由 state 渲染简报页
- scripts/teachin/mail.mjs      SMTP 邮件(nodemailer)
- scripts/teachin/notify.ps1    WinForms 简报弹窗(必须保留 UTF-8 BOM,PowerShell 5.1 无 BOM 会按 GBK 解析中文)
- scripts/teachin/run-daily.cmd 定时任务入口(纯 ASCII)
- scripts/teachin/seed.json     人工核验过的命中卡片内容(渲染优先于自动扫描)
- data/teachin/state.json       增量状态缓存(gitignored,首次运行自动生成)

## 增量与 AI 核验
- 列表全量比对,详情只为新增/变更抓取;关键词在 lib.mjs 的 KEYWORDS,改后跑 --rescan
- 图片版详情(正文无文字只有 <img>)→ 标 needsImage 持久出现在简报,读图后用 --note 写回
- 每日 AI 核验只处理当日增量,严禁全量解析

## 红线
- 爬取间隔 300ms+;不绕过就业网登录打码字段;不读取/复述 mail.local.json 凭据
