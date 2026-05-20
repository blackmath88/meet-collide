/* ══════════════════════════════════════════════
   Meet & Collide — Collision Engine
   Pure client-side matching + D3 visualization
   ══════════════════════════════════════════════ */
'use strict';

let allMatches = [], simulation = null, _cardA = null, _cardB = null;

function setTheme(th) {
  document.documentElement.setAttribute('data-theme', th);
  localStorage.setItem('mc-theme', th);
  document.querySelectorAll('#theme-toggle button').forEach((b, i) => b.classList.toggle('on', i === (th === 'light' ? 0 : 1)));
  if (allMatches.length && _cardA && _cardB) {
    const g = buildGraph(_cardA, _cardB, allMatches);
    setTimeout(() => renderGraph(g), 50);
  }
}

// ── Matching ──────────────────────────────────
function tokenize(s) { return s.toLowerCase().replace(/[^a-zäöüß0-9\s\-]/g, ' ').split(/\s+/).filter(w => w.length > 2) }
function jaccard(a, b) { const sa = new Set(tokenize(a)), sb = new Set(tokenize(b)), inter = new Set([...sa].filter(x => sb.has(x))), uni = new Set([...sa, ...sb]); return uni.size ? inter.size / uni.size : 0 }

function extractStrings(obj, pre = '') {
  const r = [];
  if (!obj) return r;
  if (typeof obj === 'string' && obj.length > 3) r.push({ text: obj, path: pre });
  else if (Array.isArray(obj)) obj.forEach((v, i) => { if (typeof v === 'string' && v.length > 3) r.push({ text: v, path: `${pre}[${i}]` }); else if (typeof v === 'object') r.push(...extractStrings(v, `${pre}[${i}]`)) });
  else if (typeof obj === 'object') for (const [k, v] of Object.entries(obj)) { if (['schema_version', 'generated_at', 'generated_by', 'id', 'depth', 'since', 'energy', 'lang', 'timezone'].includes(k)) continue; r.push(...extractStrings(v, pre ? `${pre}.${k}` : k)) }
  return r;
}

function fieldLabel(p) {
  const m = { 'mental_models': 'Mental Model', 'current_focus': 'Focus', 'current_obsessions': 'Focus', 'conversation_triggers': 'Trigger', 'background.expertise': 'Expertise', 'background.methods': 'Methods', 'background.career': 'Background', 'interests.intellectual': 'Interest', 'interests.creative': 'Creative', 'personality.interests': 'Interest', 'personality.guilty': 'Guilty Pleasure', 'personality.values': 'Values', 'personality.social': 'Social', 'working_style': 'Working Style', 'places_and_experiences': 'Place', 'influences': 'Influence', 'easter_eggs': 'Easter Egg', 'looking_for': 'Looking For', 'meeting_intent': 'Intent', 'identity': 'Identity' };
  for (const [k, l] of Object.entries(m)) if (p.startsWith(k)) return l;
  return p.split('.')[0].replace(/_/g, ' ');
}

function isEgg(p) { return p.startsWith('easter_eggs') || p.includes('guilty_pleasures') || p.includes('guilty') }

