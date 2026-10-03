/* ============================================================
 * admin.js — অ্যাডমিন প্যানেল (/admin)
 * লগইন: Supabase Auth (ই-মেইল + পাসওয়ার্ড)। পাসওয়ার্ড কোডে নেই।
 * আসল নিরাপত্তা: Supabase RLS — লগইন ছাড়া কেউ সংবাদ লিখতে/মুছতে পারে না।
 * ============================================================ */
const root = $('#root');
let CATS = [];
let listFilter = 'all';
let savedRange = null;
const PAGE = 30;

/* ---------- ছোট সহায়ক ---------- */
function toast(text, bad) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = text;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
const bn = n => Number(n || 0).toLocaleString('bn-BD');
const catName = s => (CATS.find(c => c.slug === s) || {}).name || s;
function confirmBox(text, okText, cancelText) {
  return new Promise(res => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div role="dialog" aria-modal="true"><p>${esc(text)}</p><div class="actions">
      <button class="btn ghost" data-v="0">${esc(cancelText)}</button><button class="btn red" data-v="1">${esc(okText)}</button></div></div>`;
    m.onclick = e => { const b = e.target.closest('button'); if (b || e.target === m) { m.remove(); res(!!b && b.dataset.v === '1'); } };
    document.body.appendChild(m);
  });
}
const parts = iso => {
  const d = iso ? new Date(iso) : new Date(), p = n => String(n).padStart(2, '0');
  return { d: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, t: `${p(d.getHours())}:${p(d.getMinutes())}` };
};
async function getSettings() {
  const { data, error } = await sb.from('site_settings').select('key,value');
  if (error) throw error;
  return Object.fromEntries(data.map(x => [x.key, x.value]));
}
const saveSettings = obj => sb.from('site_settings').upsert(
  Object.entries(obj).map(([key, value]) => ({ key, value })), { onConflict: 'key' });

/* ---------- ছবি: ছোট করে WebP বানিয়ে Supabase Storage-এ আপলোড ---------- */
async function optimizeImage(file) {
  const bmp = await createImageBitmap(file);
  const MAX = 1600, k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.82));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  return blob;
}
async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('শুধু ছবির ফাইল দেওয়া যাবে।');
  if (file.size > 15 * 1024 * 1024) throw new Error('ছবির আকার ১৫ এমবির বেশি হতে পারবে না।');
  let blob;
  try { blob = await optimizeImage(file); } catch { throw new Error('ছবিটি পড়া যায়নি। অন্য একটি ছবি দিন।'); }
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const d = new Date();
  const path = `${d.getFullYear()}/${d.getMonth() + 1}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await sb.storage.from('news-images').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw new Error('ছবি আপলোড ব্যর্থ হয়েছে। ইন্টারনেট সংযোগ ও Storage সেটিংস পরীক্ষা করুন।');
  return sb.storage.from('news-images').getPublicUrl(path).data.publicUrl;
}

/* ---------- লগইন ---------- */
function loginView() {
  root.innerHTML = `<form class="login" id="lf"><h1>অ্যাডমিন লগইন</h1><p>আমাদের ছাতক</p>
    <label for="em">ই-মেইল</label><input id="em" type="email" required autocomplete="username">
    <label for="pw">পাসওয়ার্ড</label><input id="pw" type="password" required autocomplete="current-password">
    <div class="err" id="le" role="alert"></div>
    <div class="actions"><button class="btn" id="lb" type="submit">প্রবেশ করুন</button></div></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const b = $('#lb'); b.disabled = true; $('#le').textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
    if (error) { $('#le').textContent = 'ই-মেইল অথবা পাসওয়ার্ড সঠিক নয়।'; b.disabled = false; return; }
    shell();
  };
}

/* ---------- কাঠামো ---------- */
async function shell() {
  const { data } = await sb.from('categories').select('*').order('sort_order');
  CATS = data || [];
  root.innerHTML = `<div class="topbar"><button id="mb" aria-label="মেনু">☰</button><b>অ্যাডমিন ড্যাশবোর্ড</b></div>
  <div class="shell"><aside class="side" id="sd"><div class="brand">আমাদের ছাতক</div>
    <a href="#/">ড্যাশবোর্ড</a><a href="#/new">নতুন সংবাদ</a><a href="#/list">সকল সংবাদ</a>
    <a href="#/categories">বিভাগ</a><a href="#/breaking">জরুরি সংবাদ</a><a href="#/settings">সেটিংস</a>
    <button class="lnk" id="lo">লগআউট</button></aside><main class="main" id="view"></main></div>`;
  $('#mb').onclick = () => $('#sd').classList.toggle('open');
  $('#lo').onclick = async () => { await sb.auth.signOut(); loginView(); };
  if (!shell.bound) { window.addEventListener('hashchange', view); shell.bound = true; }
  view();
}
async function view() {
  if (!$('#view')) return;
  $('#sd').classList.remove('open');
  const h = location.hash.replace(/^#/, '') || '/';
  $$('#sd a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + h));
  const v = $('#view');
  v.innerHTML = '<p class="center">লোড হচ্ছে…</p>';
  try {
    if (h === '/') return await dashboardView(v);
    if (h === '/new') return editorView(v, null);
    if (h.startsWith('/edit/')) return await editorView(v, h.slice(6));
    if (h === '/list') return await listView(v);
    if (h === '/categories') return await categoriesView(v);
    if (h === '/breaking') return await breakingView(v);
    if (h === '/settings') return await settingsView(v);
    v.innerHTML = '<p class="center">পাতা পাওয়া যায়নি।</p>';
  } catch (e) {
    v.innerHTML = '<p class="center">তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।</p>';
  }
}

/* ---------- ড্যাশবোর্ড ---------- */
const count = async q => { const { count, error } = await q; if (error) throw error; return count; };
async function dashboardView(v) {
  const head = { count: 'exact', head: true };
  const [all, pubd, draft, cats, recent] = await Promise.all([
    count(sb.from('news').select('*', head)),
    count(sb.from('news').select('*', head).eq('status', 'published')),
    count(sb.from('news').select('*', head).eq('status', 'draft')),
    count(sb.from('categories').select('*', head)),
    sb.from('news').select('id,title,category,status,published_at,image_url').order('created_at', { ascending: false }).limit(5),
  ]);
  v.innerHTML = `<h1>অ্যাডমিন ড্যাশবোর্ড</h1>
    <p><a class="btn red" href="#/new">+ নতুন সংবাদ</a></p>
    <div class="stats">
      <div class="stat"><b>${bn(all)}</b><span>মোট সংবাদ</span></div>
      <div class="stat"><b>${bn(pubd)}</b><span>প্রকাশিত সংবাদ</span></div>
      <div class="stat"><b>${bn(draft)}</b><span>খসড়া সংবাদ</span></div>
      <div class="stat"><b>${bn(cats)}</b><span>মোট বিভাগ</span></div></div>
    <h2>সাম্প্রতিক সংবাদ</h2><div id="rl"></div>`;
  $('#rl').innerHTML = (recent.data || []).map(itemRow).join('') || '<p>এখনো কোনো সংবাদ নেই।</p>';
  bindRows($('#rl'), () => dashboardView(v));
}

/* ---------- সকল সংবাদ ---------- */
const itemRow = n => `<div class="item" data-id="${n.id}">
  ${n.image_url ? `<img class="th" src="${esc(n.image_url)}" alt="" loading="lazy">` : '<div class="th"></div>'}
  <div><h3>${esc(n.title)}</h3><div class="m">${esc(catName(n.category))} · ${fmtDT(n.published_at)} ·
    <span class="badge ${n.status === 'published' ? 'p' : 'd'}">${n.status === 'published' ? 'প্রকাশিত' : 'খসড়া'}</span></div></div>
  <div class="ops"><a class="btn sm" href="#/edit/${n.id}">সম্পাদনা</a><button class="btn sm red" data-del>মুছে ফেলুন</button></div></div>`;
function bindRows(box, reload) {
  box.onclick = async e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const id = b.closest('.item').dataset.id;
    if (!await confirmBox('আপনি কি এই সংবাদটি মুছে ফেলতে চান?', 'মুছে ফেলুন', 'বাতিল করুন')) return;
    const { error } = await sb.from('news').delete().eq('id', id);
    if (error) return toast('সংবাদ মোছা যায়নি। আবার চেষ্টা করুন।', true);
    toast('সংবাদটি মুছে ফেলা হয়েছে।'); reload();
  };
}
async function listView(v) {
  v.innerHTML = `<h1>সকল সংবাদ</h1><p><a class="btn red" href="#/new">+ নতুন সংবাদ</a></p>
    <div class="tabs">${[['all', 'সব'], ['published', 'প্রকাশিত'], ['draft', 'খসড়া']]
      .map(([k, t]) => `<button data-f="${k}" class="${listFilter === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div id="ls"></div><div class="center" id="mo"></div>`;
  $$('.tabs button', v).forEach(b => b.onclick = () => { listFilter = b.dataset.f; listView(v); });
  let page = 0;
  const load = async () => {
    let q = sb.from('news').select('id,title,category,status,published_at,image_url').order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (listFilter !== 'all') q = q.eq('status', listFilter);
    const { data, error } = await q;
    if (error) throw error;
    if (!page && !data.length) $('#ls').innerHTML = '<p class="center">কোনো সংবাদ পাওয়া যায়নি।</p>';
    $('#ls').insertAdjacentHTML('beforeend', data.map(itemRow).join(''));
    $('#mo').innerHTML = data.length === PAGE ? '<button class="btn ghost">আরও দেখুন</button>' : '';
    if (data.length === PAGE) $('#mo button').onclick = () => { page++; load(); };
  };
  await load();
  bindRows($('#ls'), () => listView(v));
}

/* ---------- নতুন সংবাদ / সম্পাদনা ---------- */
const TOOLS = [
  ['B', 'বোল্ড (মোটা)', 'bold'], ['I', 'ইটালিক (বাঁকা)', 'italic'],
  ['শিরোনাম', 'উপশিরোনাম', 'formatBlock', 'h2'], ['অনুচ্ছেদ', 'সাধারণ অনুচ্ছেদ', 'formatBlock', 'p'],
  ['• তালিকা', 'বুলেট তালিকা', 'insertUnorderedList'], ['১. তালিকা', 'ক্রমিক তালিকা', 'insertOrderedList'],
  ['লিংক', 'লিংক যোগ করুন', 'link'], ['ছবি', 'ছবি যোগ করুন', 'image'],
  ['বামে', 'বামে সাজান', 'justifyLeft'], ['মাঝে', 'মাঝখানে সাজান', 'justifyCenter'],
  ['ডানে', 'ডানে সাজান', 'justifyRight'], ['সমান', 'দুই পাশ সমান করুন', 'justifyFull'],
];
async function editorView(v, id) {
  let n = { title: '', category: CATS[0] ? CATS[0].slug : '', excerpt: '', content: '', image_url: '', author: '', status: 'draft', published_at: null };
  if (id) {
    const { data, error } = await sb.from('news').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) { v.innerHTML = '<p class="center">সংবাদটি পাওয়া যায়নি।</p>'; return; }
    n = data;
  }
  const dt = parts(n.published_at);
  let imageUrl = n.image_url || '';
  v.innerHTML = `<h1>${id ? 'সংবাদ সম্পাদনা' : 'নতুন সংবাদ'}</h1><form class="panel" id="nf" novalidate>
    <label for="t">সংবাদের শিরোনাম</label><input id="t" type="text" value="${esc(n.title)}">
    <label for="c">বিভাগ নির্বাচন করুন</label><select id="c">${CATS.map(c => `<option value="${esc(c.slug)}" ${c.slug === n.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label for="x">সংক্ষিপ্ত বিবরণ</label><textarea id="x" style="min-height:80px">${esc(n.excerpt || '')}</textarea>
    <label>সংবাদের বিস্তারিত</label>
    <div class="tb" id="tb">${TOOLS.map((t, i) => `<button type="button" data-i="${i}" title="${t[1]}">${t[0]}</button>`).join('')}</div>
    <div class="ed" id="ed" contenteditable="true" role="textbox" aria-multiline="true"></div>
    <label>প্রধান ছবি</label><input type="file" id="img" accept="image/*">
    <div class="hint" id="is"></div><div class="cover-prev" id="ip"></div>
    <div class="row"><div><label for="a">লেখকের নাম</label><input id="a" type="text" value="${esc(n.author || '')}"></div>
      <div><label for="d">প্রকাশের তারিখ</label><input id="d" type="date" value="${dt.d}"></div>
      <div><label for="tm">প্রকাশের সময়</label><input id="tm" type="time" value="${dt.t}"></div>
      <div><label for="s">স্ট্যাটাস</label><select id="s"><option value="draft">খসড়া</option><option value="published">প্রকাশিত</option></select></div></div>
    <div class="err" id="er" role="alert"></div>
    <div class="actions"><button type="button" class="btn ghost" data-save="draft">খসড়া সংরক্ষণ করুন</button>
      <button type="button" class="btn red" data-save="published">প্রকাশ করুন</button></div>
    <input type="file" id="eimg" accept="image/*" hidden></form>`;
  const ed = $('#ed');
  ed.innerHTML = sanitize(n.content);
  $('#s').value = n.status;
  document.execCommand('defaultParagraphSeparator', false, 'p');

  /* প্রধান ছবি */
  const showImg = () => { $('#ip').innerHTML = imageUrl ? `<img src="${esc(imageUrl)}" alt="প্রধান ছবির প্রিভিউ"><p><button type="button" class="btn sm ghost" id="rm">ছবি সরান</button></p>` : ''; if (imageUrl) $('#rm').onclick = () => { imageUrl = ''; showImg(); }; };
  showImg();
  $('#img').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#is').textContent = 'ছবি আপলোড হচ্ছে… অনুগ্রহ করে অপেক্ষা করুন';
    try { imageUrl = await uploadImage(f); $('#is').textContent = 'ছবি আপলোড সফল হয়েছে ✓'; showImg(); }
    catch (err) { $('#is').textContent = ''; toast(err.message, true); }
    e.target.value = '';
  };

  /* রিচ টেক্সট এডিটর */
  const restore = () => { ed.focus(); if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };
  const keep = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); };
  ed.addEventListener('keyup', keep); ed.addEventListener('mouseup', keep); ed.addEventListener('blur', keep);
  ed.addEventListener('paste', e => { /* বাইরের ফরম্যাটিং বাদ দিয়ে শুধু লেখা বসবে */
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertHTML', false, text.split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join(''));
  });
  $('#tb').addEventListener('mousedown', e => e.preventDefault());
  $('#tb').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const [, , cmd, arg] = TOOLS[b.dataset.i];
    restore();
    if (cmd === 'link') {
      const u = prompt('লিংকের ঠিকানা লিখুন (যেমন: https://example.com):');
      if (!u) return;
      if (!/^https?:\/\//i.test(u)) return toast('লিংক অবশ্যই http:// বা https:// দিয়ে শুরু হতে হবে।', true);
      if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(u)}">${esc(u)}</a>`);
      else document.execCommand('createLink', false, u);
    } else if (cmd === 'image') $('#eimg').click();
    else document.execCommand(cmd, false, arg);
  };
  $('#eimg').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    toast('ছবি আপলোড হচ্ছে…');
    try { const u = await uploadImage(f); restore(); document.execCommand('insertImage', false, u); toast('ছবি যোগ হয়েছে।'); }
    catch (err) { toast(err.message, true); }
    e.target.value = '';
  };

  /* সংরক্ষণ */
  $$('[data-save]', v).forEach(b => b.onclick = async () => {
    const status = b.dataset.save; $('#s').value = status;
    const err = $('#er'); err.textContent = '';
    const title = $('#t').value.trim();
    const content = sanitize(ed.innerHTML);
    if (!title) return (err.textContent = 'সংবাদের শিরোনাম লিখুন।');
    if (!plainText(content) && !/<img/i.test(content)) return (err.textContent = 'সংবাদের বিস্তারিত লিখুন।');
    if (!$('#c').value) return (err.textContent = 'বিভাগ নির্বাচন করুন।');
    const d = $('#d').value || parts().d, tm = $('#tm').value || parts().t;
    const row = {
      title, category: $('#c').value, excerpt: $('#x').value.trim() || null, content,
      image_url: imageUrl || null, author: $('#a').value.trim() || null, status,
      published_at: new Date(`${d}T${tm}`).toISOString(),
    };
    $$('[data-save]', v).forEach(x => x.disabled = true);
    const res = id ? await sb.from('news').update(row).eq('id', id)
                   : await sb.from('news').insert({ ...row, slug: makeSlug(title) });
    $$('[data-save]', v).forEach(x => x.disabled = false);
    if (res.error) return (err.textContent = 'সংবাদ সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন। (প্রয়োজনে পুনরায় লগইন করুন)');
    toast(status === 'published' ? 'সংবাদ প্রকাশিত হয়েছে।' : 'খসড়া সংরক্ষিত হয়েছে।');
    location.hash = '#/list';
  });
}

