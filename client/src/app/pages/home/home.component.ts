import { InterfaceFindStatusNicknameData } from "../../services/nachtscan.service";
import { LucideArrowRight, LucideLink, LucideTrash } from "@lucide/angular";
import { LocalStorageService } from "../../services/localStorage.service";
import { Component, computed, inject,  signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";

@Component({
  standalone: true,
  selector: "app-home",
  imports: [LucideLink, LucideArrowRight, LucideTrash, RouterLink],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.css",
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly localStorageService = inject(LocalStorageService);

  private readonly localHistory = signal(
    this.localStorageService.get<InterfaceFindStatusNicknameData[]>("localHistory") ?? [],
  );

  public readonly sources = computed(() =>
    this.localHistory().map((status) => {
      const percentage = (100 / status.length) * status.notFound;

      return {
        force: percentage > 75 ? 3 : percentage > 50 ? 2 : percentage > 25 ? 1 : 0,
        nickname: status.scan.nickname,
        notFound: status.notFound,
        total: status.length,
        percentage,
      };
    }),
  );

  public resetHistory(): void {
    this.localStorageService.remove("localHistory");
    this.localHistory.set([]);
  }

  public onSubmit(event: SubmitEvent): void {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const data = new FormData(form);

    const nickname = data.get("nickname");

    if (nickname === null || nickname === "" || typeof nickname !== "string") return;

    this.router.navigate([`u/${data.get("nickname")}`]);
  }
}
