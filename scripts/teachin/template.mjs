/**
 * template.mjs — 由 state 渲染"宣讲会提醒"页面(与手作版视觉一致)
 * state 结构见 update.mjs 顶部注释。
 */
export function renderPage(state) {
  const tomorrow = state.tomorrow;
  const inWindow = Object.values(state.entries || {}).filter((e) => !e.removed);
  const hits = inWindow.filter((e) => isHit(e));
  hits.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const tomorrowEntries = inWindow.filter((e) => e.date === tomorrow);
  const tomorrowHits = tomorrowEntries.filter((e) => isHit(e));
  const showDay = tomorrowHits.length ? tomorrow : (hits[0] ? hits[0].date : tomorrow);
  const showHits = hits.filter((h) => h.date === showDay);

  // 倒计时目标:展示日最早命中场次
  let target = null;
  for (const h of showHits) {
    const m = (h.time.match(/(\d{2}):(\d{2})/) || [])[0];
    if (!m) continue;
    const [hh, mm] = m.split(':').map(Number);
    const [y, mo, d] = showDay.split('-').map(Number);
    const t = new Date(y, mo - 1, d, hh, mm).getTime();
    if (target === null || t < target) target = t;
  }

  const conflict = {};
  for (const h of showHits) {
    const key = (h.time.match(/^\d{4}-\d{2}-\d{2} (\d{2}:\d{2})/) || [])[1];
    if (key) (conflict[key] = conflict[key] || []).push(h);
  }
  const conflictNote = Object.entries(conflict)
    .filter(([, arr]) => arr.length > 1)
    .map(([t, arr]) => `${t} 的 ${arr.map((a) => a.name.replace(/(股份|有限|控股)*公司/g, '').join(' 与 ')).slice(0, 60)}时间冲突,二选一`)
    .join(';');

  // 同一时段冲突提示
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const [ty, tm, td] = showDay.split('-').map(Number);
  const week = new Date(ty, tm - 1, td).getDay();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>⏰ 校园宣讲会简报 · AI 算法相关岗位</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 15px/1.8 "Microsoft YaHei", system-ui, sans-serif; background: #f0f4fa; color: #1f2329; padding: 24px 16px 60px; }
  .wrap { max-width: 900px; margin: 0 auto; }
  .alert { background: linear-gradient(135deg, #ff4d4f, #ff7a45); color: #fff; border-radius: 16px; padding: 20px 26px; margin-bottom: 20px; box-shadow: 0 6px 24px rgba(255,77,79,.35); display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .alert .bell { font-size: 40px; }
  .alert h1 { font-size: 20px; margin-bottom: 4px; }
  .alert p { font-size: 14px; opacity: .95; }
  .countdown { margin-left: auto; text-align: center; background: rgba(255,255,255,.18); border-radius: 12px; padding: 10px 20px; }
  .countdown b { display: block; font-size: 28px; line-height: 1.2; }
  .countdown span { font-size: 12px; opacity: .9; }
  h2.section { font-size: 15px; color: #4e5969; margin: 26px 0 12px; }
  table.quick { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.06); font-size: 13px; }
  table.quick th, table.quick td { border: 1px solid #f0f1f3; padding: 6px 10px; text-align: left; vertical-align: top; }
  table.quick th { background: #165dff; color: #fff; white-space: nowrap; }
  table.quick tr.hit-row { background: #fffbe6; }
  table.quick .t { white-space: nowrap; color: #86909c; }
  table.quick a { color: #165dff; text-decoration: none; }
  .mini-hit { background: #ffe58f; border-radius: 4px; padding: 0 4px; font-weight: 600; color: #d46b08; }
  .dim { color: #c9cdd4; }
  .card { background: #fff; border-radius: 16px; padding: 22px 26px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,.06); border-top: 4px solid #165dff; }
  .card.orange { border-top-color: #ff7d00; }
  .card h3 { font-size: 19px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .tag { font-size: 12px; font-weight: 400; border-radius: 999px; padding: 2px 10px; }
  .tag.exact { background: #ffece8; color: #f53f3f; border: 1px solid #fdcdc5; }
  .tag.related { background: #fff7e8; color: #ff7d00; border: 1px solid #ffd591; }
  .tag.offline { background: #e8ffea; color: #00b42a; border: 1px solid #aff0b5; }
  .meta { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 14px 0 4px; }
  .meta div { font-size: 14px; }
  .meta .k { color: #86909c; margin-right: 6px; }
  .meta .v { font-weight: 600; }
  .meta .v.time { color: #f53f3f; }
  .block { margin-top: 14px; }
  .block .bt { font-size: 13px; color: #4e5969; font-weight: 600; margin-bottom: 6px; }
  .pos { list-style: none; }
  .pos li { padding: 5px 0 5px 4px; border-bottom: 1px dashed #f0f1f3; font-size: 14px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .pos li:last-child { border-bottom: none; }
  .hit { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; padding: 0 6px; font-weight: 600; color: #d46b08; }
  .hit::before { content: "🎯 "; }
  .loc { color: #86909c; font-size: 12px; }
  .apply { background: #f5f8ff; border: 1px solid #bedaff; border-radius: 10px; padding: 12px 16px; margin-top: 14px; font-size: 14px; }
  .apply a { color: #165dff; font-weight: 600; text-decoration: none; word-break: break-all; }
  .apply a:hover { text-decoration: underline; }
  .num b { color: #f53f3f; font-size: 20px; }
  .num .none { color: #4e5969; font-size: 15px; font-weight: 600; }
  .src { font-size: 12px; color: #86909c; margin-top: 12px; }
  .src a { color: #86909c; }
  .foot { text-align: center; color: #c9cdd4; font-size: 12px; margin-top: 30px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="alert">
    <div class="bell">⏰</div>
    <div>
      <h1>${showHits.length ? `${showDay.slice(5)}(周${dayNames[week]})AI 算法相关宣讲会 ${showHits.length} 场` : `${showDay.slice(5)}(周${dayNames[week]})暂无关键词命中的宣讲会`}</h1>
      <p>${showHits.map((h) => `<b>${(h.time.match(/\\d{2}:\\d{2}/) || [''])[0]} ${h.name.replace(/(股份|有限|控股)*公司/g, '')}</b>(${h.place})`).join(';')}${conflictNote ? '<br>⚠ ' + conflictNote : ''}</p>
    </div>
    ${target ? `<div class="countdown"><b id="cd">--</b><span>距离开场</span></div>` : ''}
  </div>

  ${tomorrowHits.length ? `<h2 class="section">🎯 明天(${tomorrow.slice(5)})命中速查</h2>
  <table class="quick"><tr><th>公司</th><th>AI 关键词命中</th><th>地点</th><th>时间</th></tr>
  ${tomorrowHits.map((h) => `<tr class="hit-row"><td><a href="${h.url}">${h.name}</a></td><td><span class="mini-hit">🎯 ${kwLabel(h)}</span></td><td>${h.place}</td><td>${(h.time.match(/\\d{2}:\\d{2}/) || [''])[0]}</td></tr>`).join('')}
  </table>` : ''}

  <h2 class="section">🎯 AI 岗位命中卡片(本周共 ${hits.length} 场,含相关推荐)</h2>
  ${hits.map(cardHtml).join('\n')}

  <h2 class="section">📅 本周全景(明天起 7 天,共 ${inWindow.length} 场)</h2>
  ${weekTable(state, inWindow)}

  ${tomorrowEntries.length ? `<h2 class="section">明天(${tomorrow.slice(5)})全部 ${tomorrowEntries.length} 场宣讲会一览</h2>
  <table class="quick"><tr><th>时间</th><th>公司</th><th>地点</th><th>AI 核验</th></tr>
  ${tomorrowEntries.map((e) => {
    const hit = isHit(e);
    let cls = 'dim';
    let label = '未核验';
    if (e.manual) {
      if (e.manual.related) {
        label = '已读图核验,无命中';
        cls = 'dim';
      } else {
        cls = 'mini-hit';
        label = e.manual.source === 'image' ? '🎯 命中(读图核验)' : `🎯 ${kwLabel(e)}`;
      }
    } else if (e.scan && e.scan.keywords.length) {
      cls = 'mini-hit';
      label = `🎯 ${e.scan.keywords.join('/')}`;
    } else if (e.needsImage) {
      cls = '';
      label = '⚠ 详情为图片,待读图核验';
    } else if (e.scan) {
      label = '已核验,无命中';
    }
    return `<tr class="${hit ? 'hit-row' : ''}"><td class="t">${(e.time.match(/\\d{2}:\\d{2}/) || [''])[0]}</td><td><a href="${e.url}">${e.name}</a></td><td>${e.place}</td><td><span class="${cls || 'dim'}">${label}</span></td></tr>`;
  }).join('')}
  </table>` : ''}

  <div class="foot">
    数据来源:学校就业信息网 · 更新时间 ${state.updatedAt}<br>
    筛选关键词:${state.keywords.join(' / ')} · 由 scripts/teachin 定时任务自动更新 · 本地生成,不含个人信息
  </div>
</div>
<script>
  const target = ${target === null ? 'null' : target};
  function tick() {
    const el = document.getElementById('cd');
    if (!el) return;
    const diff = target - Date.now();
    if (diff <= 0) { el.textContent = '已开始'; return; }
    const h = Math.floor(diff / 3600000), m = Math.floor(diff % 3600000 / 60000);
    el.textContent = h >= 24 ? Math.floor(h / 24) + ' 天 ' + (h % 24) + ' 小时' : h + ' 小时 ' + m + ' 分';
  }
  tick(); setInterval(tick, 30000);
</script>
</body>
</html>`;
}

function isHit(e) {
  if (e.manual) return !e.manual.related;
  return !!(e.scan && e.scan.keywords.length);
}

function kwLabel(e) {
  return e.manual ? e.manual.tag.replace(/^命中|精确命中|[「」]/g, '').slice(0, 30) : (e.scan ? e.scan.keywords.join('/') : '');
}

function cardHtml(e) {
  const m = e.manual || {};
  const tagCls = m.related ? 'related' : 'exact';
  const borderCls = m.related ? 'orange' : '';
  const posList = m.positionsHtml
    ? `<ul class="pos">${m.positionsHtml}</ul>`
    : (e.scan && e.scan.keywords.length
        ? `<ul class="pos"><li><span class="hit">${e.scan.keywords.join('</span><span class="hit">')}</span></li><li>其余岗位请看详情页</li></ul>`
        : '');
  const imgLink = m.imageUrl ? `<a href="${e.url}">原始长图</a> ` : '';
  return `<div class="card ${borderCls}" id="t${e.id}">
  <h3>${e.name}
    <span class="tag ${tagCls}">${m.tag || kwLabel(e)}</span>
    <span class="tag offline">${e.status || '线下宣讲会'}</span>
  </h3>
  <div class="meta">
    <div><span class="k">⏱ 举办时间</span><span class="v time">${e.date} ${e.time}</span></div>
    <div><span class="k">📍 举办地点</span><span class="v">${e.place}</span></div>
    ${m.metaExtra || ''}
  </div>
  ${posList ? `<div class="block"><div class="bt">岗位列表</div>${posList}</div>` : ''}
  ${m.numHtml ? `<div class="block num"><span style="color:#86909c">👥 招聘人数:</span>${m.numHtml}</div>` : ''}
  ${m.applyHtml ? `<div class="apply">${m.applyHtml}</div>` : ''}
  <div class="src">详情:<a href="${e.url}">就业网详情:${e.id}</a>${m.srcExtra ? ' · ' + m.srcExtra : ''}${m.imageUrl ? ` · ${imgLink}` : ''}</div>
</div>`;
}

function weekTable(state, entries) {
  const byDay = {};
  for (const e of entries) (byDay[e.date] = byDay[e.date] || []).push(e);
  const days = Object.keys(byDay).sort();
  return `<table class="quick"><tr><th>日期</th><th>场次</th><th>AI 命中</th><th>值得关注</th></tr>
  ${days.map((d) => {
    const dayHits = byDay[d].filter(isHit);
    const note = (state.noteworthyByDay || {})[d] || '<span class="dim">—</span>';
    return `<tr class="${dayHits.length ? 'hit-row' : ''}"><td>${d.slice(5)} ${'周' + '日一二三四五六'[new Date(d + 'T00:00:00').getDay()]}</td><td>${byDay[d].length}</td><td>${dayHits.map((h) => `<span class="mini-hit">🎯 ${h.name.replace(/(股份|有限|控股)*公司/g, '')}</span>`).join(' ') || '—'}</td><td>${note}</td></tr>`;
  }).join('')}
  </table>
  ${state.weekNote ? `<p class="src" style="margin-top:8px">${state.weekNote}</p>` : ''}`;
}
