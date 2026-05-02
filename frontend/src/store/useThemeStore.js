import { create } from "zustand";

/**
 * Global theme state store.
 * Manages light/dark theme preference with localStorage persistence.
 */
export const useThemeStore = create((set, get) => {
  // Helper to apply theme to DOM
  const applyTheme = (theme) => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
      html.style.colorScheme = "dark";
    } else {
      html.classList.remove("dark");
      html.style.colorScheme = "light";
    }
  };

  // Try to load persisted theme from localStorage
  const storedTheme = typeof window !== "undefined" ? localStorage.getItem("permitiq-theme") : null;
  const initialTheme = storedTheme === "dark" ? "dark" : "light";

  return {
    theme: initialTheme,

    setTheme: (newTheme) => {
      const theme = newTheme === "dark" ? "dark" : "light";
      set({ theme });
      if (typeof window !== "undefined") {
        localStorage.setItem("permitiq-theme", theme);
        applyTheme(theme);
      }
    },

    toggleTheme: () => {
      const current = get().theme;
      const newTheme = current === "dark" ? "light" : "dark";
      get().setTheme(newTheme);
    },

    // Apply the current theme to DOM (e.g., on app startup)
    applyStoredTheme: () => {
      const current = get().theme;
      applyTheme(current);
    },
  };
});
