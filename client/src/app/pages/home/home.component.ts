import { Component, inject } from "@angular/core";
import { LucideLink } from "@lucide/angular";
import { Router } from "@angular/router";

@Component({
  standalone: true,
  selector: "app-home",
  imports: [LucideLink],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.css",
})
export class HomeComponent {
  private readonly router = inject(Router);

  public onSubmit(event: SubmitEvent): void {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const data = new FormData(form);

    const nickname = data.get("nickname");

    if (nickname === null || nickname === "" || typeof nickname !== "string") return;

    this.router.navigate([`u/${data.get("nickname")}`]);
  }
}
