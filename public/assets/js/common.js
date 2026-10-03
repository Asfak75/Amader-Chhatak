/* ============================================================
 * common.js — সাইট ও অ্যাডমিন দুই জায়গায় ব্যবহৃত সাধারণ অংশ
 * Supabase URL ও Anon Key আসে /config.js থেকে (Netlify Environment Variables → build.js)
 * এই ফাইলে কিছু বসাতে হবে না।
 * ============================================================ */
const CFG = window.APP_CONFIG || {};
if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
  document.body.insertAdjacentHTML('afterbegin',
    '<p style="padding:20px;background:#fee;color:#900">কনফিগারেশন পাওয়া যায়নি: Netlify-তে SUPABASE_URL ও SUPABASE_ANON_KEY সেট করে আবার Deploy করুন।</p>');
}
const sb = window.supabase.createClient(CFG.SUPABASE_URL || 'http://invalid', CFG.SUPABASE_ANON_KEY || 'invalid');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit' }) : '';
const fmtDT = iso => iso ? fmtDate(iso) + ', ' + fmtTime(iso) : '';

/* বাংলা স্লাগ + ছোট র‍্যান্ডম সংখ্যা (একই শিরোনাম হলেও আলাদা URL) */
function makeSlug(t) {
  const base = t.trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return (base || 'news') + '-' + Math.random().toString(36).slice(2, 7);
}

/* সংবাদের HTML পরিষ্কার করা — শুধু নিরাপদ ট্যাগ/অ্যাট্রিবিউট থাকবে (XSS রোধ) */
function sanitize(html) {
  const ALLOW = { P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, H2: 1, H3: 1, H4: 1, UL: 1, OL: 1, LI: 1, A: 1, IMG: 1, BLOCKQUOTE: 1, DIV: 1, SPAN: 1 };
  const DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, LINK: 1, META: 1 };
  const doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
  (function walk(node) {
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1) { ch.remove(); return; }
      if (DROP[ch.tagName]) { ch.remove(); return; }
      walk(ch);
      if (!ALLOW[ch.tagName]) { ch.replaceWith(...ch.childNodes); return; }
      [...ch.attributes].forEach(a => {
        const n = a.name, v = a.value.trim();
        const ok =
          (ch.tagName === 'A' && n === 'href' && /^(https?:|mailto:)/i.test(v)) ||
          (ch.tagName === 'A' && (n === 'target' || n === 'rel')) ||
          (ch.tagName === 'IMG' && (n === 'src' && /^https:/i.test(v) || n === 'alt')) ||
          (n === 'style' && /^text-align:\s*(left|right|center|justify);?$/i.test(v));
        if (!ok) ch.removeAttribute(n);
      });
      if (ch.tagName === 'A') { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
      if (ch.tagName === 'IMG') ch.setAttribute('loading', 'lazy');
    });
  })(doc.body);
  return doc.body.innerHTML;
}
const plainText = html => (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
