import { FindStatusNicknameResponseDto, SourceScanDto } from "./dto/scanStatusResponse.dto";
import { InterfaceScan, InterfaceSourceScan } from "./scan.type";
import { ScanService } from "./services/scan.service";
import { Throttle } from "@nestjs/throttler";
import * as Swagger from "@nestjs/swagger";
import * as NestJs from "@nestjs/common";

interface InterfaceFindStatusNicknameResponse {
  sources: Record<string, InterfaceSourceScan>;
  scan: InterfaceScan;
}

@NestJs.Controller()
@Swagger.ApiTags("scan")
@Swagger.ApiExtraModels(SourceScanDto)
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @NestJs.Post("/api/scan/:nickname")
  @NestJs.HttpCode(NestJs.HttpStatus.ACCEPTED)
  @Swagger.ApiOperation({ summary: "Start a scan for a nickname" })
  @Swagger.ApiParam({ name: "nickname", example: "octocat" })
  @Swagger.ApiAcceptedResponse({ description: "Scan request accepted." })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  public scanNickname(@NestJs.Param("nickname") nickname: string): void {
    if (nickname === "" || nickname === undefined) {
      throw new NestJs.BadRequestException("Nickname not defined.");
    }

    void this.scanService.scanNickname(nickname);
  }

  @NestJs.Get("/api/scan/:nickname/status")
  @NestJs.HttpCode(NestJs.HttpStatus.OK)
  @Swagger.ApiOperation({ summary: "Get scan status for a nickname" })
  @Swagger.ApiParam({ name: "nickname", example: "octocat" })
  @Swagger.ApiOkResponse({ description: "Scan status found.", type: FindStatusNicknameResponseDto })
  @Swagger.ApiNotFoundResponse({ description: "Scan not found." })
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  public async findStatusNickname(
    @NestJs.Param("nickname") nickname: string,
  ): Promise<InterfaceFindStatusNicknameResponse> {
    if (nickname === "" || nickname === undefined) {
      throw new NestJs.BadRequestException("Nickname not defined.");
    }

    const result = await this.scanService.findStatusNickname(nickname);

    if (result === null) throw new NestJs.NotFoundException("Scan not found.");

    return result;
  }
}