/* ---------- বিভাগ ---------- */
async function categoriesView(v) {
  const { data, error } = await sb.from('categories').select('*').order('sort_order');
  if (error) throw error; CATS = data;
  v.innerHTML = `<h1>বিভাগ</h1><div class="panel"><p class="hint">নাম ও ক্রম বদলে “সংরক্ষণ” চাপুন। যে বিভাগে সংবাদ আছে তা মোছা যাবে না।</p>
    ${data.map(c => `<div class="row" style="align-items:end;margin-bottom:8px" data-s="${esc(c.slug)}">
      <div style="flex:3"><label>নাম</label><input type="text" value="${esc(c.name)}" data-n></div>
      <div style="flex:1"><label>ক্রম</label><input type="text" inputmode="numeric" value="${c.sort_order}" data-o></div>
      <div style="flex:2;display:flex;gap:8px;min-width:190px"><button class="btn sm" data-sv>সংরক্ষণ</button><button class="btn sm red" data-rm>মুছুন</button></div></div>`).join('')}</div>
    <div class="panel"><h2 style="margin-top:0">নতুন বিভাগ</h2><div class="row" style="align-items:end">
      <div style="flex:3"><label for="nn">বিভাগের নাম</label><input id="nn" type="text"></div>
      <div style="flex:1"><button class="btn" id="na">যোগ করুন</button></div></div></div>`;
  v.onclick = async e => {
    const row = e.target.closest('[data-s]');
    if (row && e.target.matches('[data-sv]')) {
      const { error } = await sb.from('categories').update({ name: $('[data-n]', row).value.trim(), sort_order: parseInt($('[data-o]', row).value, 10) || 0 }).eq('slug', row.dataset.s);
      return error ? toast('সংরক্ষণ করা যায়নি।', true) : toast('বিভাগ সংরক্ষিত হয়েছে।');
    }
    if (row && e.target.matches('[data-rm]')) {
      if (!await confirmBox('আপনি কি এই বিভাগটি মুছে ফেলতে চান?', 'মুছে ফেলুন', 'বাতিল করুন')) return;
      const { error } = await sb.from('categories').delete().eq('slug', row.dataset.s);
      if (error) return toast('এই বিভাগে সংবাদ আছে, তাই মোছা যায়নি।', true);
      toast('বিভাগ মুছে ফেলা হয়েছে।'); categoriesView(v);
    }
    if (e.target.id === 'na') {
      const name = $('#nn').value.trim(); if (!name) return toast('বিভাগের নাম লিখুন।', true);
      const slug = makeSlug(name);
      const { error } = await sb.from('categories').insert({ slug, name, sort_order: data.length + 1 });
      if (error) return toast('বিভাগ যোগ করা যায়নি।', true);
      toast('নতুন বিভাগ যোগ হয়েছে।'); categoriesView(v);
    }
  };
}

