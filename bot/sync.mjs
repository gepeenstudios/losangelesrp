// Correr el bot a mano: DISCORD_TOKEN=... SYNC_KEY=... node bot/sync.mjs [--dry]
// En producción corre solo cada 15 min en Netlify (web/netlify/functions/discord-sync.mjs).
import { sync } from '../web/netlify/functions/discord-sync.mjs';
await sync(process.env, { dry: process.argv.includes('--dry') });
