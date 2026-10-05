import { handle } from '../../server/app';
import type { Env } from '../../server/types';

/** Toutes les routes /api/* (Cloudflare Pages Functions). Le reste du site est servi tel quel (fichiers statiques). */
export const onRequest = (ctx: { request: Request; env: Env }) => handle(ctx.request, ctx.env);
