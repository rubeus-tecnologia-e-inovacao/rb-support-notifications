# Bot Discord de Notificação de Chamados

Bot em **TypeScript** com uma API **Express**. Quando um sistema externo avisa que um chamado foi respondido, o bot envia uma **DM** ao usuário no Discord, em formato de card (embed) com um botão para abrir o chamado.

```
Sistema de chamados ──POST /enviar-dm──▶ Express ──▶ discord.js ──▶ DM do usuário
```

## Estrutura

```
src/
├── index.ts    # Ponto de entrada: lê o .env, conecta o bot e sobe a API
├── bot.ts      # Cliente do Discord, embed e envio da DM
└── server.ts   # Express: autenticação (x-api-key) e rota /enviar-dm
```

## Instalação

Requer Node.js 18+ e um bot criado no [Discord Developer Portal](https://discord.com/developers/applications), adicionado ao servidor.

```bash
npm install
cp .env.example .env   # depois preencha os valores
npm run dev
```

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DISCORD_TOKEN` | Sim | — | Token do bot |
| `API_KEY` | Sim | — | Chave exigida no header `x-api-key` |
| `PORT` | Não | `3000` | Porta da API |
| `HOST` | Não | `127.0.0.1` | Endereço de escuta. Mantenha `127.0.0.1` (só a própria máquina); em produção, um proxy (Nginx) recebe o tráfego externo |

## Uso da API

`POST` `/enviar-dm` com os headers `Content-Type: application/json` e `x-api-key: SUA_API_KEY`.

```json
{
  "userId": "123456789012345678", // id do usuário no discord
  "numero": "1234",
  "descricao": "Erro ao emitir boleto no TOTVS",
  "prioridade": "Alta",
  "url": "https://seusistema.com/chamados/1234"
}
```

| Status | Significado |
|---|---|
| `200` | DM enviada |
| `400` | Campos ausentes ou inválidos |
| `401` | `x-api-key` ausente ou incorreta |
| `403` | Usuário bloqueou DMs |
| `404` | Usuário não encontrado |
| `500` | Falha interna |

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Desenvolvimento, com reinício automático |
| `npm run build` | Compila para `dist/` |
| `npm start` | Executa o código compilado |

## Observações

- O bot e o usuário precisam compartilhar um servidor, e o usuário precisa permitir DMs de membros do servidor.