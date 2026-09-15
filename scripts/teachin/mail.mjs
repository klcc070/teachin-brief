/**
 * mail.mjs — 把宣讲会简报发到邮箱(需先配置 data/teachin/mail.local.json)
 *
 * 配置模板见 data/teachin/mail.local.example.json(QQ邮箱示例:
 *   smtp.qq.com : 465(SSL),user=你的QQ邮箱,pass=设置里生成的"授权码"而非登录密码)
 * 该文件已加入 .gitignore,授权码不会进入仓库。
 *
 * 用法:
 *   node scripts/teachin/mail.mjs            # 发送简报邮件(正文=brief.md,附件=宣讲会提醒.html)
 *   node scripts/teachin/mail.mjs --test     # 发一封测试邮件验证配置
 */
import { readFileSync, existsSync } from 'node:fs';
import { createTransport } from 'nodemailer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG = join(ROOT, 'data', 'teachin', 'mail.local.json');

function loadConfig() {
  if (!existsSync(CONFIG)) return null;
  try {
    const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
    if (!cfg.enabled || !cfg.user || !cfg.pass || !cfg.to) return null;
    return cfg;
  } catch (e) {
    console.error('[mail] 配置解析失败:', e.message);
    return null;
  }
}

export async function sendBrief({ test = false } = {}) {
  const cfg = loadConfig();
  if (!cfg) {
    console.log('[mail] 未配置或未启用邮箱(data/teachin/mail.local.json),跳过发送');
    return false;
  }
  const briefPath = join(ROOT, 'data', 'teachin', 'brief.md');
  const pagePath = join(ROOT, '宣讲会提醒.html');
  const brief = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : '(简报缺失)';
  const today = new Date().toISOString().slice(5, 10);
  const subject = test
    ? `【宣讲会简报】测试邮件 - 配置成功`
    : `【宣讲会简报】${today} 更新:明天命中见正文`;

  const transport = createTransport({
    host: cfg.smtpHost || 'smtp.qq.com',
    port: cfg.smtpPort || 465,
    secure: cfg.secure !== false,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  await transport.sendMail({
    from: cfg.from || cfg.user,
    to: cfg.to,
    subject,
    text: brief + (test ? '\n\n(这是一封测试邮件,收到即代表邮箱配置成功。)' : ''),
    html: test
      ? undefined
      : existsSync(pagePath)
        ? readFileSync(pagePath, 'utf8')
        : undefined,
    attachments: [{ filename: '宣讲会提醒.html', path: pagePath }],
  });
  console.log(`[mail] 已发送至 ${cfg.to}`);
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('mail.mjs')) {
  sendBrief({ test: process.argv.includes('--test') })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[mail] 发送失败:', e.message);
      process.exit(1);
    });
}
