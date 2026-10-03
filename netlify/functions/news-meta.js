// ============================================================
// /news/<slug> রিকোয়েস্টে সার্ভার থেকে SEO + Open Graph ট্যাগ বসায়,
// যাতে ফেসবুক/হোয়াটসঅ্যাপ/গুগল সঠিক শিরোনাম ও ছবি দেখাতে পারে।
// Netlify Environment Variables ব্যবহার করে: SUPABASE_URL, SUPABASE_ANON_KEY
// ============================================================
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

exports.handler = async (event) => {
  const reqUrl = new URL(event.rawUrl);
  const origin = reqUrl.origin;
  let template = '';
  try {
    template = await (await fetch(origin + '/index.html')).text();
  } catch (e) {
    return { statusCode: 500, body: 'Template error' };
  }
  const html = (body) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    body,
  });

  try {
    let slug = reqUrl.pathname.replace(/^\/news\//, '').replace(/\/+$/, '');
    try { slug = decodeURIComponent(slug); } catch (_) {}
    const api = `${process.env.SUPABASE_URL}/rest/v1/news` +
      `?slug=eq.${encodeURIComponent(slug)}&status=eq.published` +
      `&select=title,excerpt,content,image_url,published_at,author&limit=1`;
    const res = await fetch(api, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY },
    });
    const rows = await res.json();
    const n = Array.isArray(rows) && rows[0];
    if (!n) return html(template);

    const plain = (n.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const desc = (n.excerpt || plain).slice(0, 160);
    const title = `${n.title} | আমাদের ছাতক`;
    const canonical = `${origin}/news/${encodeURIComponent(slug)}`;
    const ld = {
      '@context': 'https://schema.org', '@type': 'NewsArticle', headline: n.title,
      datePublished: n.published_at, author: { '@type': 'Person', name: n.author || 'আমাদের ছাতক' },
      image: n.image_url ? [n.image_url] : undefined, mainEntityOfPage: canonical,
    };
    const seo = `<!--SEO-START-->
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="আমাদের ছাতক">
<meta property="og:locale" content="bn_BD">
<meta property="og:title" content="${esc(n.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
${n.image_url ? `<meta property="og:image" content="${esc(n.image_url)}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<!--SEO-END-->`;
    return html(template.replace(/<!--SEO-START-->[\s\S]*<!--SEO-END-->/, () => seo));
  } catch (e) {
    return html(template);
  }
};
