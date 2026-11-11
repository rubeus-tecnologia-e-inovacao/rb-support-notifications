# rb-support-notifications

Envia uma **DM no Discord** ao usuário sempre que um chamado do CRM recebe uma interação.

O CRM faz um `POST` no Web App do **Google Apps Script**, que monta o card (Components V2) e o envia pela API REST do Discord. As chamadas passam por um **Cloudflare Worker** que funciona como relay. Com isso, não é preciso manter um bot online.

```
CRM ──POST──▶ Apps Script (Web App) ──▶ Cloudflare Worker (relay) ──▶ API do Discord ──▶ DM do usuário
```

## Por que existe o Worker?

O Discord bloqueia, via Cloudflare, as requisições que vêm dos IPs compartilhados do Google Apps Script (`UrlFetchApp`). Nesses casos a API responde:

```json
{ "message": "internal network error", "code": 40333 }
```

O Worker repassa as chamadas a partir da rede do Cloudflare, que o Discord aceita. Ele também guarda o token do bot, que assim não precisa ficar no Apps Script.

## Estrutura

```
rb-support-notifications/
├── apps-script/
│   └── Code.gs      # Web App: recebe o CRM, valida e monta a DM
├── worker/
│   └── worker.js    # Relay para a API do Discord
└── README.md
```

## Configuração

### 1. Cloudflare Worker

