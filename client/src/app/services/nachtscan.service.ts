import { InterfaceScan, InterfaceSourceScan } from "../types/nachtscan.type";
import { HttpClient } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { Observable } from "rxjs";

export interface InterfaceFindStatusNicknameData {
  sources: InterfaceSourceScan[];
  notFound: number;
  failures: number;
  found: number;
  length: number;
  scan: InterfaceScan;
}

@Service()
export class NachtscanService {
  private readonly httpClient = inject(HttpClient);
  private readonly API_URL = "http://localhost:3000";

  public findStatusNickname(nickname: string): Observable<InterfaceFindStatusNicknameData> {
    return this.httpClient.get<InterfaceFindStatusNicknameData>(`${this.API_URL}/api/scan/${nickname}/status`);
  }

  public scanNickname(nickname: string): Observable<null> {
    return this.httpClient.post<null>(`${this.API_URL}/api/scan/${nickname}`, null);
  }
}
