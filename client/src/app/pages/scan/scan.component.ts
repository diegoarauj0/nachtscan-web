import { InterfaceFindStatusNicknameData, NachtscanService } from "../../services/nachtscan.service";
import { LucideCircleAlert, LucideArrowLeft, LucideCompass, LucideCopy, LucideCopyCheck } from "@lucide/angular";
import { Component, computed, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { catchError, Observable, of, switchMap, throwError, timer } from "rxjs";
import { SourceComponent } from "../../components/source/source.component";
import { InterfaceSourceScan } from "../../types/nachtscan.type";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { LocalStorageService } from "../../services/localStorage.service";

interface InterfaceState {
  data: InterfaceFindStatusNicknameData | null;
  loading: boolean;
  error: boolean;
}

interface InterfaceState {
  data: InterfaceFindStatusNicknameData | null;
  loading: boolean;
  error: boolean;
}

@Component({
  standalone: true,
  selector: "app-scan",
  imports: [
    LucideCircleAlert,
    LucideArrowLeft,
    RouterLink,
    LucideCopy,
    LucideCompass,
    SourceComponent,
    LucideCopyCheck,
  ],
  templateUrl: "./scan.component.html",
  styleUrl: "./scan.component.css",
})
export class ScanComponent implements OnInit {
  private readonly localStorageService = inject(LocalStorageService);
  private readonly nachtscanService = inject(NachtscanService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly MAX_ERROR_RETRIES = 5;
  private readonly MAX_FAILED_RETRIES = 5;
  private readonly RESCAN_POLL_INTERVAL_MS = 1000;
  private readonly STATUS_POLL_INTERVAL_MS = 2000;

  public readonly filter = signal<"found" | "not_found" | "all">("all");
  public readonly state = signal<InterfaceState>({ loading: false, error: false, data: null });

  public readonly copied = signal(false);

  public readonly filteredSources = computed(() => {
    const filter = this.filter();
    const sources = this.state().data?.sources ?? [];

    if (filter === "all") {
      return sources;
    }

    return sources.filter((source) => source.status === filter);
  });

  public changeStatus(status: "found" | "not_found" | "all"): void {
    this.filter.set(status);
  }

  public async copyNickname(): Promise<void> {
    const nickname = this.state().data?.scan.nickname;

    if (!nickname) {
      return;
    }

    try {
      await navigator.clipboard.writeText(nickname);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {/** */}
  }

  public ngOnInit(): void {
    this.state.update((state) => ({ ...state, loading: true, error: false }));

    this.route.paramMap
      .pipe(
        switchMap((params) => this.waitForScan(params.get("nickname")!)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (status) => {
          this.state.set({ loading: false, error: false, data: status });

          const localHistory = this.localStorageService.get<InterfaceFindStatusNicknameData[]>("localHistory") || [];

          let updated = false;

          localHistory.map((data) => {
            if (data.scan.nickname === status.scan.nickname) {
              updated = true;
              return status;
            }
            return data;
          });

          if (updated === false) localHistory.push(status);

          this.localStorageService.set("localHistory", localHistory);
        },
        error: () => this.state.update((state) => ({ ...state, loading: false, error: true })),
      });
  }

  private isInvalidCache(sources: InterfaceSourceScan[]): boolean {
    const now = new Date();
    return sources.some((source) => source.cacheExpiresAt !== null && new Date(source.cacheExpiresAt) < now);
  }

  private waitForScan(nickname: string, attempts = 0): Observable<InterfaceFindStatusNicknameData> {
    return this.nachtscanService.findStatusNickname(nickname).pipe(
      catchError((err) => {
        if (err.status === 404) {
          return this.triggerScanAndRetry(nickname, attempts);
        }

        if (attempts < this.MAX_ERROR_RETRIES) {
          return this.waitForScan(nickname, attempts + 1);
        }

        return throwError(() => err);
      }),

      switchMap((status) => {
        if (status.scan.status === "completed") {
          if (this.isInvalidCache(status.sources)) {
            this.state.set({ loading: true, error: false, data: status });
            return this.triggerScanAndRetry(nickname, attempts);
          }

          return of(status);
        }

        if (status.scan.status === "failed") {
          this.state.update(() => ({ loading: false, error: true, data: status }));

          if (attempts < this.MAX_FAILED_RETRIES) {
            return this.triggerScanAndRetry(nickname, attempts + 1);
          }

          return throwError(() => status);
        }

        this.state.update(() => ({ loading: true, error: false, data: status }));
        return timer(this.STATUS_POLL_INTERVAL_MS).pipe(switchMap(() => this.waitForScan(nickname, attempts)));
      }),
    );
  }

  private triggerScanAndRetry(nickname: string, attempts: number): Observable<InterfaceFindStatusNicknameData> {
    return this.nachtscanService
      .scanNickname(nickname)
      .pipe(
        switchMap(() =>
          timer(this.RESCAN_POLL_INTERVAL_MS).pipe(switchMap(() => this.waitForScan(nickname, attempts))),
        ),
      );
  }
}
