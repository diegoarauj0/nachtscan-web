import { ApiProperty, getSchemaPath } from "@nestjs/swagger";

export class ScanDto {
  @ApiProperty({ example: "octocat" })
  public nickname!: string;

  @ApiProperty({ enum: ["pending", "completed", "failed"], example: "pending" })
  public status!: "pending" | "completed" | "failed";

  @ApiProperty({ example: "2026-06-28T12:00:00.000Z" })
  public createdAt!: string;

  @ApiProperty({ example: "2026-06-28T12:00:00.000Z" })
  public startedAt!: string;

  @ApiProperty({ example: null, nullable: true })
  public completedAt!: string | null;
}

export class SourceScanDto {
  @ApiProperty({ example: "github" })
  public sourceId!: string;

  @ApiProperty({ example: "Github" })
  public sourceName!: string;

  @ApiProperty({ example: "https://github.com" })
  public site!: string;

  @ApiProperty({ enum: ["pending", "found", "not_found", "failed"], example: "found" })
  public status!: "pending" | "found" | "not_found" | "failed";

  @ApiProperty({ example: "https://github.com/octocat" })
  public profileUrl!: string;

  @ApiProperty({ example: false })
  public cached!: boolean;

  @ApiProperty({ example: null, nullable: true })
  public cachedAt!: string | null;

  @ApiProperty({ example: null, nullable: true })
  public cacheExpiresAt!: string | null;

  @ApiProperty({ example: "2026-06-28T12:00:00.000Z" })
  public createdAt!: string;

  @ApiProperty({ example: "2026-06-28T12:00:00.000Z" })
  public startedAt!: string;

  @ApiProperty({ example: "2026-06-28T12:00:03.000Z", nullable: true })
  public completedAt!: string | null;

  @ApiProperty({ example: null, nullable: true })
  public error!: string | null;
}

export class FindStatusNicknameResponseDto {
  @ApiProperty({ type: ScanDto })
  public scan!: ScanDto;

  @ApiProperty({
    additionalProperties: { $ref: getSchemaPath(SourceScanDto) },
    example: [
      {
        sourceId: "github",
        sourceName: "Github",
        site: "https://github.com",
        status: "found",
        profileUrl: "https://github.com/octocat",
        cached: false,
        cachedAt: null,
        cacheExpiresAt: null,
        createdAt: "2026-06-28T12:00:00.000Z",
        startedAt: "2026-06-28T12:00:00.000Z",
        completedAt: "2026-06-28T12:00:03.000Z",
        error: null,
      },
    ],
    type: "array",
  })
  public sources!: SourceScanDto[];

  @ApiProperty({ type: "number" })
  public length!: number;

  @ApiProperty({ type: "number" })
  public found!: number;

  @ApiProperty({ type: "number" })
  public notFound!: number;

  @ApiProperty({ type: "number" })
  public failures!: number;
}
