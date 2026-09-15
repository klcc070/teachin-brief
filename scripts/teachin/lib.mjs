/**
 * lib.mjs — 校园就业网宣讲会抓取核心库(无第三方依赖)
 * 站点特性:列表/详情正文以 base64+zlib 压缩内嵌,解码偏移每页随机,
 * 必须从页面 JS 中解析 substr(A)/substr(B) 再解码(勿写死偏移)。
 */
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

/**
 * 站点地址从 data/teachin/config.local.json 读取(gitignored,不入库):
 * { \"baseUrl\": \"http://xxx.edu.cn\", \"listPath\": \"/teachin/index/do1/<域名>/domain/<域名>/page/{page}\", \"detailPath\": \"/teachin/view/id/{id}\" }
 */
function loadSiteConfig() {
  const cfgPath = new URL('../../data/teachin/config.local.json', import.meta.url);
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    if (cfg.baseUrl) return cfg;
  } catch {}
  throw new Error('缺少 data/teachin/config.local.json(含 baseUrl/listPath/detailPath),参照 README 配置后重试。');
}
const SITE = loadSiteConfig();
export const BASE = SITE.baseUrl;
export const SITE_PATHS = SITE;
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** 筛选关键词(含空格变体) */
export const KEYWORDS = [
  'AI应用算法', 'AI应用研发', '后训练', 'AI算法', 'AI 算法',
  'Agent开发', 'Agent算法', 'Agent 开发', 'RAG',
];

export async function fetchText(url, timeoutMs = 25000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': BASE + '/' }, signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return Buffer.from(await res.arrayBuffer()).toString('utf8');
  } finally {
    clearTimeout(timer);
  }
}

/** 解压页内嵌正文块:unzip("b64").substr(A)).substr(B) — 偏移逐页随机 */
export function decodeEmbedded(html) {
  let out = '';
  const re = /unzip\(\s*"([A-Za-z0-9+/=]+)"\s*\)\s*(?:\)\s*)?\.substr\((\d+)\)\)?\s*\.substr\((\d+)\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const s1 = inflateSync(Buffer.from(m[1], 'base64')).toString('utf8');
      out += Buffer.from(s1.substr(Number(m[2])), 'base64').toString('utf8').substr(Number(m[3]));
    } catch { /* 单块失败不阻断 */ }
  }
  return out;
}

/** 解析列表页,返回条目数组 */
export function parseList(listHtml) {
  const items = [];
  for (const seg of listHtml.split('<ul class="infoList teachinList">').slice(1)) {
    const link = seg.match(/href="([^"]+)" title="([^"]+)"/);
    const time = seg.match(/<li>(\d{4}-\d{2}-\d{2})([^<]*)<\/li>/);
    const place = seg.match(/span5">([^<]+)<\/li>/);
    const status = seg.match(/status-text">([^<]+)</);
    if (!link || !time) continue;
    items.push({
      id: link[1].match(/id\/(\d+)/)[1],
      name: link[2].trim(),
      date: time[1],
      time: time[2].trim(),
      place: place ? place[1].trim() : '',
      status: status ? status[1].trim() : '',
      url: BASE + link[1],
    });
  }
  return items;
}

/** 抓取列表第 page 页 */
export async function fetchListPage(page) {
  const html = await fetchText(BASE + SITE_PATHS.listPath.replace('{page}', String(page)));
  return parseList(decodeEmbedded(html));
}

/** 抓取详情页并解码正文 */
export async function fetchDetail(id) {
  const html = await fetchText(`${BASE}/teachin/view/id/${id}`);
  return decodeEmbedded(html);
}

/** 详情正文 → {keywords, hasImg, images, textLen} */
export function scanDetail(detailHtml) {
  const plain = detailHtml.replace(/<[^>]+>/g, ' ');
  const keywords = KEYWORDS.filter((k) => plain.includes(k));
  const images = [];
  const imgRe = /<img[^>]+src="([^"]+)"/g;
  let m;
  while ((m = imgRe.exec(detailHtml)) !== null) images.push(m[1]);
  return { keywords, hasImg: images.length > 0, images, textLen: plain.replace(/\s+/g, '').length };
}

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}

/**
 * 抓取"明天 → 明天+6"窗口内的列表(增量:按日期升序翻页,超出窗口即停)。
 * @returns {{entries: object[], pagesFetched: number}}
 */
export async function fetchWeekList() {
  const tomorrow = addDays(todayStr(), 1);
  const end = addDays(tomorrow, 6);
  const entries = [];
  let page = 1;
  const seen = new Set();
  while (page <= 12) {
    const items = await fetchListPage(page);
    if (!items.length) break;
    let beyond = 0;
    for (const it of items) {
      if (it.date > end) { beyond += 1; continue; }
      if (it.date >= tomorrow && !seen.has(it.id)) {
        seen.add(it.id);
        entries.push(it);
      }
    }
    if (beyond === items.length) break; // 整页都超出窗口
    page += 1;
    await new Promise((r) => setTimeout(r, 300)); // 温和抓取
  }
  return { entries, pagesFetched: page };
}
