/**
 * rb-support-notifications — versão Google Apps Script
 *
 * O CRM faz um POST na URL do Web App e este script envia a DM ao usuário
 * no Discord. As chamadas ao Discord passam por um Cloudflare Worker (relay),
 * porque o Discord bloqueia os IPs do Apps Script (erro 403 / código 40333).
 *
 * Script Properties (Configurações do projeto → Propriedades do script):
 *   API_KEY    → chave que o CRM precisa mandar
 *   PROXY_URL  → URL do Worker, ex.: https://discord-relay.SEU-USUARIO.workers.dev
 *   PROXY_KEY  → mesma chave configurada como secret PROXY_KEY no Worker
 *
 * Obs.: o Apps Script NÃO lê headers da requisição, então a chave vai
 * no corpo (campo "apiKey") ou na query string (?apiKey=...).
 * Ele também não deixa definir o status HTTP: sempre volta 200, e o
 * status "real" vem no campo "status" do JSON de resposta.
 */

/** Sem estes campos não há como enviar a DM. */
const CAMPOS_OBRIGATORIOS = ['userId', 'numero', 'url'];

/** Campos exibidos no card, na ordem em que aparecem. Vazios viram "Não informado". */
const CAMPOS_CARD = [
  { campo: 'demanda', titulo: 'Demanda' },
  { campo: 'produto', titulo: 'Produto' },
  { campo: 'prioridade', titulo: 'Prioridade' },
  { campo: 'dtVencimento', titulo: 'Vencimento' },
];

const STATUS_PADRAO = 'Em Andamento';
const NAO_INFORMADO = 'Não informado';

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return responder(400, { erro: 'JSON inválido.' });
  }

  const props = PropertiesService.getScriptProperties();
  const apiKey = body.apiKey || (e && e.parameter && e.parameter.apiKey);
  if (!apiKey || apiKey !== props.getProperty('API_KEY')) {
    return responder(401, { erro: 'Não autorizado' });
  }

  const dados = normalizar(body);
  const faltando = CAMPOS_OBRIGATORIOS.filter((c) => !dados[c]);
  if (faltando.length) {
    return responder(400, { erro: 'Campos obrigatórios ausentes: ' + faltando.join(', ') + '.' });
  }

  if (!props.getProperty('PROXY_URL') || !props.getProperty('PROXY_KEY')) {
    return responder(500, { erro: 'PROXY_URL / PROXY_KEY não configurados.' });
  }

  try {
    enviarDMChamado(dados);
    return responder(200, { sucesso: true });
  } catch (err) {
    if (err.discordCode === 50007) return responder(403, { erro: 'O usuário bloqueou DMs.' });
    if (err.discordCode === 10013) return responder(404, { erro: 'Usuário não encontrado.' });
    console.error(err);
    return responder(500, { erro: 'Falha ao enviar a mensagem.', detalhe: String(err.message) });
  }
}

/**
 * Converte os valores para texto, remove espaços e descarta campos vazios ou
 * com placeholder do CRM não substituído (ex.: "@@curso@@").
 * O apiKey não é copiado, então nunca chega ao card.
 */
function normalizar(body) {
  const dados = {};
  const campos = CAMPOS_OBRIGATORIOS.concat(CAMPOS_CARD.map((c) => c.campo), ['status']);
  campos.forEach((c) => {
    const v = body[c] == null ? '' : String(body[c]).trim();
    dados[c] = /^@@.*@@$/.test(v) ? '' : v;
  });
  dados.dtVencimento = formatarDataBR(dados.dtVencimento);
  return dados;
}

/** Converte AAAA-MM-DD para DD/MM/AAAA. Outro formato é mantido como veio. */
function formatarDataBR(valor) {
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

/** Abre (ou reaproveita) o canal de DM e envia o card. */
function enviarDMChamado(dados) {
  const canal = discord('post', '/users/@me/channels', { recipient_id: dados.userId });

  const linhas = CAMPOS_CARD.map((c) => ({
    type: 10, // Text Display
    content: `**${c.titulo}**\n-# ${dados[c.campo] || NAO_INFORMADO}`,
  }));

  const card = {
    type: 17, // Container
    accent_color: 0x0099ff,
    components: [
      { type: 10, content: `### 🔔 [Chamado #${dados.numero} respondido.](${dados.url})` },
      { type: 10, content: '-# Seu chamado recebeu uma interação e está aguardando o seu retorno.' },
      { type: 14, divider: true, spacing: 1 }, // Separator pequeno
      ...linhas,
      { type: 10, content: `**Status**\n-# ${dados.status || STATUS_PADRAO}` },
      { type: 14, divider: true, spacing: 2 }, // Separator grande
      {
        type: 1, // Action Row
        components: [{ type: 2, style: 5, label: 'Acessar chamado', url: dados.url }],
      },
    ],
  };

  discord('post', `/channels/${canal.id}/messages`, {
    flags: 1 << 15, // IS_COMPONENTS_V2
    components: [card],
  });
}

/** Chamada à API do Discord via relay, com 1 nova tentativa em caso de rate limit. */
function discord(method, path, payload, tentativa) {
  const props = PropertiesService.getScriptProperties();
  const base = String(props.getProperty('PROXY_URL') || '').replace(/\/+$/, '');

  const res = UrlFetchApp.fetch(base + '/api/v10' + path, {
    method: method,
    contentType: 'application/json',
    headers: { 'X-Proxy-Key': props.getProperty('PROXY_KEY') },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const texto = res.getContentText();
  let json = {};
  try { json = texto ? JSON.parse(texto) : {}; } catch (_) {}

  if (code === 429 && !tentativa) {
    Utilities.sleep(Math.ceil((json.retry_after || 1) * 1000));
    return discord(method, path, payload, 1);
  }

  if (code >= 400) {
    const err = new Error(`Discord ${code}: ${texto}`);
    err.discordCode = json.code;
    throw err;
  }
  return json;
}

function responder(status, obj) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ status: status }, obj)))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 1º teste: confirma que o relay e o token funcionam (deve logar os dados do bot). */
function testeProxy() {
  console.log(JSON.stringify(discord('get', '/users/@me')));
}

/** 2º teste: envia o card completo sem passar pelo CRM (troque o userId). */
function testarEnvio() {
  enviarDMChamado(normalizar({
    userId: 'ID_USUARIO_DISCORD',
    numero: '1234',
    demanda: 'Oferta de teste',
    produto: 'Curso de teste',
    prioridade: 'Alta',
    dtVencimento: '01-12-1998',
    url: 'https://rbacademy.apprbs.com.br/suporte-rubeus/solicitacoes/detalhes-new?idRegistro=1234',
  }));
  console.log('Enviado.');
}
