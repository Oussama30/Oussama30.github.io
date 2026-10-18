// Tableau de bord de suivi : qui a trouvé quoi, par niveau, filière et saison.
import { html, useState, useMemo } from './vendor/preact-htm.js';
import { Icon, Bar, Person, Tabs } from './ui.js';
import { seasonStats, monthlyActivity, seasonLabel, NIVEAUX, pct, OBJECTIFS, statutOf, FOUND } from './logic.js';

export function DashboardPage(ctx) {
  const { data, saison: cur, me, openProfile } = ctx;
  const seasons = useMemo(() => [...new Set([cur, ...data.placements.map(p => p.saison)])].sort((a, b) => b - a), [data, cur]);
  const [saison, setSaison] = useState(cur);
  const [niv, setNiv] = useState(5);
  const now = saison === cur ? new Date() : OBJECTIFS[3].deadline(saison);
  const st = useMemo(() => seasonStats(data, saison, now), [data, saison]);
  const months = useMemo(() => monthlyActivity(data, 12), [data]);
  const totalPop = st.rows.reduce((a, r) => a + r.total, 0);
  const totalFound = st.rows.reduce((a, r) => a + r.found, 0);
  const pendingAll = st.rows.reduce((a, r) => a + r.pending, 0);
  const openOffers = data.offers.filter(o => o.status === 'ouverte').length;
  const row = st.rows.find(r => r.n === niv);
  const canSeeNames = me.role !== 'etudiant';

  return html`<section class="page">
    <header class="page-head">
      <div><p class="eyebrow">Suivi de placement</p><h1>Tableau de bord</h1></div>
      <label class="season-pick">Saison <select id="dash-season" value=${saison} onChange=${e => setSaison(+e.target.value)}>${seasons.map(s => html`<option value=${s}>${seasonLabel(s)}${s === cur ? ' (en cours)' : ''}</option>`)}</select></label>
    </header>

    <div class="kpis">
      <div class="kpi"><span class="kpi-label">Ont trouvé</span><span class="kpi-val mono">${totalFound}<small>/${totalPop}</small></span><span class="small muted">${pct(totalPop ? totalFound / totalPop : 0)} des inscrits 3A, 4A, 5A et jeunes diplômés</span></div>
      <div class="kpi"><span class="kpi-label">Grâce à la plateforme</span><span class="kpi-val mono">${st.viaTotal}</span><span class="small muted">${pct(st.totalFound ? st.viaTotal / st.totalFound : 0)} des réussites, vérifiées par un lauréat</span></div>
      <div class="kpi"><span class="kpi-label">En validation</span><span class="kpi-val mono">${pendingAll}</span><span class="small muted">en attente de confirmation du lauréat</span></div>
      <div class="kpi"><span class="kpi-label">Offres ouvertes</span><span class="kpi-val mono">${openOffers}</span><span class="small muted">publiées par ${new Set(data.offers.filter(o => o.status === 'ouverte').map(o => o.author_id)).size} lauréats</span></div>
    </div>

    <div class="niv-grid">${st.rows.map(r => {
      const pace = r.elapsed; const gap = r.rate - pace;
      const tone = r.rate >= 0.999 ? 'good' : r.daysLeft < 0 ? (r.rate >= 0.9 ? 'good' : 'bad') : gap >= -0.05 ? 'good' : gap >= -0.25 ? 'warn' : 'bad';
      const toneTxt = r.rate >= 0.999 ? 'Objectif atteint' : r.daysLeft < 0 ? 'Saison terminée' : tone === 'good' ? 'Dans les temps' : tone === 'warn' ? 'À surveiller' : 'En retard';
      return html`<button class=${'niv-card' + (niv === r.n ? ' on' : '')} onClick=${() => setNiv(r.n)} aria-pressed=${niv === r.n}>
        <div class="niv-top"><span class="niv-badge">${NIVEAUX[r.n].short}</span><span class=${'status s-' + tone}><span class="sdot"></span>${toneTxt}</span></div>
        <strong class="niv-obj">${r.objectif.titre}</strong>
        <div class="niv-num"><span class="mono big">${pct(r.rate)}</span><span class="muted small">${r.found} sur ${r.total}${r.pending ? ` · ${r.pending} en validation` : ''}</span></div>
        <${Bar} value=${r.rate} pace=${r.daysLeft >= 0 ? pace : undefined} label=${`${pct(r.rate)} ont trouvé`}/>
        <span class="small muted">${r.daysLeft >= 0 ? `Échéance ${r.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · J-${r.daysLeft}` : `Échéance passée (${r.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })})`} · ${r.via} via la plateforme</span>
      </button>`;
    })}</div>
    <p class="legend small muted"><span class="lg-fill"></span> part des étudiants qui ont trouvé <span class="lg-pace"></span> rythme attendu à cette date (temps écoulé vers l’échéance)</p>

    <div class="two-col">
      <div class="panel">
        <div class="section-head"><h2>Par filière</h2><span class="muted small">${NIVEAUX[niv].label} · ${row.objectif.court}</span></div>
        <table class="tbl heat"><thead><tr><th>Filière</th><th class="num">Trouvé</th><th>Progression</th></tr></thead><tbody>
          ${row.byFiliere.map(f => html`<tr><td>${f.filiere}</td><td class="num mono">${f.found}/${f.total}</td><td class="bar-cell"><${Bar} value=${f.total ? f.found / f.total : 0}/></td></tr>`)}
        </tbody></table>
      </div>
      <div class="panel">
        <div class="section-head"><h2>Encore en recherche</h2><span class="muted small">${row.searching.length} · ${NIVEAUX[niv].short}</span></div>
        ${canSeeNames ? html`<p class="muted small">Un message ou une offre ciblée peut tout changer pour eux.</p>
          <ul class="people-list">${row.searching.slice(0, 12).map(p => { const s = statutOf(data, p, saison); return html`<li><${Person} p=${p} onOpen=${openProfile} size=${30}/><span class=${'state-pill s-' + s.key}>${s.label}</span></li>`; })}</ul>
          ${row.searching.length > 12 ? html`<p class="small muted">et ${row.searching.length - 12} autres (voir la Vitrine des talents dans Communauté).</p>` : null}`
        : html`<p class="muted">${row.searching.length} étudiant${row.searching.length > 1 ? 's' : ''} de ${NIVEAUX[niv].short} cherchent encore. Les lauréats voient la liste des profils ouverts dans la Vitrine des talents pour leur proposer des offres.</p>`}
      </div>
    </div>

    <div class="panel">
      <div class="section-head"><h2>Activité des 12 derniers mois</h2>
        <span class="legend small"><span class="sw s1"></span> Offres publiées <span class="sw s2"></span> Réussites confirmées par un lauréat</span></div>
      <${MonthChart} months=${months}/>
    </div>

    <div class="two-col">
      <div class="panel"><div class="section-head"><h2>Destinations à l’étranger</h2><span class="muted small">${seasonLabel(saison)}</span></div>
        ${st.countries.length ? html`<ol class="rank">${st.countries.slice(0, 6).map(([c, k]) => html`<li><span>${c}</span><span class="mono">${k}</span></li>`)}</ol>` : html`<p class="muted">Aucun départ à l’étranger déclaré pour l’instant.</p>`}</div>
      <div class="panel"><div class="section-head"><h2>Entreprises qui accueillent</h2><span class="muted small">${seasonLabel(saison)}</span></div>
        <ol class="rank">${st.companies.slice(0, 6).map(([c, k]) => html`<li><span>${c}</span><span class="mono">${k}</span></li>`)}</ol></div>
    </div>
    ${me.role === 'admin' ? html`<${ExportBox} data=${data} saison=${saison} rows=${st.rows}/>` : null}
  </section>`;
}

