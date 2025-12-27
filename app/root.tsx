import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	isRouteErrorResponse,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { TooltipProvider } from "~/app/providers/TooltipProvider";
import { ThemeProvider } from "~/app/providers/ThemeProvider";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5, // 5 minutes
			refetchOnWindowFocus: false,
		},
	},
});

if (typeof window !== "undefined") {
	window.global = window;
	// Only if the 'module is not defined' error persists:
	// @ts-ignore
	window.module = window.module || {};
}

export const links: Route.LinksFunction = () => [
	{ rel: "icon", href: "/favicon.png", type: "image/png" },
	{
		rel: "preload",
		href: "/gnar-dawgs-logo-transparent.webp",
		as: "image",
		type: "image/webp",
	},
	{ rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;700&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<script
					dangerouslySetInnerHTML={{
						__html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'system';
                const resolved = theme === 'system' 
                  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                  : theme;
                if (resolved === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              })();
            `,
					}}
				/>
				<style>{`
          /* Critical CSS for FCP */
          body { margin: 0; }
          .flex { display: flex; }
          .items-center { align-items: center; }
          .justify-center { justify-content: center; }
          .min-h-screen { min-height: 100vh; }
          .bg-slate-500 { background-color: rgb(100 116 139); }
          .block { display: block; }
          .w-full { width: 100%; }
          .max-w-\\[700px\\] { max-width: 700px; }
          .h-auto { height: auto; }
          .px-4 { padding-left: 1rem; padding-right: 1rem; }
        `}</style>
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
				<script src="/sw-register.js" />
			</body>
		</html>
	);
}

export default function App() {
	if (typeof window !== "undefined" && import.meta.env.BUILD_DATE) {
		console.log(
			"Build date:",
			new Date(import.meta.env.BUILD_DATE).toLocaleString(),
		);
	}
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<TooltipProvider>
					<Outlet />
				</TooltipProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
