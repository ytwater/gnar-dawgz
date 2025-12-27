import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeContextType = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	resolvedTheme: "dark" | "light";
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [theme, setThemeState] = useState<Theme>(() => {
		if (typeof window === "undefined") return "system";
		const saved = localStorage.getItem("theme") as Theme | null;
		return saved || "system";
	});

	const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => {
		if (typeof window === "undefined") return "dark";
		const saved = localStorage.getItem("theme") as Theme | null;
		if (saved === "dark") return "dark";
		if (saved === "light") return "light";
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	});

	useEffect(() => {
		const root = document.documentElement;
		
		const getResolvedTheme = (): "dark" | "light" => {
			if (theme === "system") {
				return window.matchMedia("(prefers-color-scheme: dark)").matches
					? "dark"
					: "light";
			}
			return theme;
		};

		const resolved = getResolvedTheme();
		setResolvedTheme(resolved);

		if (resolved === "dark") {
			root.classList.add("dark");
			root.classList.remove("light");
		} else {
			root.classList.remove("dark");
			root.classList.add("light");
		}

		localStorage.setItem("theme", theme);
	}, [theme]);

	useEffect(() => {
		if (theme !== "system") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			const resolved = mediaQuery.matches ? "dark" : "light";
			setResolvedTheme(resolved);
			const root = document.documentElement;
			if (resolved === "dark") {
				root.classList.add("dark");
				root.classList.remove("light");
			} else {
				root.classList.remove("dark");
				root.classList.add("light");
			}
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
	};

	return (
		<ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context)
		throw new Error("useTheme must be used within ThemeProvider");
	return context;
};

