import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ContainerBuilder,
  SeparatorSpacingSize
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

  // const embed = new EmbedBuilder()
  //   .setColor(0x39a908)
  //   .setTitle(`🔔 Chamado #${dados.numero} respondido`)
  //   .setURL(dados.url)
  //   .setDescription("Seu chamado recebeu uma resposta e está **Em Andamento**, aguardando o seu retorno.")
  //   .addFields(
  //     { name: "Descrição", value: dados.descricao, inline: true },
  //     { name: "Prioridade", value: dados.prioridade, inline: true },
  //     { name: "Status", value: "Em Andamento", inline: true }
  //   )
  //   .setTimestamp();

const componentV2 = new ContainerBuilder()
  .setAccentColor(0x0099ff)
  .addTextDisplayComponents((title) =>
    title.setContent(`### 🔔 [Chamado #${dados.numero} respondido.](${dados.url})`)
  )
  .addTextDisplayComponents((description) =>
    description.setContent('-# Seu chamado recebeu uma interação e está aguardando o seu retorno.')
  )
  .addSeparatorComponents((sep) =>
    sep.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  )
  .addTextDisplayComponents(
    (t) => t.setContent(`**Descrição**\n-# ${dados.descricao}`),
    (t) => t.setContent(`**Prioridade**\n-# ${dados.prioridade}`),
    (t) => t.setContent(`**Status**\n-# Em Andamento`),
  )
  .addSeparatorComponents((sep) =>
    sep.setSpacing(SeparatorSpacingSize.Large).setDivider(true)
  )
  .addActionRowComponents((row) =>
    row.setComponents(
      new ButtonBuilder()
        .setLabel('Acessar chamado')
        .setStyle(ButtonStyle.Link)
        .setURL(dados.url)
    )
  )

  // await usuario.send({ embeds: [embed], components: [linha] });
  await usuario.send({ components: [componentV2], flags: MessageFlags.IsComponentsV2 });
}