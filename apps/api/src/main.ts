import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './common/config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigin.split(','), credentials: true });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (!config.isProduction) {
    const swagger = new DocumentBuilder()
      .setTitle('Bory & Norbert API')
      .setDescription('Foundation + BUY USDT flow')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  }

  await app.listen(config.apiPort, '0.0.0.0');
  new Logger('Bootstrap').log(`API listening on :${config.apiPort} (prefix /api/v1)`);
}

bootstrap();
