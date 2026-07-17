import { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/app.module";
import { setupSwagger } from "@/swagger";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.TRUST_PROXY === "true") {
    new Logger("bootstrap").log("trust proxy enable");
    app.set("trust proxy", process.env.TRUST_PROXY === "true");
  }

  app.enableCors();

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
