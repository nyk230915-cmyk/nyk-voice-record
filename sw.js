// NYKインフォメーションの通知（Web Push）
// サーバーからは「合図」だけが届く（中身なし）。合図が来たら、かぎを付けてサーバーに最新のお知らせを聞き、通知に出す。
// かぎ・窓口は info.html が Cache（nyk-push）に入れておく。このファイルに秘密は書かない（公開リポジトリ）。
const SEEN_MAX = 50;
async function cacheText(name) {
  try { const c = await caches.open('nyk-push'); const r = await c.match(name); return r ? await r.text() : ''; } catch (e) { return ''; }
}
async function seenList() { try { return JSON.parse(await cacheText('seen') || '[]'); } catch (e) { return []; } }
async function saveSeen(list) { try { const c = await caches.open('nyk-push'); await c.put('seen', new Response(JSON.stringify(list.slice(-SEEN_MAX)))); } catch (e) {} }
async function onPush() {
  const key = await cacheText('key'), api = await cacheText('api');
  let list = [];
  try {
    const sub = await self.registration.pushManager.getSubscription();
    const r = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'pushInbox', args: [key, sub ? sub.endpoint : ''] }) });
    const j = await r.json(); if (j && j.r) { list = j.r; }
  } catch (e) {}
  const seen = await seenList(), fresh = list.filter(function (m) { return seen.indexOf(m.id) < 0; });
  const show = fresh.length ? fresh.reverse() : list.slice(0, 1);
  if (!show.length) {
    // 中身が読めなかったときも何か出す（iPhone は合図のたびに通知を出す決まり）
    return self.registration.showNotification('NYKインフォメーション', { body: 'お知らせがあります。開いて確かめてください', tag: 'nyk-generic', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: 'info.html' } });
  }
  await saveSeen(seen.concat(show.map(function (m) { return m.id; })));
  return Promise.all(show.map(function (m) {
    return self.registration.showNotification(m.title || 'NYKインフォメーション', { body: m.body || '', tag: m.kind === 'ty' ? 'nyk-ty' : 'nyk-' + m.id, renotify: m.kind === 'ty', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: m.url || 'info.html' } });
  }));
}
self.addEventListener('push', function (e) { e.waitUntil(onPush()); });
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'info.html', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (const w of ws) { if (w.url.indexOf('info.html') >= 0 && 'focus' in w) { return w.focus(); } }
    return clients.openWindow(url);
  }));
});
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
