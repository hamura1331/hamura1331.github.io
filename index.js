const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('Hiányzik a DISCORD_TOKEN, CLIENT_ID vagy GUILD_ID a .env fájlból.');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('Nem találom a config.json fájlt. Másold át a config.example.json fájlt config.json néven.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Ticket nyitó panel küldése')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Üzenet küldése egy csatornára')
    .addChannelOption(option =>
      option
        .setName('csatorna')
        .setDescription('Célcsatorna')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
    .addStringOption(option =>
      option
        .setName('szoveg')
        .setDescription('Az elküldendő szöveg')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Embed üzenet küldése egy csatornára')
    .addChannelOption(option =>
      option
        .setName('csatorna')
        .setDescription('Célcsatorna')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
    .addStringOption(option =>
      option
        .setName('cim')
        .setDescription('Embed címe')
        .setRequired(true))
    .addStringOption(option =>
      option
        .setName('szoveg')
        .setDescription('Embed szövege')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('send')
    .setDescription('Előre elkészített tartalom kiküldése')
    .addStringOption(option =>
      option
        .setName('tipus')
        .setDescription('Milyen tartalmat küldjön ki a bot?')
        .setRequired(true)
        .addChoices(
          { name: 'Szabályzat', value: 'rules' }
        ))
    .addChannelOption(option =>
      option
        .setName('csatorna')
        .setDescription('Célcsatorna')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('role-panel')
    .setDescription('Önkiszolgáló rangválasztó panel küldése')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('role')
    .setDescription('Rang hozzáadása vagy elvétele')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Rang hozzáadása')
        .addUserOption(o => o.setName('felhasznalo').setDescription('Felhasználó').setRequired(true))
        .addRoleOption(o => o.setName('rang').setDescription('Rang').setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Rang elvétele')
        .addUserOption(o => o.setName('felhasznalo').setDescription('Felhasználó').setRequired(true))
        .addRoleOption(o => o.setName('rang').setDescription('Rang').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands
  });
  console.log('Slash parancsok regisztrálva.');
}

function safeChannelName(input) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'felhasznalo';
}

async function sendLog(guild, text) {
  if (!config.logChannelId) return;
  const channel = guild.channels.cache.get(config.logChannelId);
  if (channel && channel.isTextBased()) {
    await channel.send({ content: text }).catch(() => {});
  }
}

client.once('ready', async () => {
  console.log(`Bejelentkezve: ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error('Nem sikerült regisztrálni a slash parancsokat:', error);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ticket-panel') {
        const embed = new EmbedBuilder()
          .setColor(config.embedColor || '#5865F2')
          .setTitle('Ticket választó')
          .setDescription('Kérlek válaszd ki a megfelelő részleget.');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_create_general')
            .setLabel('Általános hiba')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ticket_create_account')
            .setLabel('Fiókprobléma')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ticket_create_report')
            .setLabel('Játékos jelentése')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
          content: 'A ticket panel elkészült.',
          ephemeral: true
        });

        await interaction.channel.send({
          embeds: [embed],
          components: [row]
        });
        return;
      }

      if (interaction.commandName === 'say') {
        const channel = interaction.options.getChannel('csatorna');
        const text = interaction.options.getString('szoveg');

        await channel.send({ content: text });
        await interaction.reply({
          content: `✅ Üzenet elküldve ide: ${channel}`,
          ephemeral: true
        });

        await sendLog(
          interaction.guild,
          `📨 ${interaction.user.tag} üzenetet küldött ide: ${channel}.`
        );
        return;
      }

      if (interaction.commandName === 'embed') {
        const channel = interaction.options.getChannel('csatorna');
        const title = interaction.options.getString('cim');
        const text = interaction.options.getString('szoveg');

        const embed = new EmbedBuilder()
          .setColor(config.embedColor || '#5865F2')
          .setTitle(title)
          .setDescription(text)
          .setFooter({ text: `Küldte: ${interaction.user.tag}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        await interaction.reply({
          content: `✅ Embed elküldve ide: ${channel}`,
          ephemeral: true
        });

        await sendLog(
          interaction.guild,
          `🧾 ${interaction.user.tag} embedet küldött ide: ${channel}.`
        );
        return;
      }

      if (interaction.commandName === 'send') {
        const type = interaction.options.getString('tipus');
        const channel = interaction.options.getChannel('csatorna');

        if (type === 'rules') {
          const ruleParts = ["📕 **Közösségi szabályzat**\n\nSzeretnénk egy kulturált, barátságos és biztonságos közösséget fenntartani, ezért kérünk mindenkit, hogy tartsa be az alábbi szabályokat. A szabályzat minden tagra egyformán vonatkozik.\n\n**1. Tiszteld a közösség tagjait.**\nMindenkivel bánj tisztelettel, legyen szó új játékosról, régi tagról vagy az adminok egyikéről. A zaklatás, gyűlöletbeszéd, diszkrimináció, rasszizmus, fenyegetés, személyeskedés, mások elleni uszítás, valamint személyes adatok engedély nélküli közzététele nem megengedett.\n\n**2. Kerüld a toxikus viselkedést és a felesleges drámát.**\nNe provokálj másokat, ne próbálj szándékosan vitát vagy konfliktust kelteni, és ne szíts ellenségeskedést. A kulturált véleménykülönbség természetesen megengedett, amíg az nem zavarja a közösséget.\n\n**3. Csak megfelelő tartalmat ossz meg.**\nNSFW, szexuálisan explicit vagy indokolatlanul erőszakos, illetve felkavaró tartalom nem engedélyezett. Ez vonatkozik az üzenetekre, képekre, videókra, linkekre, felhasználónevekre, profilképekre és státuszokra is.\n\n**4. Kerüld a politikai, vallási és egyéb megosztó témákról szóló vitákat.**\nA szerver nem politikai, vallási vagy más erősen megosztó témák megvitatására szolgál. Egy rövid és kulturált beszélgetés még elfogadható lehet, de a konfliktust okozó, sértő vagy provokatív beszélgetéseket az adminok lezárhatják.", "**5. Tartsd átláthatóan és kulturáltan a chatet.**\nKerüld a spamelést, a túlzott pingelést, ugyanazon üzenetek folyamatos másolását és beillesztését, a soundboarddal való visszaélést, valamint a voice csatornák szándékos zavarását.\n\n**6. Maradj az adott csatorna témájánál.**\nMinden csatornát arra használj, amire létrehoztuk. A nyilvános csatornákon angolul kommunikálj, kivéve, ha az adott csatorna kifejezetten más nyelv használatára szolgál.\n\n**7. Tilos a reklámozás és az önpromóció.**\nMás szerverek, szolgáltatások, közösségi oldalak vagy saját tartalmak reklámozása admin engedély nélkül nem megengedett. Ez a privát üzenetben történő kéretlen reklámozásra is vonatkozik.\n\n**8. Tilos az accountok értékesítése és az RMT.**\nAccountok, tárgyak, Yang vagy bármilyen játékon belüli előny valódi pénzért történő vásárlása, eladása vagy cseréje tilos. Már az ilyen jellegű ajánlatok és próbálkozások is szabálysértésnek minősülnek.\n\n**9. Más privát MT2 szerverek említése nem megengedett.**\nMás privát szerverek említése, reklámozása, összehasonlítása vagy az azokra történő játékostoborzás nem engedélyezett. Ez a szabály a privát üzenetekre, felhasználónevekre és státuszokra is vonatkozik.", "**10. Tilos a csalás, exploitok használata és a szabályszegés ösztönzése.**\nNe ossz meg csalásokat, hackeket, exploitokat vagy kihasználható hibákat, és ne biztass másokat ezek használatára vagy bármely más szabály megszegésére.\n\n**11. Tilos az átverés, megszemélyesítés és megtévesztés.**\nNe add ki magad adminnak vagy más személynek, és ne próbálj megtévesztéssel accountokat, tárgyakat, személyes adatokat vagy más értékeket megszerezni.\n\n**12. Tartsd tiszteletben mások magánéletét és biztonságát.**\nMás személyes adatait az engedélye nélkül ne oszd meg. Szigorúan tilos minden olyan fájl, program vagy link terjesztése, amely mások accountjának, eszközének vagy személyes adatainak megszerzésére, megkárosítására vagy veszélyeztetésére szolgál. Ide tartoznak többek között a malware-ek és az adathalász linkek is.\n\n**13. Kövesd az adminok utasításait.**\nAz adminok utasításait be kell tartani. Ha nem értesz egyet egy moderációs döntéssel, azt privát módon és kulturáltan jelezd. Az adminokkal szembeni ellenséges vagy sértő viselkedés szabálysértésnek minősül.\n\n**14. Használd a józan eszed.**\nNem lehet minden lehetséges helyzetet előre felsorolni. Az adminok olyan egyértelműen káros, rosszhiszemű vagy a közösséget zavaró viselkedés esetén is intézkedhetnek, amelyet a szabályzat külön nem említ.", "⚖️ **Moderáció és büntetések**\n\nA szabálysértés súlyosságától, körülményeitől és ismétlődésétől függően az adminok figyelmeztetést, üzenettörlést, mute-ot, kicket, ideiglenes bant vagy végleges bant alkalmazhatnak.\n\nSúlyosabb esetekben az adminok előzetes figyelmeztetés nélkül is alkalmazhatnak erősebb büntetést, ha azt a helyzet indokolja.\n\nA moderációs büntetések másik accounttal vagy bármilyen egyéb módon történő megkerülése további szankciókat vonhat maga után, beleértve a kapcsolódó accountok büntetését is."];

          await interaction.reply({
            content: `✅ A szabályzat kiküldése elkezdődött ide: ${channel}`,
            ephemeral: true
          });

          for (const part of ruleParts) {
            const embed = new EmbedBuilder()
              .setColor(config.embedColor || '#5865F2')
              .setDescription(part);

            await channel.send({ embeds: [embed] });
          }

          await sendLog(
            interaction.guild,
            `📕 ${interaction.user.tag} kiküldte a szabályzatot ide: ${channel}.`
          );
        }
        return;
      }

      if (interaction.commandName === 'role-panel') {
        const embed = new EmbedBuilder()
          .setColor(config.embedColor || '#5865F2')
          .setTitle('Válaszd ki melyik rangra van szükséged');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('selfrole_patchnote')
            .setLabel('Patch Note')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('selfrole_giveaway')
            .setLabel('Nyereményjáték')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('selfrole_guild')
            .setLabel('Céhet keresek')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
          content: '✅ A rangválasztó panel elkészült.',
          ephemeral: true
        });

        await interaction.channel.send({
          embeds: [embed],
          components: [row]
        });
        return;
      }

      if (interaction.commandName === 'role') {
        const action = interaction.options.getSubcommand();
        const user = interaction.options.getUser('felhasznalo');
        const role = interaction.options.getRole('rang');

        const member = await interaction.guild.members.fetch(user.id);
        const botMember = interaction.guild.members.me;

        if (!role.editable || role.position >= botMember.roles.highest.position) {
          await interaction.reply({
            content: '❌ Ezt a rangot nem tudom kezelni. A bot rangja legyen a kiválasztott rang felett.',
            ephemeral: true
          });
          return;
        }

        if (action === 'add') {
          await member.roles.add(role);
          await interaction.reply({
            content: `✅ ${role} hozzáadva ehhez: ${user}.`,
            ephemeral: true
          });
          await sendLog(
            interaction.guild,
            `➕ ${interaction.user.tag} hozzáadta a(z) ${role.name} rangot ehhez: ${user.tag}.`
          );
        } else {
          await member.roles.remove(role);
          await interaction.reply({
            content: `✅ ${role} elvéve ettől: ${user}.`,
            ephemeral: true
          });
          await sendLog(
            interaction.guild,
            `➖ ${interaction.user.tag} elvette a(z) ${role.name} rangot ettől: ${user.tag}.`
          );
        }
        return;
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('selfrole_')) {
        const roleMap = {
          selfrole_patchnote: { id: config.patchNoteRoleId, label: 'Patch Note' },
          selfrole_giveaway: { id: config.giveawayRoleId, label: 'Nyereményjáték' },
          selfrole_guild: { id: config.guildSearchRoleId, label: 'Céhet keresek' }
        };

        const selected = roleMap[interaction.customId];
        if (!selected || !selected.id) {
          await interaction.reply({
            content: '❌ Ehhez a gombhoz nincs rang beállítva a config.json fájlban.',
            ephemeral: true
          });
          return;
        }

        const role = interaction.guild.roles.cache.get(selected.id);
        if (!role) {
          await interaction.reply({
            content: `❌ A(z) ${selected.label} rang nem található. Ellenőrizd a rang ID-ját a config.json fájlban.`,
            ephemeral: true
          });
          return;
        }

        const botMember = interaction.guild.members.me;
        if (!role.editable || role.position >= botMember.roles.highest.position) {
          await interaction.reply({
            content: `❌ Nem tudom kezelni a(z) ${role.name} rangot. A bot rangját helyezd fölé a ranglistában.`,
            ephemeral: true
          });
          return;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          await interaction.reply({
            content: `➖ Levetted magadról ezt a rangot: ${role}.`,
            ephemeral: true
          });
          await sendLog(
            interaction.guild,
            `➖ ${interaction.user.tag} levette magáról a(z) ${role.name} rangot.`
          );
        } else {
          await member.roles.add(role);
          await interaction.reply({
            content: `✅ Megkaptad ezt a rangot: ${role}.`,
            ephemeral: true
          });
          await sendLog(
            interaction.guild,
            `➕ ${interaction.user.tag} felvette magára a(z) ${role.name} rangot.`
          );
        }
        return;
      }

      if (interaction.customId.startsWith('ticket_create_')) {
        const ticketTypes = {
          ticket_create_general: { label: 'Általános hiba', slug: 'altalanos-hiba' },
          ticket_create_account: { label: 'Fiókprobléma', slug: 'fiokproblema' },
          ticket_create_report: { label: 'Játékos jelentése', slug: 'jatekos-jelentese' }
        };
        const ticketType = ticketTypes[interaction.customId];

        if (!ticketType) return;
        await interaction.deferReply({ ephemeral: true });

        const category = interaction.guild.channels.cache.get(config.ticketCategoryId);
        const staffRole = interaction.guild.roles.cache.get(config.staffRoleId);

        if (!category || category.type !== ChannelType.GuildCategory) {
          await interaction.editReply('❌ A ticket kategória hibás vagy nincs beállítva a config.json fájlban.');
          return;
        }

        if (!staffRole) {
          await interaction.editReply('❌ A staff rang hibás vagy nincs beállítva a config.json fájlban.');
          return;
        }

        const existing = interaction.guild.channels.cache.find(ch =>
          ch.parentId === config.ticketCategoryId &&
          ch.topic === `ticket-owner:${interaction.user.id}`
        );

        if (existing) {
          await interaction.editReply(`❌ Már van nyitott ticketed: ${existing}`);
          return;
        }

        const channel = await interaction.guild.channels.create({
          name: `${config.ticketNamePrefix || 'ticket'}-${ticketType.slug}-${safeChannelName(interaction.user.username)}`,
          type: ChannelType.GuildText,
          parent: config.ticketCategoryId,
          topic: `ticket-owner:${interaction.user.id}`,
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks
              ]
            },
            {
              id: staffRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageMessages
              ]
            },
            {
              id: interaction.guild.members.me.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels
              ]
            }
          ]
        });

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Ticket bezárása')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );

        const welcome = new EmbedBuilder()
          .setColor(config.embedColor || '#5865F2')
          .setTitle(`🎫 ${ticketType.label}`)
          .setDescription(
            `Szia ${interaction.user}!\nÍrd le részletesen, miben segíthetünk.\n\nA ticketet az alábbi gombbal lehet bezárni.`
          )
          .setTimestamp();

        await channel.send({
          content: `${interaction.user} ${staffRole}`,
          embeds: [welcome],
          components: [closeRow],
          allowedMentions: {
            users: [interaction.user.id],
            roles: [staffRole.id]
          }
        });

        await interaction.editReply(`✅ Ticket létrehozva: ${channel}`);
        await sendLog(
          interaction.guild,
          `🎫 Új ${ticketType.label} ticket: ${channel.name} – nyitotta: ${interaction.user.tag}.`
        );
        return;
      }

      if (interaction.customId === 'ticket_close') {
        const ownerId = interaction.channel.topic?.replace('ticket-owner:', '');

        const isOwner = ownerId === interaction.user.id;
        const isStaff = interaction.member.roles.cache.has(config.staffRoleId);
        const canManageChannels = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

        if (!isOwner && !isStaff && !canManageChannels) {
          await interaction.reply({
            content: '❌ Nincs jogosultságod ennek a ticketnek a bezárásához.',
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: '🔒 A ticket 5 másodperc múlva bezárul...'
        });

        await sendLog(
          interaction.guild,
          `🔒 Ticket bezárva: ${interaction.channel.name} – bezárta: ${interaction.user.tag}.`
        );

        setTimeout(async () => {
          await interaction.channel.delete('Ticket bezárva').catch(() => {});
        }, 5000);
      }
    }
  } catch (error) {
    console.error('Interakciós hiba:', error);

    const payload = {
      content: '❌ Hiba történt a művelet végrehajtása közben.',
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(token);
