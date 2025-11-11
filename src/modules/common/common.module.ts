import { Module } from '@nestjs/common';
import { PrismaService } from './provider';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
  controllers: [],
})
export class CommonModule {}
