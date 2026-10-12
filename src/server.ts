import express from "express";
import { DiscordAPIError } from "discord.js";
import { enviarDMChamado } from "./bot";

export function criarServidor(apiKey: string) {
  const app = express();
  app.use(express.json());

  // middleware de autenticação: bloqueia quem não enviar a chave certa
  app.use((request, response, next) => {
    if (request.header("x-api-key") !== apiKey) {
      response.status(401).json({ erro: "Não autorizado " });
      return;
    }
    next();
  });

  app.post("/enviar-dm", async (request, response) => {
    const { userId, numero, descricao, prioridade, url } = request.body ?? {};

    if (
      typeof userId !== "string" ||
      typeof numero !== "string" ||
      typeof descricao !== "string" ||
      typeof prioridade !== "string" ||
      typeof url !== "string"
    ) {
      response
        .status(400)
        .json({
          erro: "Envie 'userId', 'numero', 'descricao', 'prioridade' e 'url' como string.",
        });
      return;
    }

    try {
      await enviarDMChamado({ userId, numero, descricao, prioridade, url });
      response.json({ sucesso: true });
      
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code === 50007) {
        response.status(403).json({ erro: "O usuário bloqueou DMs." });

      } else if (error instanceof DiscordAPIError && error.code === 10013) {
        response.status(404).json({ erro: "Usuário não encontrado." });

      } else {
        console.error(error);
        response.status(500).json({ erro: "Falha ao enviar a mensagem." });
      }
    }
  });

  return app;
}