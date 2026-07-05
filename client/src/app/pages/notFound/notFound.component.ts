import { Component } from "@angular/core";
import { LucideHouse, LucideSearchX } from "@lucide/angular";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  selector: "app-not-found",
  imports: [LucideHouse, LucideSearchX, RouterLink],
  templateUrl: "./notFound.component.html",
  styleUrl: "./notFound.component.css",
})
export class NotFoundComponent {}
