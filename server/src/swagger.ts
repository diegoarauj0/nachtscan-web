import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication, Logger } from "@nestjs/common";

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Nachtscan API")
    .setDescription("API for scanning usernames across configured sources.")
    .setVersion("1.0.0")
    .addTag("scan")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/docs-json",
  });

  Logger.log("Swagger in http://localhost:3000/api/docs");
}