Tudo é feito pelo painel do Cloudflare ([dash.cloudflare.com](https://dash.cloudflare.com)):

1. Vá em *Workers & Pages → Create → Worker*, dê um nome (por exemplo, `discord-relay`) e clique em **Deploy**.
2. Clique em **Edit code**, substitua o código padrão pelo conteúdo de `worker/worker.js` e clique em **Deploy** de novo.
3. Em *Settings → Variables and Secrets*, clique em **Add**, escolha o tipo **Secret** e crie:

| Secret          | Descrição                                                        |
|-----------------|------------------------------------------------------------------|
| `DISCORD_TOKEN` | Token do bot (Discord Developer Portal → Bot)                    |
| `PROXY_KEY`     | Chave longa e aleatória, compartilhada apenas com o Apps Script  |

Anote a URL do Worker. Ela tem o formato `https://discord-relay.<seu-usuario>.workers.dev`.

> Por segurança, o Worker só aceita requisições que trazem o header `X-Proxy-Key` correto. Ele também só libera os endpoints que o bot usa:
> `GET /users/@me`, `POST /users/@me/channels` e `POST /channels/:id/messages`.

### 2. Google Apps Script

1. Crie um projeto em [script.google.com](https://script.google.com) e cole o conteúdo de `apps-script/Code.gs` no arquivo `Código.gs`, substituindo o que já estiver lá.
2. Em *Configurações do projeto → Propriedades do script*, adicione:

| Propriedade | Descrição                                               |
|-------------|---------------------------------------------------------|
| `API_KEY`   | Chave que o CRM envia para se autenticar no Web App     |
| `PROXY_URL` | URL do Worker (sem barra no final)                      |
| `PROXY_KEY` | O mesmo valor do secret `PROXY_KEY` do Worker           |

3. Vá em *Implantar → Nova implantação → App da Web*:
   - **Executar como:** eu
   - **Quem pode acessar:** qualquer pessoa
4. Copie a URL do Web App (`https://script.google.com/macros/s/.../exec`). Essa é a URL que o CRM chama.

> ⚠️ Depois de qualquer alteração no código, publique uma **nova versão** em *Implantar → Gerenciar implantações → Editar → Nova versão*. Sem isso, a URL continua executando o código antigo.

### 3. Testes

No editor do Apps Script, execute nesta ordem:

1. `testeProxy`: deve registrar no log os dados do bot (`id`, `username`). Assim você confirma que o Worker e o token funcionam.
2. `testarEnvio`: envia um card de teste. Antes de rodar, troque o `userId` dentro da função.

Para que o bot consiga abrir a DM, o usuário precisa compartilhar ao menos um servidor com ele e estar com as DMs liberadas.

## Uso da API

**`POST`** `https://script.google.com/macros/s/<ID>/exec`

Corpo configurado no CRM (os `@@...@@` são substituídos pelo CRM no momento do envio):

```json
{
  "userId": "ID_USUARIO_DISCORD",
  "numero": "@@idregistro@@",
  "demanda": "@@ofertaCurso@@",
  "produto": "@@curso@@",
  "prioridade": "@@campopersonalizado_480_compl_proc@@",
  "dtVencimento": "@@campopersonalizado_481_compl_proc@@",
  "url": "https://rbacademy.apprbs.com.br/suporte-rubeus/solicitacoes/detalhes-new?idRegistro=@@idregistro@@",
  "apiKey": "SUA_API_KEY"
}
```

| Campo          | Obrigatório | Na DM | Descrição                                                   |
|----------------|-------------|-------|-------------------------------------------------------------|
| `apiKey`       | sim\*       | não   | Chave de autenticação (`API_KEY`)                           |
| `userId`       | sim         | não   | ID do usuário no Discord que recebe a DM                    |
| `numero`       | sim         | sim   | Número do chamado (título do card)                          |
| `url`          | sim         | sim   | Link do chamado (título e botão "Acessar chamado")          |
| `demanda`      | não         | sim   | Exibido como **Demanda**                                    |
| `produto`      | não         | sim   | Exibido como **Produto**                                    |
| `prioridade`   | não         | sim   | Exibido como **Prioridade**                                 |
| `dtVencimento` | não         | sim   | Exibido como **Vencimento** (no formato enviado pelo CRM)   |
| `status`       | não         | sim   | Exibido como **Status**. Quando não vem, usa "Em Andamento" |

\* O Apps Script não lê headers da requisição. Por isso a chave vai no corpo (`apiKey`) ou na query string (`?apiKey=...`).

Regras de tratamento:

- Os valores são convertidos para texto e têm os espaços das pontas removidos. Números também são aceitos.
- Um campo opcional vazio, ou com um placeholder que o CRM não substituiu (por exemplo, `@@curso@@` literal), aparece na DM como **"Não informado"**.
- Se um campo obrigatório vier vazio ou com placeholder não substituído, a API responde `400`, informando quais campos faltam.

### Como fica a DM

```
🔔 Chamado #1234 respondido.            ← link para a url
Seu chamado recebeu uma interação e está aguardando o seu retorno.
────────────
Demanda       Oferta X
Produto       Curso Y
Prioridade    Alta
Vencimento    15/11/2026
Status        Em Andamento
────────────
[ Acessar chamado ]                     ← botão para a url
```

### Respostas

O Apps Script **sempre responde com HTTP 200**. O status real vem no campo `status` do JSON:

| `status` | Significado                                  | Exemplo                                                   |
|----------|----------------------------------------------|-----------------------------------------------------------|
| `200`    | DM enviada                                   | `{ "status": 200, "sucesso": true }`                      |
| `400`    | JSON inválido ou campo obrigatório faltando  | `{ "status": 400, "erro": "Campos obrigatórios ausentes: numero." }` |
| `401`    | `apiKey` ausente ou incorreta                | `{ "status": 401, "erro": "Não autorizado" }`             |
| `403`    | O usuário bloqueou DMs (Discord `50007`)     | `{ "status": 403, "erro": "O usuário bloqueou DMs." }`    |
| `404`    | Usuário não encontrado (Discord `10013`)     | `{ "status": 404, "erro": "Usuário não encontrado." }`    |
| `500`    | Configuração ausente ou falha no Discord     | `{ "status": 500, "erro": "...", "detalhe": "..." }`      |

Quando o Discord aplica rate limit (`429`), o script espera o `retry_after` e tenta mais uma vez.

## Adicionando novas informações na DM

Os campos são configurados em duas listas no topo do `Code.gs`:

```js
/** Sem estes campos não há como enviar a DM. */
const CAMPOS_OBRIGATORIOS = ['userId', 'numero', 'url'];

/** Campos exibidos no card, na ordem em que aparecem. */
const CAMPOS_CARD = [
  { campo: 'demanda', titulo: 'Demanda' },
  { campo: 'produto', titulo: 'Produto' },
  { campo: 'prioridade', titulo: 'Prioridade' },
  { campo: 'dtVencimento', titulo: 'Vencimento' },
];
```

O fluxo de um campo pelo código é este:

1. **`doPost`**: lê o JSON enviado pelo CRM.
2. **`normalizar(body)`**: copia apenas os campos dessas listas (o `apiKey` fica de fora), converte para texto e descarta placeholders não substituídos.
3. **`enviarDMChamado(dados)`**: monta o card, com uma linha para cada item de `CAMPOS_CARD`.

**Para exibir um campo novo**, por exemplo `responsavel`:

1. No CRM, inclua o campo no corpo: `"responsavel": "@@responsavel@@"`.
2. No `Code.gs`, adicione uma linha em `CAMPOS_CARD`, na posição em que ele deve aparecer:

```js
{ campo: 'responsavel', titulo: 'Responsável' },
```

**Para torná-lo obrigatório**, adicione o nome dele também em `CAMPOS_OBRIGATORIOS`.

**Para remover ou reordenar** linhas do card, basta mexer em `CAMPOS_CARD`. O texto "Não informado" e o status padrão ficam nas constantes `NAO_INFORMADO` e `STATUS_PADRAO`.

Depois de alterar, inclua o campo novo na função `testarEnvio`, rode no editor e publique uma nova versão do Web App.

O Worker não precisa de alteração ao adicionar campos, porque ele só repassa a mensagem.
