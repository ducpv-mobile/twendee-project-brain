import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';

const API_DEFAULT_PORT = 3000;
const API_DEFAULT_PREFIX = 'api/v1';

const SWAGGER_TITLE = 'NOXH API';
const SWAGGER_DESCRIPTION =
  'The NOXH is a document of api about social housing in vietnam';
const SWAGGER_PREFIX = '/docs';

function createSwagger(app: INestApplication) {
  const options = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion('v1')
    .addBearerAuth()
    .build();

  const document = () => SwaggerModule.createDocument(app, options);
  SwaggerModule.setup(API_DEFAULT_PREFIX + SWAGGER_PREFIX, app, document);
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(multipart);

  app.setGlobalPrefix(process.env.API_PREFIX || API_DEFAULT_PREFIX);

  if (!process.env.SWAGGER_ENABLE || process.env.SWAGGER_ENABLE === '1') {
    createSwagger(app);
  }

  await app.listen(process.env.PORT ?? API_DEFAULT_PORT);
}

void bootstrap();
