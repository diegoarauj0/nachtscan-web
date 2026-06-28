import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post } from "@nestjs/common";
import { InterfaceScan, InterfaceSourceScan } from "./scan.type";
import { ScanService } from "./services/scan.service";
import { Throttle } from "@nestjs/throttler";

interface FindStatusNicknameResponse {
  sources: Record<string, InterfaceSourceScan>;
  scan: InterfaceScan;
}

@Controller()
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post("/api/scan/:nickname")
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  public scanNickname(@Param("nickname") nickname: string): void {
    void this.scanService.scanNickname(nickname);
  }

  @Get("/api/scan/:nickname/status")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  public async findStatusNickname(@Param("nickname") nickname: string): Promise<FindStatusNicknameResponse> {
    const result = await this.scanService.findStatusNickname(nickname);

    if (result === null) throw new NotFoundException("Scan not found.");

    return result;
  }
}