/* ---------- জরুরি সংবাদ ---------- */
async function breakingView(v) {
  const s = await getSettings();
  v.innerHTML = `<h1>জরুরি সংবাদ</h1><div class="panel">
    <label><input type="checkbox" id="be" ${s.breaking_enabled !== 'false' ? 'checked' : ''}> জরুরি সংবাদ বার চালু রাখুন</label>
    <label for="bt">জরুরি সংবাদের লেখা (প্রতি লাইনে একটি)</label><textarea id="bt">${esc(s.breaking_news || '')}</textarea>
    <p class="hint">লেখাগুলো ওয়েবসাইটের উপরে চলমান অবস্থায় দেখাবে।</p>
    <div class="actions"><button class="btn" id="bs">সংরক্ষণ করুন</button></div></div>`;
  $('#bs').onclick = async () => {
    const { error } = await saveSettings({ breaking_enabled: $('#be').checked ? 'true' : 'false', breaking_news: $('#bt').value.trim() });
    error ? toast('সংরক্ষণ করা যায়নি।', true) : toast('জরুরি সংবাদ হালনাগাদ হয়েছে।');
  };
}

/* ---------- সেটিংস (ফুটারের পাতা) ---------- */
async function settingsView(v) {
  const s = await getSettings();
  const F = [['about', 'আমাদের সম্পর্কে'], ['contact', 'যোগাযোগ'], ['privacy', 'গোপনীয়তা নীতি'], ['terms', 'ব্যবহারের শর্তাবলি']];
  v.innerHTML = `<h1>সেটিংস</h1><div class="panel">${F.map(([k, t]) => `<label for="f_${k}">${t}</label>
    <textarea id="f_${k}" style="min-height:140px">${esc(s[k] || '')}</textarea>`).join('')}
    <p class="hint">অনুচ্ছেদের মাঝে একটি ফাঁকা লাইন দিন।</p>
    <div class="actions"><button class="btn" id="ss">সংরক্ষণ করুন</button></div></div>`;
  $('#ss').onclick = async () => {
    const { error } = await saveSettings(Object.fromEntries(F.map(([k]) => [k, $('#f_' + k).value.trim()])));
    error ? toast('সংরক্ষণ করা যায়নি।', true) : toast('সেটিংস সংরক্ষিত হয়েছে।');
  };
}

/* ---------- চালু ---------- */
(async () => {
  const { data } = await sb.auth.getSession();
  data.session ? shell() : loginView();
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') loginView(); });
})();
