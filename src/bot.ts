import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} from "discord.js";

export interface DadosChamado {
  userId: string;
  numero: string;
  descricao: string;
  prioridade: string;
  url: string;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

export function iniciarBot(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
        client.once(Events.ClientReady, (c) => {
            console.log(`Bot online como ${c.user.tag}`)
            resolve()
        })
        client.login(token).catch(reject)
    })
}

export async function enviarDMChamado(dados: DadosChamado): Promise<void> {
  const usuario = await client.users.fetch(dados.userId);

  const embed = new EmbedBuilder()
    .setColor(0x39a908)
    .setTitle(`🔔 Chamado #${dados.numero} respondido`)
    .setURL(dados.url)
    .setDescription("Seu chamado recebeu uma resposta e está **Em Andamento**, aguardando o seu retorno.")
    .addFields(
      { name: "Descrição", value: dados.descricao, inline: true },
      { name: "Prioridade", value: dados.prioridade, inline: true },
      { name: "Status", value: "Em Andamento", inline: true }
    )
    .setTimestamp();

  const botao = new ButtonBuilder()
    .setLabel("Abrir chamado")
    .setStyle(ButtonStyle.Link)
    .setURL(dados.url);

  const linha = new ActionRowBuilder<ButtonBuilder>().addComponents(botao);

  await usuario.send({ embeds: [embed], components: [linha] });
}