const THEME_KEY = "exqa_theme";

export function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
}

export { THEME_KEY };
