import "dotenv/config"; // carrega o .env em process.env
import { iniciarBot } from "./bot";
import { criarServidor } from "./server";

async function main() {
  const { DISCORD_TOKEN, API_KEY, PORT, HOST} = process.env;

  if (!DISCORD_TOKEN || !API_KEY) {
    throw new Error("Defina DISCORD_TOKEN e API_KEY no arquivo .env");
  }

  await iniciarBot(DISCORD_TOKEN);

  const app = criarServidor(API_KEY);
  const porta = Number(PORT) || 3000;
  const host = HOST || "127.0.0.1";
  app.listen(porta, host, () => console.log(`API rodando em http://${host}:${porta}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});