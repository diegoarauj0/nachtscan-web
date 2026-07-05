import { RouterLink } from "@angular/router";
import { ThemeService } from "../../services/theme.service";
import { Component, inject } from "@angular/core";

@Component({
  standalone: true,
  templateUrl: "./header.component.html",
  styleUrl: "./header.component.css",
  selector: "app-header",
  imports: [RouterLink],
})
export class HeaderComponent {
  private readonly themeService = inject(ThemeService);

  public toggleTheme(): void {
    this.themeService.toggle();
  }
}
