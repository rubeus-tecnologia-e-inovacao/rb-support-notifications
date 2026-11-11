/**
 * Relay Discord — Cloudflare Worker
 *
 * O Discord bloqueia (erro 40333) requisições vindas dos IPs do Google Apps Script.
 * Este Worker recebe a chamada do Apps Script e a repassa para a API do Discord.
 *
 * Secrets (Worker → Settings → Variables and Secrets, tipo "Secret"):
 *   DISCORD_TOKEN → token do bot (ele fica só aqui, não mais no Apps Script)
 *   PROXY_KEY     → chave longa e aleatória, a mesma do Apps Script
 */

// Só libera os endpoints que o bot realmente usa.
const PERMITIDOS = [
  ['GET', /^\/api\/v10\/users\/@me$/],
  ['POST', /^\/api\/v10\/users\/@me\/channels$/],
  ['POST', /^\/api\/v10\/channels\/\d+\/messages$/],
];

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default {
  async fetch(request, env) {
    if (!env.PROXY_KEY || request.headers.get('X-Proxy-Key') !== env.PROXY_KEY) {
      return json(401, { message: 'Não autorizado (proxy)', code: 0 });
    }

    const url = new URL(request.url);
    const caminho = decodeURIComponent(url.pathname);
    const liberado = PERMITIDOS.some(([m, re]) => m === request.method && re.test(caminho));
    if (!liberado) return json(404, { message: 'Endpoint não permitido no proxy', code: 0 });

    const res = await fetch('https://discord.com' + caminho + url.search, {
      method: request.method,
      headers: {
        Authorization: 'Bot ' + env.DISCORD_TOKEN,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://crmqualidade.apprubeus.com.br, 1.0)',
      },
      body: request.method === 'GET' ? undefined : await request.text(),
    });

    // Devolve status e corpo do Discord sem alterar (o Apps Script trata 429, 50007 etc.).
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  },
};
