/**
 * update.mjs — 宣讲会每日增量更新(纯脚本,零 LLM token)
 *
 * 用法:
 *   node scripts/teachin/update.mjs              # 增量更新 + 重新生成提醒页 + 输出简报
 *   node scripts/teachin/update.mjs --notify     # 更新后弹 Windows 通知并打开提醒页
 *   node scripts/teachin/update.mjs --mail       # 更新后把简报页发送到邮箱(需配置 mail.local.json)
 *   node scripts/teachin/update.mjs --render     # 不抓取,仅用现有 state 重新渲染
 *   node scripts/teachin/update.mjs --note "id|标签|岗位HTML(可选)"   # 人工写入读图结论后重渲染
 *
 * 增量策略:列表每日全量比对(仅 6~8 个请求);详情只为【新增/信息变更】的条目抓取,
 * 未变化条目沿用 state 中缓存的关键词扫描结果;被官网撤下的条目标记 removed。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWeekList, fetchDetail, scanDetail, todayStr, addDays, KEYWORDS, BASE } from './lib.mjs';
import { renderPage } from './template.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE_FILE = join(ROOT, 'data', 'teachin', 'state.json');
const SEED_FILE = join(ROOT, 'scripts', 'teachin', 'seed.json');
const PAGE_FILE = join(ROOT, '宣讲会提醒.html');
const BRIEF_FILE = join(ROOT, 'data', 'teachin', 'brief.md');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const noteArg = args[args.indexOf('--note') + 1];

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    const seed = JSON.parse(readFileSync(SEED_FILE, 'utf8'));
    return {
      updatedAt: null,
      tomorrow: null,
      keywords: KEYWORDS,
      entries: {},
      manual: seed.manual,
      noteworthyByDay: seed.noteworthyByDay || {},
      weekNote: seed.weekNote || '',
    };
  }
}

function saveState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
}

function loadBrief(state, diff) {
  const tomorrow = state.tomorrow;
  const [y, m, d] = tomorrow.split('-').map(Number);
  const wd = '日一二三四五六'[new Date(y, m - 1, d).getDay()];
  const live = Object.values(state.entries).filter((e) => !e.removed);
  const tomorrowEntries = live.filter((e) => e.date === tomorrow);
  const isHit = (e) => (e.manual ? !e.manual.related : !!(e.scan && e.scan.keywords.length));
  const tomorrowHits = tomorrowEntries.filter(isHit);
  const weekHits = live.filter(isHit);
  const lines = [];
  lines.push(`【宣讲会简报】${new Date().toLocaleString('zh-CN')} 更新`);
  lines.push(`明天(${tomorrow.slice(5)} 周${wd}):共 ${tomorrowEntries.length} 场,AI 关键词命中 ${tomorrowHits.length} 场`);
  for (const h of tomorrowHits) {
    const t = (h.time.match(/\d{2}:\d{2}/) || [''])[0];
    lines.push(`  🎯 ${t} ${h.name} @ ${h.place}`);
  }
  lines.push(`本周(${tomorrow}起7天)共 ${live.length} 场,命中 ${weekHits.length} 场:${weekHits.map((h) => h.name.replace(/(股份|有限|控股)*公司/g, '')).join('、')}`);
  if (diff) {
    const parts = [];
    if (diff.added.length) parts.push(`新增 ${diff.added.length}:${diff.added.map((e) => e.name).join('、')}`);
    if (diff.removed.length) parts.push(`官网撤下 ${diff.removed.length}:${diff.removed.map((e) => e.name).join('、')}`);
    if (diff.changed.length) parts.push(`信息变更 ${diff.changed.length}:${diff.changed.map((e) => e.name).join('、')}`);
    if (diff.failed.length) parts.push(`${diff.failed.length} 条详情抓取失败,下次重试`);
    lines.push(parts.length ? '今日变动:' + parts.join(' | ') : '今日变动:无(全部与昨日一致)');
  }
  // 待读图核验清单:持久显示,直到 --note 核验完成
  const pendingImage = live.filter((e) => e.needsImage && !(state.manual && state.manual[e.id]));
  if (pendingImage.length) {
    lines.push(`⚠ ${pendingImage.length} 条详情为图片,待读图核验:${pendingImage.map((e) => `${e.id} ${e.name}`).join('、')}`);
  }
  lines.push('详见:宣讲会提醒.html');
  return lines.join('\n');
}

async function main() {
  const state = loadState();
  const diff = { added: [], removed: [], changed: [], needImage: [], failed: [] };

  // 人工读图结论写入;标签以"已核验"开头视为"无命中"(related,不算命中)
  if (noteArg) {
    const [id, tag, positionsHtml] = noteArg.split('|');
    const related = /^已核验/.test(tag || '');
    state.manual = state.manual || {};
    state.manual[id] = {
      ...(state.manual[id] || {}),
      tag: tag || '已人工核验',
      source: 'image',
      positionsHtml: positionsHtml || (state.manual[id] && state.manual[id].positionsHtml) || '',
      related,
    };
  }

  if (!flag('--render')) {
    state.tomorrow = addDays(todayStr(), 1);
    const { entries, pagesFetched } = await fetchWeekList();
    console.error(`[update] 列表抓取完成:${entries.length} 条(第 1~${pagesFetched} 页)`);

    const prev = state.entries || {};
    const fresh = {};
    for (const e of entries) fresh[e.id] = true;

    for (const e of entries) {
      const old = prev[e.id];
      const cur = { ...e };
      if (!old) {
        diff.added.push(e);
      } else if (old.name !== e.name || old.time !== e.time || old.place !== e.place || old.date !== e.date) {
        diff.changed.push(e);
      }
      // 详情扫描策略:--rescan 全量重扫(改关键词后用);否则只为新增/变更/从未扫描的条目抓
      const unchanged = old && !diff.changed.includes(e);
      const needScan =
        flag('--rescan') || !unchanged || (!old.scan && !(state.manual && state.manual[e.id]));
      if (needScan) {
        try {
          const detail = await fetchDetail(e.id);
          const scan = scanDetail(detail);
          cur.scan = { keywords: scan.keywords, hasImg: scan.hasImg, textLen: scan.textLen };
          if (scan.hasImg) cur.imageUrl = scan.images[0];
          if (scan.keywords.length) {
            cur.needsImage = false;
            console.error(`  🎯 命中 ${e.name}: ${scan.keywords.join('/')}`);
          } else if (scan.hasImg && scan.textLen < 400) {
            cur.needsImage = true; // 图片版详情,持久标记直到 --note 核验
            diff.needImage.push(e);
          } else {
            cur.needsImage = false;
          }
          await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
          cur.scan = old && old.scan ? old.scan : null;
          cur.needsImage = old ? old.needsImage : false;
          diff.failed.push(e);
          console.error(`  ✗ 详情抓取失败 ${e.name}: ${err.message}`);
        }
      } else {
        cur.scan = old.scan || null;
        cur.needsImage = old ? old.needsImage : false;
      }
      cur.manual = (state.manual || {})[e.id] || old && old.manual || null;
      if (cur.manual) cur.needsImage = false; // 人工/agent 已核验
      cur.removed = false;
      fresh[e.id] = cur;
    }

    // 官网撤下的条目(仅统计仍在窗口内的)
    for (const old of Object.values(prev)) {
      if (!fresh[old.id] && !old.removed && old.date >= state.tomorrow && old.date <= addDays(state.tomorrow, 6)) {
        diff.removed.push(old);
      }
    }
    // 保留窗口外的历史 manual/数据不删除,但标记 removed 以免渲染
    for (const old of Object.values(prev)) {
      if (!fresh[old.id]) fresh[old.id] = { ...old, removed: true };
    }
    state.entries = fresh;
  } else {
    state.tomorrow = state.tomorrow || addDays(todayStr(), 1);
  }

  state.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  state.keywords = KEYWORDS;
  // 统一挂载人工/AI 核验结论(--render 路径也会生效),并解除对应的待读图标记
  for (const e of Object.values(state.entries)) {
    if (state.manual && state.manual[e.id]) {
      e.manual = state.manual[e.id];
      e.needsImage = false;
    }
  }
  saveState(state);

  writeFileSync(PAGE_FILE, renderPage(state));
  mkdirSync(dirname(BRIEF_FILE), { recursive: true });
  const brief = loadBrief(state, flag('--render') ? null : diff);
  writeFileSync(BRIEF_FILE, brief);
  console.log(brief);

  if (flag('--mail')) {
    const { sendBrief } = await import('./mail.mjs');
    await sendBrief().catch((e) => console.error('[mail] 发送失败:', e.message));
  }

  if (flag('--notify')) {
    const ps1 = join(ROOT, 'scripts', 'teachin', 'notify.ps1');
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], (err) => {
      if (err) console.error('[notify] 失败:', err.message);
    });
  }
}

main().catch((e) => {
  console.error('[update] 失败:', e.message);
  process.exit(1);
});
