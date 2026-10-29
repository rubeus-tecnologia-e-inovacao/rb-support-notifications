# rb-support-notifications — Google Apps Script

Mesma função do bot (DM de chamado respondido), mas rodando como Web App no Apps Script, sem servidor nem bot online.

```
CRM ──POST──▶ Web App (Apps Script) ──UrlFetch──▶ API REST do Discord ──▶ DM do usuário
```

## Setup

1. Crie um projeto em script.google.com e cole o `Code.gs`.
2. **Configurações do projeto → Propriedades do script**: adicione `DISCORD_TOKEN` e `API_KEY`.
3. Rode `testarEnvio` uma vez no editor (autoriza o `UrlFetchApp` e valida o token).
4. **Implantar → Nova implantação → App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Use a URL `https://script.google.com/macros/s/.../exec` no CRM.

> A cada alteração de código, edite a implantação existente (nova versão) para manter a mesma URL.

## Chamada do CRM

`POST <URL do Web App>` com `Content-Type: application/json`:

```json
{
  "apiKey": "SUA_API_KEY",
  "userId": "123456789012345678",
  "numero": "1234",
  "descricao": "Erro ao emitir boleto",
  "prioridade": "Alta",
  "url": "https://.../chamados/1234"
}
```

**Importante para o cliente HTTP do CRM:**
- Precisa **seguir redirect** (o Google responde 302 para `script.googleusercontent.com`; o resultado vem lá).
- A chave vai no corpo (`apiKey`) ou em `?apiKey=` — o Apps Script não lê headers, então `x-api-key` não funciona.
- O HTTP volta sempre 200. O resultado real está no JSON:

| `status` | Significado |
|---|---|
| `200` | DM enviada (`sucesso: true`) |
| `400` | Campos ausentes/inválidos ou JSON inválido |
| `401` | `apiKey` ausente ou incorreta |
| `403` | Usuário bloqueou DMs |
| `404` | Usuário não encontrado |
| `500` | Falha interna |

## Observações

- O bot e o usuário precisam compartilhar um servidor e o usuário precisa aceitar DMs de membros.
- O bot não precisa ficar online, mas precisa já ter conectado ao gateway alguma vez (o atual já conectou).
- Cota do UrlFetch: ~20 mil chamadas/dia em conta Workspace (cada DM usa 2).
