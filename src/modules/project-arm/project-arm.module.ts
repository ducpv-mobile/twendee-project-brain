import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { ProjectArmController } from './project-arm.controller';
import { ProjectArmService } from './project-arm.service';

@Module({
  imports: [CommonModule],
  controllers: [ProjectArmController],
  providers: [ProjectArmService],
})
export class ProjectArmModule {}
