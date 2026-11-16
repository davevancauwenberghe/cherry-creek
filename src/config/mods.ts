/**
 * Optional client-side extras shown on /mods.
 *
 * None of these are needed to play: Cherry Creek works with an unmodified
 * game. Keep the list alphabetical by name; the page renders it in this order.
 */
export type ModKind = 'Mod' | 'Library' | 'Shader' | 'Resource pack';

export interface ModEntry {
  name: string;
  kind: ModKind;
  url: string;
  /** What it does, in a sentence. */
  does: string;
  /** Anything it relies on, or a setup tip. */
  note?: string;
}

export const mods: ModEntry[] = [
  {
    name: 'AppleSkin',
    kind: 'Mod',
    url: 'https://modrinth.com/mod/appleskin',
    does: 'Shows how much hunger and saturation each food restores, right on the hunger bar and in tooltips.',
  },
  {
    name: 'Chat Heads',
    kind: 'Mod',
    url: 'https://modrinth.com/mod/chat-heads',
    does: "Puts each player's face next to their chat messages, so you can see who is talking at a glance.",
  },
  {
    name: 'Cloth Config API',
    kind: 'Library',
    url: 'https://modrinth.com/mod/cloth-config',
    does: 'Provides the settings screens that many other mods use.',
    note: 'Does nothing by itself. Install it when another mod asks for it.',
  },
  {
    name: 'Complementary Shaders – Reimagined',
    kind: 'Shader',
    url: 'https://modrinth.com/shader/complementary-reimagined',
    does: 'Soft lighting, shadows and water that stay close to the familiar Minecraft look.',
    note: 'Needs Iris Shaders. Use one Complementary pack at a time.',
  },
  {
    name: 'Complementary Shaders – Unbound',
    kind: 'Shader',
    url: 'https://modrinth.com/shader/complementary-unbound',
    does: 'The same shader family with a more realistic style: fuller skies, clouds and reflections.',
    note: 'Needs Iris Shaders. Use one Complementary pack at a time.',
  },
  {
    name: 'Default Dark Mode',
    kind: 'Resource pack',
    url: 'https://modrinth.com/resourcepack/default-dark-mode',
    does: 'Turns menus, inventories and other interface screens dark.',
  },
  {
    name: 'Default Dark Mode: Expansion',
    kind: 'Resource pack',
    url: 'https://modrinth.com/resourcepack/default-dark-mode-expansion',
    does: 'Extends the dark theme to the screens added by mods.',
    note: 'Use it together with Default Dark Mode, placed above it in the resource pack list.',
  },
  {
    name: 'Enhanced Audio',
    kind: 'Resource pack',
    url: 'https://modrinth.com/resourcepack/enhanced-audio',
    does: "Replaces the game's sounds with more realistic ones and adds many new ones.",
  },
  {
    name: 'Enhanced Audio: Ambience',
    kind: 'Resource pack',
    url: 'https://modrinth.com/resourcepack/enhanced-audio-ambience',
    does: 'Adds ambient background sounds for a more immersive world.',
    note: 'Pairs with Enhanced Audio, and also works without it.',
  },
  {
    name: 'Iris Shaders',
    kind: 'Mod',
    url: 'https://modrinth.com/mod/iris',
    does: 'Lets the game load shader packs such as Complementary.',
    note: 'Needs Sodium.',
  },
  {
    name: 'Jade',
    kind: 'Mod',
    url: 'https://modrinth.com/mod/jade',
    does: 'Shows a small label for whatever block or creature you are looking at.',
  },
  {
    name: 'Mod Menu',
    kind: 'Mod',
    url: 'https://modrinth.com/mod/modmenu',
    does: 'Adds a list of your installed mods to the menu, with a button to open the settings of each.',
  },
  {
    name: 'Now Playing',
    kind: 'Mod',
    url: 'https://modrinth.com/mod/now-playing',
    does: 'Shows the name of the music track whenever the soundtrack changes.',
  },
  {
    name: 'Sodium',
    kind: 'Mod',
    url: 'https://modrinth.com/mod/sodium',
    does: 'Makes the game render much faster and more smoothly. The one to start with.',
  },
  {
    name: 'Text Placeholder API',
    kind: 'Library',
    url: 'https://modrinth.com/mod/placeholder-api',
    does: 'A text-handling library that some other mods rely on.',
    note: 'Does nothing by itself. Install it when another mod asks for it.',
  },
  {
    name: "Xaero's Minimap",
    kind: 'Mod',
    url: 'https://modrinth.com/mod/xaeros-minimap',
    does: 'A minimap in the corner of the screen, with waypoints for the places you want to find again.',
  },
  {
    name: "Xaero's World Map",
    kind: 'Mod',
    url: 'https://modrinth.com/mod/xaeros-world-map',
    does: 'A full-screen map of everywhere you have explored.',
    note: "Works together with Xaero's Minimap.",
  },
];

export const modKinds: ModKind[] = ['Mod', 'Shader', 'Resource pack', 'Library'];
