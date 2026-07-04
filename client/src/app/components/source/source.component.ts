import {
  LucideCircleCheckBig,
  LucideCircleDashed,
  LucideCircleQuestionMark,
  LucideCircleX,
  LucideGlobe,
  LucideUserRoundArrowLeft,
} from "@lucide/angular";
import { InterfaceSourceScan } from "../../types/nachtscan.type";
import { Component, Input } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-source",
  imports: [LucideGlobe, LucideUserRoundArrowLeft, LucideCircleX, LucideCircleCheckBig, LucideCircleDashed, LucideCircleQuestionMark],
  templateUrl: "./source.component.html",
  styleUrl: "./source.component.css",
})
export class SourceComponent {
  @Input() source!: InterfaceSourceScan;
}