function MonthChart({ months }) {
  const W = 720, H = 220, L = 34, B = 26, T = 12;
  const max = Math.max(4, ...months.flatMap(m => [m.offres, m.placements]));
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const y = v => T + (H - T - B) * (1 - v / top);
  const gw = (W - L) / months.length, bw = Math.min(16, gw / 3.2);
  const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
  return html`<div class="chart-wrap"><svg viewBox=${`0 0 ${W} ${H}`} class="chart" role="img" aria-label="Offres publiées et réussites confirmées par mois">
    ${ticks.map(v => html`<g><line x1=${L} x2=${W} y1=${y(v)} y2=${y(v)} class="grid"/><text x=${L - 6} y=${y(v) + 4} class="axis" text-anchor="end">${v}</text></g>`)}
    ${months.map((m, i) => { const x = L + i * gw + gw / 2; return html`<g>
      <rect x=${x - bw - 1} y=${y(m.offres)} width=${bw} height=${Math.max(0, y(0) - y(m.offres))} rx="3" class="s1"><title>${m.label} : ${m.offres} offres publiées</title></rect>
      <rect x=${x + 1} y=${y(m.placements)} width=${bw} height=${Math.max(0, y(0) - y(m.placements))} rx="3" class="s2"><title>${m.label} : ${m.placements} réussites confirmées</title></rect>
      <text x=${x} y=${H - 8} class="axis" text-anchor="middle">${m.label}</text></g>`; })}
  </svg></div>`;
}

function ExportBox({ data, saison, rows }) {
  const [href, setHref] = useState(null);
  const build = () => {
    const lines = [['Nom', 'Niveau', 'Filière', 'Promo', 'Statut', 'Entreprise', 'Ville', 'Pays', 'Source', 'Vérifié']];
    for (const r of rows) for (const p of data.profiles.filter(x => x.role !== 'admin')) {
      const n = r.n; const lvl = (5 - (p.promo - (saison + 1)));
      const pn = lvl <= 5 ? lvl : p.promo === saison ? 6 : 7; if (pn !== n) continue;
      const pl = data.placements.find(x => x.student_id === p.id && x.saison === saison && x.status !== 'refuse');
      lines.push([p.full_name, NIVEAUX[n].short, p.filiere, p.promo, pl ? (FOUND.has(pl.status) ? 'Trouvé' : 'En validation') : 'En recherche', pl?.entreprise || '', pl?.ville || '', pl?.pays || '', pl ? (pl.source === 'plateforme' ? 'Plateforme' : 'Autre') : '', pl?.status === 'confirme' ? 'Oui' : '']);
    }
    const csv = '﻿' + lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    setHref(URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })));
  };
  return html`<div class="panel"><div class="section-head"><h2>Export administration</h2></div>
    <p class="muted small">Liste complète de la saison (une ligne par étudiant), à ouvrir dans Excel.</p>
    ${href ? html`<a class="btn" href=${href} download=${`suivi-placement-${seasonLabel(saison)}.csv`}><${Icon} name="download"/> Télécharger le fichier CSV</a>` : html`<button class="btn" onClick=${build}>Préparer l’export ${seasonLabel(saison)}</button>`}
  </div>`;
}
