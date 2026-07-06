import { InterfaceScan, InterfaceSourceScan } from "../types/nachtscan.type";
import { environment } from "../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { Observable } from "rxjs";

export interface InterfaceFindStatusNicknameData {
  sources: InterfaceSourceScan[];
  scan: InterfaceScan;
  notFound: number;
  failures: number;
  length: number;
  found: number;
}

@Service()
export class NachtscanService {
  private readonly httpClient = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;

  public findStatusNickname(nickname: string): Observable<InterfaceFindStatusNicknameData> {
    return this.httpClient.get<InterfaceFindStatusNicknameData>(`${this.API_URL}/api/scan/${nickname}/status`);
  }

  public scanNickname(nickname: string): Observable<null> {
    return this.httpClient.post<null>(`${this.API_URL}/api/scan/${nickname}`, null);
  }
}
