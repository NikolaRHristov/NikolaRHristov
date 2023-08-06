import type { ExecutionContext } from "@cloudflare/workers-types/experimental";
import { Request } from "@cloudflare/workers-types/experimental";
import { encrypt } from "@nowplayingcards/common";
import type { IRequest } from "itty-router/Router";
import { Router } from "itty-router/Router";
import { Buffer } from "node:buffer";
import redirect from "./Library/Redirect.js";
import response from "./Library/Response.js";

export interface Env {
	BASE: string;
	SPOTIFY_CLIENT_ID: string;
	SPOTIFY_CLIENT_SECRET: string;
	Spotify: KVNamespace;
}

export interface TokenResponse {
	access_token: string;
}

export interface MeResponse {
	display_name: string;
	id: string;
}

const router = Router();

router
	.get("/spotify", async (request: IRequest, env: Env) => {
		/**
		 * Worker
		 */
		const base = new URL(env.BASE);
		const current = new URL(request.url);
		const worker = `${current.origin}${current.pathname}`;
		const searchParams = current.searchParams;

		/**
		 * State
		 */
		const state = searchParams.get("state");

		/**
		 * UUID
		 */
		const uuid =
			searchParams.get("uuid") ??
			state?.split("|")[0] ??
			crypto.randomUUID();

		/**
		 * Key
		 */
		const key =
			searchParams.get("key") ??
			state?.split("|")[1] ??
			(
				(await crypto.subtle.exportKey(
					"jwk",
					(await crypto.subtle.generateKey(
						{ name: "AES-GCM", length: 256 },
						true,
						["encrypt", "decrypt"]
					)) as CryptoKey
				)) as JsonWebKey
			).k ??
			"";

		/**
		 * Spotify Code
		 */
		const code = searchParams.get("code");

		if (code) {
			const { access_token } = (await (
				await fetch("https://accounts.spotify.com/api/token", {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						Authorization: `Basic ${Buffer.from(
							`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
						).toString("base64")}`,
					},
					body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(
						worker
					)}`,
				})
			).json()) satisfies TokenResponse;

			if (access_token) {
				await env.Spotify.put(
					uuid,
					JSON.stringify(
						await encrypt(
							{
								AccessToken: access_token,
							},
							key
						)
					)
				);
			}

			base.searchParams.append("uuid", uuid);

			return redirect(base.href);
		} else {
			return await redirect(
				`https://accounts.spotify.com/authorize?client_id=${
					env.SPOTIFY_CLIENT_ID
				}&response_type=code&redirect_uri=${encodeURIComponent(
					worker
				)}&scope=user-read-private user-read-email user-read-playback-state user-read-currently-playing&state=${`${uuid}|${key}`}`
			);
		}
	})
	.get(
		"*",
		async () =>
			await response(
				{
					error: "Not found.",
				},
				404
			)
	);

export default <ExportedHandler<Env>>{
	fetch: async (request: Request, env: Env, _ctx: ExecutionContext) =>
		await router.handle(request, env),
};
