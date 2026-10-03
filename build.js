// ============================================================
// build.js — Netlify বিল্ডের সময় চলে।
// Netlify Environment Variables থেকে SUPABASE_URL ও SUPABASE_ANON_KEY নিয়ে
// public/config.js ফাইল তৈরি করে। (শুধু public/anon key — secret/service_role key কখনো নয়)
//
// লোকাল পরীক্ষায়:  SUPABASE_URL=... SUPABASE_ANON_KEY=... node build.js
// ============================================================
const fs = require('fs');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('ত্রুটি: SUPABASE_URL এবং SUPABASE_ANON_KEY Environment Variable সেট করা হয়নি।');
  process.exit(1);
}
fs.writeFileSync(
  'public/config.js',
  'window.APP_CONFIG = ' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }) + ';\n'
);
console.log('public/config.js তৈরি হয়েছে।');
