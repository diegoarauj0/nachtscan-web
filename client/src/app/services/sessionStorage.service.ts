import { Service } from "@angular/core";

@Service()
export class SessionStorageService {
  public set<T>(key: string, value: T): void {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  public get<T>(key: string): T | null {
    const value = sessionStorage.getItem(key);

    return value ? (JSON.parse(value) as T) : null;
  }

  public remove(key: string): void {
    sessionStorage.removeItem(key);
  }

  public clear(): void {
    sessionStorage.clear();
  }
}
