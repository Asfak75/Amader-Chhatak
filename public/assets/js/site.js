/* ============================================================
 * site.js — পাঠকের সাইট: রাউটার, হোম, বিভাগ, সংবাদ, সার্চ, ফুটার পাতা
 * ============================================================ */
(() => {
  const app = $('#app');
  const FIELDS = 'id,title,slug,category,excerpt,image_url,author,published_at';
  const PAGE = 12;
  const HOME_SECTIONS = ['chhatak', 'national', 'politics', 'sports', 'education'];
  const DEFAULT_TITLE = 'আমাদের ছাতক — সত্যের সন্ধানে, মানুষের পাশে';
  const DEFAULT_DESC = 'ছাতক, সুনামগঞ্জ ও সারা দেশের সর্বশেষ সংবাদ, রাজনীতি, খেলাধুলা, শিক্ষা ও চাকরির খবর — আমাদের ছাতক।';
  const STATIC = { about: 'আমাদের সম্পর্কে', contact: 'যোগাযোগ', privacy: 'গোপনীয়তা নীতি', terms: 'ব্যবহারের শর্তাবলি' };
  const MSG_FAIL = 'সংবাদ লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
  const MSG_EMPTY = 'এই বিভাগে এখনো কোনো সংবাদ প্রকাশিত হয়নি।';
  let CATS = [], CATMAP = {}, S = {};

  /* শুধু প্রকাশিত ও সময় হয়ে যাওয়া সংবাদ (RLS-ও একই নিয়ম মানে) */
  const pub = () => sb.from('news').select(FIELDS).eq('status', 'published')
    .lte('published_at', new Date().toISOString()).order('published_at', { ascending: false });

  const newsUrl = n => '/news/' + encodeURIComponent(n.slug);
  const catName = s => (CATMAP[s] || {}).name || 'অন্যান্য';
  const msg = t => `<div class="msg">${esc(t)}</div>`;
  const img = (n, eager) => n.image_url
    ? `<img src="${esc(n.image_url)}" alt="${esc(n.title)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
    : '<div class="ph">আমাদের ছাতক</div>';

  const card = n => `<article class="card">
    <a href="${newsUrl(n)}" data-link class="ratio" tabindex="-1" aria-hidden="true">${img(n)}</a>
    <a class="cat" href="/category/${encodeURIComponent(n.category)}" data-link>${esc(catName(n.category))}</a>
    <h3><a href="${newsUrl(n)}" data-link>${esc(n.title)}</a></h3>
    <time>${fmtDT(n.published_at)}</time>
    ${n.excerpt ? `<p>${esc(n.excerpt)}</p>` : ''}</article>`;

  const sideItem = n => `<article class="side-item">
    <a href="${newsUrl(n)}" data-link class="ratio" tabindex="-1" aria-hidden="true">${img(n)}</a>
    <div><a class="cat" href="/category/${encodeURIComponent(n.category)}" data-link>${esc(catName(n.category))}</a>
    <h3><a href="${newsUrl(n)}" data-link>${esc(n.title)}</a></h3><time>${fmtDT(n.published_at)}</time></div></article>`;

  /* ---------- SEO (ক্লায়েন্ট সাইড; সংবাদের জন্য সার্ভারও বসায়) ---------- */
  function tag(sel, make, attr, val) {
    let el = $(sel);
    if (!el) { el = make(); document.head.appendChild(el); }
    el.setAttribute(attr, val);
  }
  const metaTag = (key, val, attr = 'property') => tag(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement('meta'); m.setAttribute(attr, key); return m;
  }, 'content', val);
  function setMeta({ title, desc, image, type } = {}) {
    const t = title ? title + ' | আমাদের ছাতক' : DEFAULT_TITLE;
    const d = desc || DEFAULT_DESC;
    const url = location.origin + location.pathname;
    document.title = t;
    metaTag('description', d, 'name');
    metaTag('og:title', title || DEFAULT_TITLE); metaTag('og:description', d);
    metaTag('og:type', type || 'website'); metaTag('og:url', url);
    if (image) metaTag('og:image', image);
    tag('link[rel=canonical]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }, 'href', url);
  }

  /* ---------- হোম ---------- */
  async function home() {
    setMeta();
    app.innerHTML = msg('লোড হচ্ছে…');
    const { data, error } = await pub().limit(14);
    if (error) return (app.innerHTML = msg(MSG_FAIL));
    if (!data.length) return (app.innerHTML = msg(MSG_EMPTY));
    const [lead, ...rest] = data;
    let html = `<section class="hero"><article class="lead">
      <a href="${newsUrl(lead)}" data-link class="ratio">${img(lead, true)}</a>
      <a class="cat" href="/category/${encodeURIComponent(lead.category)}" data-link>${esc(catName(lead.category))}</a>
      <h2><a href="${newsUrl(lead)}" data-link>${esc(lead.title)}</a></h2>
      <time>${fmtDT(lead.published_at)}</time>${lead.excerpt ? `<p>${esc(lead.excerpt)}</p>` : ''}</article>
      <div class="side">${rest.slice(0, 4).map(sideItem).join('')}</div></section>`;
    const latest = rest.slice(4);
    if (latest.length) html += `<section class="sec"><div class="sec-head"><h2 class="sec-title">সর্বশেষ সংবাদ</h2>
      <a class="sec-more" href="/latest" data-link>সব সংবাদ দেখুন →</a></div><div class="grid">${latest.map(card).join('')}</div></section>`;
    app.innerHTML = html;

    const results = await Promise.all(HOME_SECTIONS.map(s => pub().eq('category', s).limit(4)));
    results.forEach((r, i) => {
      if (r.error || !r.data.length) return;
      const slug = HOME_SECTIONS[i];
      app.insertAdjacentHTML('beforeend', `<section class="sec"><div class="sec-head"><h2 class="sec-title">${esc(catName(slug))}</h2></div>
        <div class="grid">${r.data.map(card).join('')}</div>
        <div class="sec-foot"><a class="sec-more" href="/category/${encodeURIComponent(slug)}" data-link>সব সংবাদ দেখুন →</a></div></section>`);
    });
  }

  /* ---------- তালিকা (সর্বশেষ / বিভাগ / সার্চ) — "আরও সংবাদ" বোতামসহ ---------- */
  async function listPage(title, build, emptyText) {
    let page = 0;
    app.innerHTML = `<h1 class="sec-title">${esc(title)}</h1><div class="grid" id="grid"></div><div class="more" id="more"></div>`;
    const grid = $('#grid'), more = $('#more');
    const load = async () => {
      more.innerHTML = '';
      const from = page * PAGE;
      const { data, error } = await build().range(from, from + PAGE - 1);
      if (error) { more.innerHTML = msg(MSG_FAIL); return; }
      if (!page && !data.length) { grid.remove(); more.innerHTML = msg(emptyText || MSG_EMPTY); return; }
      grid.insertAdjacentHTML('beforeend', data.map(card).join(''));
      if (data.length === PAGE) {
        more.innerHTML = '<button type="button">আরও সংবাদ দেখুন</button>';
        $('button', more).onclick = e => { e.target.disabled = true; page++; load(); };
      }
    };
    load();
  }

  const searchView = q => {
    setMeta({ title: 'অনুসন্ধান: ' + q });
    const safe = q.replace(/[,()%*\\]/g, ' ').trim();
    if (!safe) return (app.innerHTML = msg('খোঁজার জন্য একটি শব্দ লিখুন।'));
    listPage(`“${q}” — অনুসন্ধানের ফলাফল`, () =>
      pub().or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%,content.ilike.%${safe}%`), 'এই শব্দে কোনো সংবাদ পাওয়া যায়নি।');
  };

  /* ---------- সংবাদের বিস্তারিত ---------- */
  async function article(slug) {
    app.innerHTML = msg('লোড হচ্ছে…');
    const { data: n, error } = await sb.from('news').select('*').eq('slug', slug).eq('status', 'published')
      .lte('published_at', new Date().toISOString()).maybeSingle();
    if (error) return (app.innerHTML = msg(MSG_FAIL));
    if (!n) return (app.innerHTML = msg('সংবাদটি খুঁজে পাওয়া যায়নি।'));
    const url = location.origin + '/news/' + encodeURIComponent(n.slug);
    setMeta({ title: n.title, desc: (n.excerpt || plainText(n.content)).slice(0, 160), image: n.image_url, type: 'article' });
    app.innerHTML = `<article class="art">
      <a class="cat" href="/category/${encodeURIComponent(n.category)}" data-link>${esc(catName(n.category))}</a>
      <h1>${esc(n.title)}</h1>
      <div class="byline">${n.author ? `<span>লেখক: ${esc(n.author)}</span>` : ''}
        <span>প্রকাশের তারিখ: ${fmtDate(n.published_at)}</span><span>প্রকাশের সময়: ${fmtTime(n.published_at)}</span></div>
      ${n.image_url ? `<figure class="cover" style="margin:18px 0"><img src="${esc(n.image_url)}" alt="${esc(n.title)}" fetchpriority="high"></figure>` : ''}
      <div class="body">${sanitize(n.content)}</div>
      <div class="share"><b>শেয়ার করুন:</b>
        <a class="btn fb" target="_blank" rel="noopener" title="ফেসবুকে শেয়ার করুন" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">ফেসবুক</a>
        <a class="btn wa" target="_blank" rel="noopener" title="হোয়াটসঅ্যাপে শেয়ার করুন" href="https://wa.me/?text=${encodeURIComponent(n.title + ' ' + url)}">হোয়াটসঅ্যাপ</a>
        <button class="btn cp" type="button" id="copyLink" title="লিংক কপি করুন">লিংক কপি করুন</button></div>
      <section class="sec" id="related" hidden><div class="sec-head"><h2 class="sec-title">সম্পর্কিত সংবাদ</h2></div><div class="grid"></div></section></article>`;
    $('#copyLink').onclick = async e => {
      try { await navigator.clipboard.writeText(url); e.target.textContent = 'লিংক কপি হয়েছে ✓'; }
      catch { prompt('লিংক কপি করুন:', url); }
    };
    const r = await pub().eq('category', n.category).neq('id', n.id).limit(4);
    if (!r.error && r.data.length) { $('#related').hidden = false; $('#related .grid').innerHTML = r.data.map(card).join(''); }
  }

  /* ---------- ফুটারের পাতা ---------- */
  function staticPage(key) {
    const title = STATIC[key];
    if (!title) return notFound();
    setMeta({ title });
    const text = (S[key] || '').trim();
    const body = text ? text.split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') : '<p>এই পাতার তথ্য শীঘ্রই যুক্ত করা হবে।</p>';
    app.innerHTML = `<div class="static"><h1 class="sec-title">${esc(title)}</h1><div class="body">${body}</div></div>`;
  }
  const notFound = () => { setMeta({ title: 'পাতা পাওয়া যায়নি' }); app.innerHTML = msg('দুঃখিত, পাতাটি খুঁজে পাওয়া যায়নি।'); };

  /* ---------- রাউটার ---------- */
  async function route() {
    $('#nav').classList.remove('open');
    $('#searchForm').hidden = true;
    window.scrollTo(0, 0);
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const seg = path.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch { return s; } });
    $$('#navList a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === path));
    if (!seg.length) return home();
    if (seg[0] === 'latest') { setMeta({ title: 'সর্বশেষ সংবাদ' }); return listPage('সর্বশেষ সংবাদ', pub); }
    if (seg[0] === 'category' && seg[1]) {
      const name = catName(seg[1]);
      setMeta({ title: name });
      return listPage(name, () => pub().eq('category', seg[1]), MSG_EMPTY);
    }
    if (seg[0] === 'news' && seg[1]) return article(seg[1]);
    if (seg[0] === 'search') return searchView((new URLSearchParams(location.search).get('q') || '').trim());
    if (seg[0] === 'page' && seg[1]) return staticPage(seg[1]);
    notFound();
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-link]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    history.pushState(null, '', a.getAttribute('href'));
    route();
  });
  window.addEventListener('popstate', route);

  /* ---------- হেডার: মেনু, সার্চ, জরুরি সংবাদ ---------- */
  $('#menuBtn').onclick = () => $('#nav').classList.toggle('open');
  $('#searchBtn').onclick = () => { const f = $('#searchForm'); f.hidden = !f.hidden; if (!f.hidden) $('#searchInput').focus(); };
  $('#searchForm').onsubmit = e => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    if (!q) return;
    history.pushState(null, '', '/search?q=' + encodeURIComponent(q));
    route();
  };
  $('#today').textContent = new Date().toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function buildNav() {
    const items = [['/', 'হোম'], ['/latest', 'সর্বশেষ']]
      .concat(CATS.filter(c => c.slug !== 'others').map(c => ['/category/' + encodeURIComponent(c.slug), c.name]));
    $('#navList').innerHTML = items.map(([h, t]) => `<li><a href="${h}" data-link>${esc(t)}</a></li>`).join('');
  }
  function buildTicker() {
    const items = (S.breaking_news || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (S.breaking_enabled === 'false' || !items.length) return;
    const mv = $('#tickerMove');
    mv.innerHTML = items.map(t => `<span>● ${esc(t)}</span>`).join('');
    mv.style.animationDuration = Math.max(20, items.join('').length * 0.3) + 's';
    $('#ticker').hidden = false;
  }

  /* ---------- চালু ---------- */
  (async () => {
    try {
      const [c, s] = await Promise.all([
        sb.from('categories').select('*').order('sort_order'),
        sb.from('site_settings').select('key,value'),
      ]);
      CATS = c.data || []; CATMAP = Object.fromEntries(CATS.map(x => [x.slug, x]));
      S = Object.fromEntries((s.data || []).map(x => [x.key, x.value]));
    } catch (_) { /* নেটওয়ার্ক সমস্যা হলেও পাতা চালু হবে */ }
    buildNav(); buildTicker(); route();
  })();
})();
