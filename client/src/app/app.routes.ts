import { HomeComponent } from "./pages/home/home.component";
import { NotFoundComponent } from "./pages/notFound/notFound.component";
import { ScanComponent } from "./pages/scan/scan.component";
import { Routes } from "@angular/router";

export const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "u/:nickname", component: ScanComponent },
  { path: "**", component: NotFoundComponent },
];
