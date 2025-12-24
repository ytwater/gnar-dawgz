import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "./router";

const link = new RPCLink({
	url: `${typeof window !== "undefined" ? window.location.origin : ""}/api/orpc`,
});

export const orpcClient: RouterClient<AppRouter> = createORPCClient(link);

