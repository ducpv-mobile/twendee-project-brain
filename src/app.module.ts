import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './modules/common';
import { ProjectArmModule } from './modules/project-arm/project-arm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.development',
    }),
    CommonModule,
    ProjectArmModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
