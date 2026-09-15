# 校园宣讲会简报 teachin-brief

学校就业网宣讲会每日增量跟踪:抓取列表 → 关键词筛选 AI 算法相关岗位 → 生成简报页(倒计时/命中卡片)→ 邮件/弹窗提醒。可配合 ZCode 自动任务或手动运行。

## 安装与运行

```bash
npm install
node scripts/teachin/update.mjs             # 增量更新 + 生成简报页
node scripts/teachin/update.mjs --mail      # 更新并发送简报到邮箱
node scripts/teachin/update.mjs --notify    # 更新后弹 Windows 简报窗
node scripts/teachin/update.mjs --rescan    # 修改关键词后全量重扫
node scripts/teachin/update.mjs --note "id|标签|岗位HTML"   # 写回读图/人工核验结论
```

## 配置

1. **站点地址**(必填):创建 `data/teachin/config.local.json`,填入你学校就业网的地址,例如:
   `{ "baseUrl": "http://xxx.edu.cn", "listPath": "/宣讲列表路径/含{page}占位符", "detailPath": "/详情页路径/含{id}占位符" }`
2. **邮箱**(可选):复制 `data/teachin/mail.local.example.json` 为 `mail.local.json`,填入发件邮箱与 SMTP 授权码(该文件已被 .gitignore 排除)。
2. **关键词**:`scripts/teachin/lib.mjs` 顶部 `KEYWORDS` 数组,改完跑一次 `--rescan`。

## 增量机制

列表每日全量比对(6~10 个请求);详情只为新增/变更条目抓取,其余用 `data/teachin/state.json` 缓存;官网撤下的条目自动标记删除。

## 隐私与合规

- 档案/凭据全部本地存储,零上传;就业网登录后才可见的打码字段不做绕过
- 爬取间隔 300ms+,仅用于个人求职参考
