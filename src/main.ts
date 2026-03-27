import { INestApplication, Logger } from '@nestjs/common';
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
const API_DEFAULT_HOST = 'localhost';

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
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(multipart);

  const apiPrefix = process.env.API_PREFIX || API_DEFAULT_PREFIX;
  app.setGlobalPrefix(apiPrefix);

  const swaggerEnabled =
    !process.env.SWAGGER_ENABLE || process.env.SWAGGER_ENABLE === '1';
  if (swaggerEnabled) {
    createSwagger(app);
  }

  const port = Number(process.env.PORT ?? API_DEFAULT_PORT);
  const host = process.env.HOST || API_DEFAULT_HOST;

  await app.listen(port, host);

  logger.log(`API server is running at: http://${host}:${port}/${apiPrefix}`);
  if (swaggerEnabled) {
    logger.log(
      `Swagger docs available at: http://${host}:${port}/${apiPrefix}${SWAGGER_PREFIX}`,
    );
  }
}

void bootstrap();
