/**
 * rb-support-notifications — versão Google Apps Script
 *
 * O CRM faz um POST na URL do Web App e este script envia a DM ao usuário
 * no Discord pela API REST (sem precisar manter o bot online).
 *
 * Script Properties (Configurações do projeto → Propriedades do script):
 *   DISCORD_TOKEN  → token do bot
 *   API_KEY        → chave que o CRM precisa mandar
 *
 * Obs.: o Apps Script NÃO lê headers da requisição, então a chave vai
 * no corpo (campo "apiKey") ou na query string (?apiKey=...).
 * Ele também não deixa definir o status HTTP: sempre volta 200, e o
 * status "real" vem no campo "status" do JSON de resposta.
 */

const DISCORD_API = 'https://discord.com/api/v10';
const CAMPOS = ['userId', 'numero', 'descricao', 'prioridade', 'url'];

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return responder(400, { erro: 'JSON inválido.' });
  }

  const props = PropertiesService.getScriptProperties();
  const apiKey = body.apiKey || (e.parameter && e.parameter.apiKey);
  if (!apiKey || apiKey !== props.getProperty('API_KEY')) {
    return responder(401, { erro: 'Não autorizado' });
  }

  const invalido = CAMPOS.some((c) => typeof body[c] !== 'string' || !body[c]);
  if (invalido) {
    return responder(400, {
      erro: "Envie 'userId', 'numero', 'descricao', 'prioridade' e 'url' como string.",
    });
  }

  const token = props.getProperty('DISCORD_TOKEN');
  if (!token) return responder(500, { erro: 'DISCORD_TOKEN não configurado.' });

  try {
    enviarDMChamado(token, body);
    return responder(200, { sucesso: true });
  } catch (err) {
    if (err.discordCode === 50007) return responder(403, { erro: 'O usuário bloqueou DMs.' });
    if (err.discordCode === 10013) return responder(404, { erro: 'Usuário não encontrado.' });
    console.error(err);
    return responder(500, { erro: 'Falha ao enviar a mensagem.' });
  }
}

/** Abre (ou reaproveita) o canal de DM e envia o card. */
function enviarDMChamado(token, dados) {
  const canal = discord(token, 'post', '/users/@me/channels', { recipient_id: dados.userId });

  const card = {
    type: 17, // Container
    accent_color: 0x0099ff,
    components: [
      { type: 10, content: `### 🔔 [Chamado #${dados.numero} respondido.](${dados.url})` },
      { type: 10, content: '-# Seu chamado recebeu uma interação e está aguardando o seu retorno.' },
      { type: 14, divider: true, spacing: 1 }, // Separator pequeno
      { type: 10, content: `**Descrição**\n-# ${dados.descricao}` },
      { type: 10, content: `**Prioridade**\n-# ${dados.prioridade}` },
      { type: 10, content: `**Status**\n-# Em Andamento` },
      { type: 14, divider: true, spacing: 2 }, // Separator grande
      {
        type: 1, // Action Row
        components: [{ type: 2, style: 5, label: 'Acessar chamado', url: dados.url }],
      },
    ],
  };

  discord(token, 'post', `/channels/${canal.id}/messages`, {
    flags: 1 << 15, // IS_COMPONENTS_V2
    components: [card],
  });
}

/** Chamada à API do Discord, com 1 nova tentativa em caso de rate limit. */
function discord(token, method, path, payload, tentativa) {
  const res = UrlFetchApp.fetch(DISCORD_API + path, {
    method: method,
    contentType: 'application/json',
    headers: { Authorization: 'Bot ' + token },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const texto = res.getContentText();
  let json = {};
  try { json = texto ? JSON.parse(texto) : {}; } catch (_) {}

  if (code === 429 && !tentativa) {
    Utilities.sleep(Math.ceil((json.retry_after || 1) * 1000));
    return discord(token, method, path, payload, 1);
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

/** Rode manualmente no editor para testar sem o CRM (troque o userId). */
function testarEnvio() {
  const token = PropertiesService.getScriptProperties().getProperty('DISCORD_TOKEN');
  enviarDMChamado(token, {
    userId: '123456789012345678',
    numero: '1234',
    descricao: 'Teste de notificação',
    prioridade: 'Alta',
    url: 'https://crmqualidade.apprubeus.com.br',
  });
}
