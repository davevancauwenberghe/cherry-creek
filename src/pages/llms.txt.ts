/**
 * /llms.txt: a plain-text summary of the site for AI assistants and other
 * tools that read pages on someone's behalf (see https://llmstxt.org).
 * Built from the same config as the pages, so it cannot drift from them.
 */
import type { APIRoute } from 'astro';
import { mods } from '@/config/mods';
import { rules, rulesPublished } from '@/config/rules';
import { count, euros, levelRewardGroups, listAnd, server } from '@/config/server';
import { site } from '@/config/site';

export const GET: APIRoute = ({ site: origin }) => {
  const url = (path: string) => new URL(path, origin).href;
  const { claims, economy } = server;

  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `${site.name} is an independent community project, not affiliated with or endorsed by Mojang or Microsoft.`,
    '',
    '## Key facts',
    '',
    '- Game: Minecraft Java Edition, survival multiplayer (SMP), running Paper',
    `- Server address: ${site.serverAddress}`,
    '- Access: whitelisted. Join the Discord and ask the community administrators for access. Joining Discord does not grant access automatically.',
    '- Language: English',
    '- Currency: in-game euros are fictional. They are not real money, payments or cryptocurrency.',
    `- Land protection: GriefPrevention. ${count(claims.startingBlocks)} starting claim blocks, ${count(claims.blocksPerHour)} more per eligible hour up to ${count(claims.maxAccruedBlocks)}, at most ${count(claims.maxClaims)} claims per player, Overworld only. Claims must be at least ${claims.minWidth} blocks wide and ${count(claims.minArea)} blocks in area. A new player's first chest is protected automatically.`,
    `- Economy: EssentialsX, VaultUnlocked and EconomyShopGUI. Players start with ${euros(economy.startingBalance)}. The server shop is the ${economy.marketName} (/market). Level rewards: ${levelRewardGroups.map((g) => `${euros(g.reward)} at level ${listAnd(g.levels)}`).join('; ')}. Claim blocks cost ${euros(economy.claimBlockPrice)} each to buy and pay ${euros(economy.claimBlockSellValue)} each when sold.`,
    '- Quality of life: homes, teleport requests, VeinMiner (natural logs and coal veins only), ToolStats, DoorsReloaded.',
    '- Community: Discord linked to in-game chat through DiscordSRV.',
    '- World map: interactive 3D map (BlueMap) with a land-claim overlay.',
    '- Backups: daily, off-site.',
    '',
    '## Pages',
    '',
    `- [Home](${url('/')}): what the server is, live server status, and how to join`,
    `- [Player guide](${url('/guide')}): joining, claiming land, the economy, homes, commands`,
    `- [Recommended mods](${url('/mods')}): ${mods.length} optional client-side mods, shaders and resource packs`,
    ...(rulesPublished ? [`- [Rules](${url('/rules')}): community rules`] : []),
    `- [Privacy](${url('/privacy')}): what the website does with visitor data`,
    '',
    '## Links',
    '',
    `- [Interactive map](${site.mapUrl})`,
    `- [Discord](${site.discordUrl})`,
    ...(rulesPublished ? ['', '## Rules', '', ...rules.map((rule) => `- ${rule}`)] : []),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