function computeMatches(a, b) {
  const sa = extractStrings(a), sb = extractStrings(b), matches = [], seen = new Set();
  for (const x of sa) for (const y of sb) { const k = x.path + '|' + y.path; if (seen.has(k)) continue; const sc = jaccard(x.text, y.text); if (sc >= .18) { seen.add(k); matches.push({ score: sc, textA: x.text, textB: y.text, pathA: x.path, pathB: y.path, labelA: fieldLabel(x.path), labelB: fieldLabel(y.path), isEgg: isEgg(x.path) || isEgg(y.path), isCross: fieldLabel(x.path) !== fieldLabel(y.path) }) } }
  const best = new Map();
  for (const m of matches) { const k = m.textA.substring(0, 35); if (!best.has(k) || best.get(k).score < m.score) best.set(k, m) }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function short(t, n = 8) { const w = t.split(/\s+/); return w.length <= n ? t : w.slice(0, n).join(' ') + '…' }
function sLevel(s) { return s >= .45 ? 'high' : s >= .28 ? 'medium' : 'low' }

function genQuestions(matches, nA, nB, lang) {
  const de = lang === 'de';
  const qs = [], tpls = [
    { t: m => m.labelA === 'Mental Model' || m.labelB === 'Mental Model', g: m => ({ q: de ? `Ihr nutzt beide Frameworks rund um "${short(m.textA, 6)}" — wie seid ihr da jeweils hingelangt?` : `You both use frameworks around "${short(m.textA, 6)}" — how did each of you get there?`, w: de ? 'Geteilte Denkmodelle schaffen sofort Tiefe.' : 'Shared mental models create instant depth.' }) },
    { t: m => m.labelA === 'Focus' || m.labelB === 'Focus', g: m => ({ q: de ? `Ihr beschäftigt euch beide mit "${short(m.textA, 6)}" — was hat euch zuletzt überrascht?` : `You're both deep in "${short(m.textA, 6)}" — what surprised you most recently?`, w: de ? 'Aktuelle Themen tragen die frischeste Energie.' : 'Current obsessions carry the freshest energy.' }) },
    { t: m => m.labelA === 'Trigger' || m.labelB === 'Trigger', g: m => ({ q: de ? `"${short(m.textA, 6)}" begeistert euch beide — wo kollidieren eure Perspektiven?` : `"${short(m.textA, 6)}" lights you both up — where do your perspectives collide?`, w: de ? 'Gleiches Thema, verschiedene Zugänge.' : 'Same topic, different entry points.' }) },
    { t: m => m.isCross, g: m => ({ q: `${nA} (${m.labelA}) × ${nB} (${m.labelB}) — "${short(m.textA, 5)}". ${de ? 'Was ist die Brücke?' : "What's the bridge?"}`, w: de ? 'Feld-übergreifende Treffer verbinden Welten.' : "Cross-field matches connect worlds that don't usually talk." }) },
    { t: () => true, g: m => ({ q: de ? `Ihr gravitiert beide zu "${short(m.textA, 6)}" — was würdet ihr bauen mit unbegrenzter Zeit?` : `You both gravitate toward "${short(m.textA, 6)}" — what would you build with unlimited time?`, w: de ? 'Die Unbegrenzt-Zeit-Frage zeigt, was wirklich zählt.' : 'The unlimited-time question reveals what really matters.' }) }
  ], used = new Set();
  for (const m of matches.slice(0, 10)) { for (const tp of tpls) { if (tp.t(m) && !used.has(tp)) { qs.push(tp.g(m)); used.add(tp); break } } if (qs.length >= 4) break }
  return qs;
}

// ── Graph ─────────────────────────────────────
function buildGraph(a, b, matches) {
  const nodes = [], links = [];
  function addNodes(card, side) {
    const items = [
      ...(card.mental_models || []).map(x => ({ id: `${side}_mm_${x.id || Math.random().toString(36).slice(2, 6)}`, label: x.name || x.id, type: 'mental_model', text: x.description || x.name, side, r: 20 })),
      ...((card.current_focus || card.current_obsessions || []).map(x => ({ id: `${side}_fo_${x.id || Math.random().toString(36).slice(2, 6)}`, label: (x.topic || '').split(' ').slice(0, 4).join(' '), type: 'focus', text: x.topic || '', side, r: 15 }))),
      ...(card.conversation_triggers || []).map((x, i) => ({ id: `${side}_tr_${i}`, label: (x.topic || '').split(' ').slice(0, 4).join(' '), type: 'trigger', text: x.topic || '', side, r: 12 })),
      ...((card.background?.expertise_areas || []).map((x, i) => ({ id: `${side}_ex_${i}`, label: typeof x === 'string' ? x.split(' ').slice(0, 3).join(' ') : '', type: 'expertise', text: typeof x === 'string' ? x : '', side, r: 11 }))),
      ...(card.easter_eggs || []).map((x, i) => ({ id: `${side}_eg_${i}`, label: typeof x === 'string' ? x.split(' ').slice(0, 3).join(' ') : '', type: 'easter_egg', text: typeof x === 'string' ? x : '', side, r: 8 }))
    ].filter(n => n.text && n.label);
    items.forEach(n => nodes.push(n));
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const sc = jaccard(items[i].text, items[j].text); if (sc > .12) links.push({ source: items[i].id, target: items[j].id, strength: sc, type: 'intra', side }) }
  }
  addNodes(a, 'a'); addNodes(b, 'b');
  const nodesA = nodes.filter(n => n.side === 'a'), nodesB = nodes.filter(n => n.side === 'b');
  for (const m of matches) {
    let bestA = null, bestB = null, bestSA = 0, bestSB = 0;
    for (const n of nodesA) { const s = jaccard(m.textA, n.text); if (s > bestSA) { bestSA = s; bestA = n } }
    for (const n of nodesB) { const s = jaccard(m.textB || m.textA, n.text); if (s > bestSB) { bestSB = s; bestB = n } }
    if (bestA && bestB && bestSA > .08 && bestSB > .08) { const exists = links.find(l => l.source === bestA.id && l.target === bestB.id); if (!exists) links.push({ source: bestA.id, target: bestB.id, strength: m.score, type: 'cross', matchIdx: matches.indexOf(m) }) }
  }
  return { nodes, links };
}

