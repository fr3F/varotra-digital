/**
 * Page d'administration (/admin) pour le vendeur de l'application : créer une boutique et son code
 * d'activation, prolonger ou suspendre un abonnement. Le jeton ADMIN_TOKEN est saisi dans la page
 * et gardé dans l'onglet (sessionStorage) ; toutes les données passent par /admin/api/*.
 */
export const ADMIN_HTML = `<!doctype html>
<html lang="mg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Carnet Digital — Admin</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 0 auto; padding: 16px; color: #1f2933; }
  h1 { font-size: 1.4rem; } h2 { font-size: 1.1rem; margin-top: 28px; }
  input, select, button { font-size: 1rem; padding: 10px; border-radius: 8px; border: 1px solid #cbd2d9; }
  button { background: #A3161D; color: #fff; border: 0; font-weight: 700; cursor: pointer; }
  button.secondary { background: #fff; color: #A3161D; border: 1px solid #A3161D; }
  form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .shop { border: 1px solid #e4e7eb; border-radius: 12px; padding: 12px; margin: 10px 0; }
  .code { font-family: ui-monospace, monospace; font-size: 1.15rem; font-weight: 700; letter-spacing: 1px; }
  .ok { color: #15803d; font-weight: 700; } .ko { color: #b42318; font-weight: 700; }
  .muted { color: #52606d; font-size: .9rem; } .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  #error { color: #b42318; font-weight: 600; }
</style>
</head>
<body>
<h1>Carnet Digital — Fitantanana ny fivarotana</h1>
<form id="login">
  <input id="token" type="password" placeholder="ADMIN_TOKEN" autocomplete="current-password" required>
  <button type="submit">Hiditra</button>
</form>
<p id="error"></p>
<section id="app" hidden>
  <h2>Fivarotana vaovao</h2>
  <form id="create">
    <input id="name" placeholder="Anaran'ny fivarotana (ohatra: Rakoto Shop)" required maxlength="80">
    <select id="months"><option value="1">1 volana</option><option value="3">3 volana</option><option value="6">6 volana</option><option value="12">12 volana</option></select>
    <button type="submit">Mamorona + code</button>
  </form>
  <h2>Fivarotana rehetra</h2>
  <div id="shops"></div>
</section>
<script>
const $ = (id) => document.getElementById(id);
let token = sessionStorage.getItem('adminToken') || '';

async function api(path, body) {
  const response = await fetch('/admin/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || ('Erreur ' + response.status));
  return data;
}

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => { if (key === 'onclick') node.onclick = value; else node.setAttribute(key, value); });
  children.forEach((child) => node.append(child));
  return node;
}

function date(iso) { return new Date(iso).toLocaleDateString('fr-FR'); }

async function load() {
  try {
    const { shops } = await api('/shops');
    $('error').textContent = '';
    $('app').hidden = false;
    $('login').hidden = true;
    const list = $('shops');
    list.replaceChildren();
    shops.forEach((shop) => {
      const status = shop.suspended ? el('span', { class: 'ko' }, 'Voasakana') : shop.active ? el('span', { class: 'ok' }, 'Mandeha') : el('span', { class: 'ko' }, 'Lany ny abonnement');
      const extend = (months) => () => act('/shops/' + shop.id + '/extend', { months });
      list.append(el('div', { class: 'shop' },
        el('strong', {}, shop.name), ' — ', status,
        el('div', {}, 'Code: ', el('span', { class: 'code' }, shop.activationCode)),
        el('div', { class: 'muted' }, 'Page: ' + (shop.pageName || 'mbola tsy mifandray') + ' · Hatramin\\'ny ' + date(shop.expiresAt) + ' · Finday: ' + shop.devices),
        el('div', { class: 'actions' },
          el('button', { onclick: extend(1) }, '+1 volana'),
          el('button', { onclick: extend(3) }, '+3 volana'),
          el('button', { class: 'secondary', onclick: () => act('/shops/' + shop.id + '/suspend', { suspended: !shop.suspended }) }, shop.suspended ? 'Avereno' : 'Sakano'),
        ),
      ));
    });
  } catch (error) {
    $('error').textContent = error.message;
    $('app').hidden = true;
    $('login').hidden = false;
  }
}

async function act(path, body) {
  try { await api(path, body); await load(); } catch (error) { $('error').textContent = error.message; }
}

$('login').onsubmit = (event) => { event.preventDefault(); token = $('token').value; sessionStorage.setItem('adminToken', token); load(); };
$('create').onsubmit = async (event) => {
  event.preventDefault();
  try {
    const { shop } = await api('/shops', { name: $('name').value, months: Number($('months').value) });
    $('name').value = '';
    await load();
    alert('Code an\\'i ' + shop.name + ' : ' + shop.activationCode);
  } catch (error) { $('error').textContent = error.message; }
};
if (token) load();
</script>
</body>
</html>`;
