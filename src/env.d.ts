interface ImportMetaEnv {
  readonly PUBLIC_SERVER_ADDRESS?: string;
  readonly PUBLIC_MAP_URL?: string;
  readonly PUBLIC_DISCORD_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
