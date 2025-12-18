import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("chat", "routes/chat.tsx"),
	route("login", "routes/login.tsx"),
	route("request-access", "routes/request-access.tsx"),
	route("approve-access", "routes/approve-access.tsx"),
	route("admin/users", "routes/admin-users.tsx"),
	route("api/auth/*", "routes/api.auth.ts"),
] satisfies RouteConfig;
