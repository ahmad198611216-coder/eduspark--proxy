import { mkdir, writeFile } from 'node:fs/promises';

const SOURCE = 'https://classroom-behavior.hatchable.site/offline.html?tools=1';
const res = await fetch(SOURCE, { redirect: 'follow' });
if (!res.ok) throw new Error(`Source fetch failed: ${res.status}`);
let html = await res.text();
if (!html.includes('Classroom Compass Pro')) {
  throw new Error('Unexpected source page; refusing to publish an authentication/block page.');
}

// Remove Hatchable-only browser event client. The Vercel copy runs locally.
html = html.replace('<script src="/__hatchable/events.js"></script>', '');

// Unlock local standalone classroom features. No subscription/auth dependency is used on Vercel.
html = html.replace("planInfo={plan:'free',feature_overrides:{}}", "planInfo={plan:'pro',feature_overrides:{standalone:true}}");

// Make the standalone/local nature clear and disable cloud-only phone sync until a Vercel data store is connected.
html = html.replace('</body>', `<script>
(() => {
  const badge = document.getElementById('accountBadge');
  if (badge) badge.textContent = 'Vercel standalone • Local save';
  const status = document.getElementById('saveStatus');
  if (status) status.textContent = 'Saved on this device • محفوظ على هذا الجهاز';
  const phone = document.getElementById('connectPhone');
  if (phone) {
    phone.innerHTML = '📱 QR sync — cloud storage required';
    phone.onclick = () => alert(document.documentElement.lang === 'ar' ? 'ربط الهاتف يحتاج تفعيل مخزن بيانات Vercel. جميع أدوات الصف الأخرى تعمل محليًا.' : 'Phone QR sync needs a Vercel data store. All other classroom tools work locally.');
  }
  const refresh = document.getElementById('refreshClasses');
  if (refresh) {
    refresh.textContent = '↻ Local classes / الصفوف المحلية';
    refresh.onclick = () => { if (status) status.textContent = document.documentElement.lang === 'ar' ? '✓ الصفوف محفوظة على هذا الجهاز' : '✓ Classes are saved on this device'; };
  }
  const signout = document.getElementById('signout');
  if (signout) signout.style.display = 'none';
})();
</script></body>`);

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html, 'utf8');
await writeFile('dist/offline.html', html, 'utf8');
await writeFile('dist/manifest.webmanifest', JSON.stringify({
  name: 'Classroom Compass Pro',
  short_name: 'Classroom Compass',
  start_url: '/?tools=1',
  display: 'standalone',
  background_color: '#f2f7f3',
  theme_color: '#153d2b'
}, null, 2));

console.log('Built standalone Classroom Compass for Vercel.');
