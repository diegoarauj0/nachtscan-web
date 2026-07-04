import { Service, signal } from "@angular/core";

type Theme = "dark" | "light";

@Service()
export class ThemeService {
  readonly theme = signal<Theme>("light");

  constructor() {
    this.load();
  }

  public setTheme(theme: Theme): void {
    this.theme.set(theme);

    document.documentElement.setAttribute("data-theme", theme);

    localStorage.setItem("theme", theme);
  }

  public toggle(): void {
    this.setTheme(this.theme() === "light" ? "dark" : "light");
  }

  private load(): void {
    const savedTheme = localStorage.getItem("theme") as Theme | null;

    this.setTheme(savedTheme ?? "light");
  }
}
