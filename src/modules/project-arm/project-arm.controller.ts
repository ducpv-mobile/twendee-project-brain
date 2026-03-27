import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import {
  BatchNormalizedResult,
  CollectBatchDto,
  CollectDataDto,
  NormalizedDataResult,
} from './dto/collect-data.dto';
import { ProjectArmService } from './project-arm.service';

@ApiTags('project-arm')
@Controller('project-arm')
export class ProjectArmController {
  constructor(private readonly projectArmService: ProjectArmService) {}

  @Post('collect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Collect and normalize a single message',
    description:
      'Accepts a single message with nameUser, role, groupName and optional file. Supports multipart/form-data and application/json.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: CollectDataDto })
  async collect(@Req() request: FastifyRequest): Promise<NormalizedDataResult> {
    const contentType = request.headers['content-type'] ?? '';
    const isMultipart = contentType.includes('multipart/form-data');

    let message: string | undefined;
    let nameUser: string | undefined;
    let role: string | undefined;
    let groupName: string | undefined;
    let fileContent: string | undefined;
    let filename: string | undefined;

    if (isMultipart) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'field') {
          const value = part.value as string;
          if (part.fieldname === 'message') message = value;
          else if (part.fieldname === 'nameUser') nameUser = value;
          else if (part.fieldname === 'role') role = value;
          else if (part.fieldname === 'groupName') groupName = value;
        } else if (part.type === 'file') {
          filename = part.filename;
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          fileContent = Buffer.concat(chunks).toString('utf-8');
        }
      }
    } else {
      const body = request.body as Record<string, string>;
      message = body?.message;
      nameUser = body?.nameUser;
      role = body?.role;
      groupName = body?.groupName;
    }

    if (!message || !nameUser || !role || !groupName) {
      throw new BadRequestException(
        'message, nameUser, role, and groupName are required',
      );
    }

    return this.projectArmService.collectAndNormalize({
      message,
      nameUser,
      role,
      groupName,
      fileContent,
      filename,
    });
  }

  @Post('collect-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Collect and normalize a batch of messages (up to 50)',
    description:
      'Sends an entire conversation thread to Claude for context-aware analysis. Claude reads all messages together and extracts decisions, risks, tasks, and entities from the full thread. Supports multipart/form-data (with file) and application/json.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: CollectBatchDto })
  async collectBatch(
    @Req() request: FastifyRequest,
  ): Promise<BatchNormalizedResult> {
    const contentType = request.headers['content-type'] ?? '';
    const isMultipart = contentType.includes('multipart/form-data');

    let groupName: string | undefined;
    let messages: CollectBatchDto['messages'] | undefined;
    let fileContent: string | undefined;
    let filename: string | undefined;

    if (isMultipart) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'field') {
          const value = part.value as string;
          if (part.fieldname === 'groupName') groupName = value;
          else if (part.fieldname === 'messages') {
            messages = this.parseMessagesField(value);
          }
        } else if (part.type === 'file') {
          filename = part.filename;
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          fileContent = Buffer.concat(chunks).toString('utf-8');
        }
      }
    } else {
      const body = request.body as CollectBatchDto;
      groupName = body?.groupName;
      messages = body?.messages;
    }

    if (!groupName) {
      throw new BadRequestException('groupName is required');
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages must be a non-empty array');
    }
    if (messages.length > 50) {
      throw new BadRequestException('messages array must not exceed 50 items');
    }

    return this.projectArmService.collectAndNormalizeBatch({
      groupName,
      messages,
      fileContent,
      filename,
    });
  }

  private parseMessagesField(value: string): CollectBatchDto['messages'] {
    const trimmed = value.trim();
    // Try parsing as-is first (valid JSON array)
    try {
      return JSON.parse(trimmed) as CollectBatchDto['messages'];
    } catch {
      // Swagger/form sends objects without wrapping brackets — auto-wrap
      try {
        return JSON.parse(`[${trimmed}]`) as CollectBatchDto['messages'];
      } catch {
        throw new BadRequestException(
          'Field "messages" must be a valid JSON array',
        );
      }
    }
  }
}