function renderGraph(graph) {
  const container = document.getElementById('canvas');
  const old = container.querySelector('svg'); if (old) old.remove();
  const W = container.clientWidth, H = container.clientHeight;
  if (W < 10 || H < 10) return;
  const svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const defs = svg.append('defs');
  const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
  glow.append('feGaussianBlur').attr('stdDeviation', isDark ? '4' : '2').attr('result', 'blur');
  glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).join('feMergeNode').attr('in', d => d);
  const grad = defs.append('linearGradient').attr('id', 'cross-grad').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#1a7a6d').attr('stop-opacity', .6);
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#5a3068').attr('stop-opacity', .6);
  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([.3, 3]).on('zoom', e => g.attr('transform', e.transform)));
  const link = g.append('g').selectAll('line').data(graph.links).join('line').attr('stroke', d => d.type === 'cross' ? 'url(#cross-grad)' : d.side === 'a' ? 'var(--link-a)' : 'var(--link-b)').attr('stroke-width', d => d.type === 'cross' ? Math.max(1.2, d.strength * 5) : .5).attr('stroke-opacity', d => d.type === 'cross' ? .7 : .25).attr('stroke-linecap', 'round');
  const node = g.append('g').selectAll('g').data(graph.nodes).join('g').attr('cursor', 'pointer');
  node.append('circle').attr('r', d => d.r * 2).attr('fill', d => d.side === 'a' ? 'var(--node-a-halo)' : 'var(--node-b-halo)');
  node.append('circle').attr('r', d => d.r).attr('fill', d => d.side === 'a' ? 'var(--node-a-fill)' : 'var(--node-b-fill)').attr('stroke', d => d.side === 'a' ? 'var(--node-a-stroke)' : 'var(--node-b-stroke)').attr('stroke-width', 1.2).attr('stroke-opacity', .7).attr('filter', 'url(#glow)');
  node.append('text').attr('class', 'node-label').attr('dy', d => d.r + 12).text(d => d.label);
  const tooltip = document.getElementById('tooltip');
  const typeNames = { mental_model: 'Mental Model', focus: 'Current Focus', trigger: 'Trigger', expertise: 'Expertise', easter_egg: 'Easter Egg' };
  node.on('mouseover', function (e, d) {
    d3.select(this).select('circle:nth-child(2)').transition().duration(200).attr('r', d.r * 1.3).attr('stroke-opacity', 1);
    d3.select(this).select('text').classed('highlighted', true);
    tooltip.querySelector('.tt-cat').textContent = (typeNames[d.type] || d.type) + ' · ' + (d.side === 'a' ? _cardA.identity.name.split(' ')[0] : _cardB.identity.name.split(' ')[0]);
    tooltip.querySelector('.tt-label').textContent = d.label;
    tooltip.querySelector('.tt-text').textContent = d.text;
    tooltip.classList.add('visible');
    const rect = container.getBoundingClientRect();
    tooltip.style.left = Math.min(e.clientX - rect.left + 14, W - 270) + 'px';
    tooltip.style.top = Math.max(0, e.clientY - rect.top - 20) + 'px';
    link.attr('stroke-opacity', l => (l.source.id === d.id || l.target.id === d.id) ? .9 : .04);
  })
  .on('mousemove', function (e) { const rect = container.getBoundingClientRect(); tooltip.style.left = Math.min(e.clientX - rect.left + 14, W - 270) + 'px'; tooltip.style.top = Math.max(0, e.clientY - rect.top - 20) + 'px' })
  .on('mouseout', function (e, d) {
    d3.select(this).select('circle:nth-child(2)').transition().duration(300).attr('r', d.r).attr('stroke-opacity', .7);
    d3.select(this).select('text').classed('highlighted', false);
    tooltip.classList.remove('visible');
    link.attr('stroke-opacity', l => l.type === 'cross' ? .7 : .25);
  })
  .on('click', function (e, d) {
    const cross = graph.links.filter(l => l.type === 'cross' && (l.source.id === d.id || l.target.id === d.id));
    if (cross.length) { const best = cross.sort((a, b) => b.strength - a.strength)[0]; if (best.matchIdx != null) selectMatch(best.matchIdx) }
  });
  node.call(d3.drag().on('start', (e, d) => { if (!e.active) simulation.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y }).on('drag', (e, d) => { d.fx = e.x; d.fy = e.y }).on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null }));
  simulation = d3.forceSimulation(graph.nodes)
    .force('link', d3.forceLink(graph.links).id(d => d.id).distance(d => d.type === 'cross' ? 130 - d.strength * 90 : 55).strength(d => d.type === 'cross' ? d.strength * .7 : .12))
    .force('charge', d3.forceManyBody().strength(-100))
    .force('x', d3.forceX(d => d.side === 'a' ? W * .35 : W * .65).strength(.07))
    .force('y', d3.forceY(H / 2).strength(.05))
    .force('collision', d3.forceCollide(d => d.r + 6))
    .on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

// ── UI helpers ────────────────────────────────
function selectMatch(idx) {
  const m = allMatches[idx]; if (!m) return;
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  const si = document.querySelector(`.sb-item[data-idx="${idx}"]`); if (si) si.classList.add('active');
  document.getElementById('rp-detail').style.display = 'block';
  document.getElementById('rp-detail-content').innerHTML = `<div class="md-card selected"><div class="md-top"><span class="md-strength ${sLevel(m.score)}"></span><span class="md-type">${m.isCross ? 'Cross-field' : m.isEgg ? 'Surprise' : 'Direct'} · ${Math.round(m.score * 100)}%</span></div><div class="md-topic">${short(m.textA, 12)}</div><div class="md-detail">${m.textB !== m.textA ? short(m.textB, 12) : ''}</div><div class="md-sources"><span class="md-src a">${m.labelA}</span><span class="md-src b">${m.labelB}</span></div></div>`;
}

function renderSidebar(matches) {
  const mkItem = (m, idx) => `<div class="sb-item" data-idx="${idx}" onclick="selectMatch(${idx})"><span class="sb-dot ${sLevel(m.score)}"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${short(m.textA, 5)}</span><span class="sb-score">${Math.round(m.score * 100)}%</span></div>`;
  document.getElementById('sb-top').innerHTML = matches.slice(0, 3).map((m, i) => mkItem(m, i)).join('');
  document.getElementById('sb-all').innerHTML = matches.slice(3).map((m, i) => mkItem(m, i + 3)).join('');
  document.getElementById('sb-footer').textContent = `${matches.length} collisions · client-side`;
}

function renderRP(questions, eggs) {
  document.getElementById('rp-questions').innerHTML = questions.map(q => `<div class="q-card"><div class="q-text">${q.q}</div><div class="q-why">${q.w}</div></div>`).join('');
  document.getElementById('rp-eggs').innerHTML = eggs.length ? eggs.map(m => `<div class="egg-card"><span class="egg-icon">✦</span><div><div class="egg-text">${short(m.textA, 12)}</div><span class="egg-reason">→ ${short(m.textB, 8)}</span></div></div>`).join('') : '<div style="font-size:10px;color:var(--text-meta)">No surprise overlaps found.</div>';
}

// ── Main init ─────────────────────────────────
function initCollision(cardA, cardB, lang) {
  _cardA = cardA; _cardB = cardB;
  const nA = cardA.identity.name.split(' ')[0], nB = cardB.identity.name.split(' ')[0];
  allMatches = computeMatches(cardA, cardB);
  const questions = genQuestions(allMatches, nA, nB, lang);
  const eggs = allMatches.filter(m => m.isEgg);
  const graph = buildGraph(cardA, cardB, allMatches);

  document.getElementById('nav-names').innerHTML = `<span class="na">${nA}</span> <span style="color:var(--text-meta)">×</span> <span class="nb">${nB}</span>`;
  document.getElementById('nav-badge').textContent = `${allMatches.length} collisions`;
  renderSidebar(allMatches); renderRP(questions, eggs);
  setTimeout(() => renderGraph(graph), 120);
  if (allMatches.length) setTimeout(() => selectMatch(0), 500);
}

window.addEventListener('resize', () => { if (allMatches.length && _cardA && _cardB) { const g = buildGraph(_cardA, _cardB, allMatches); renderGraph(g) } });
