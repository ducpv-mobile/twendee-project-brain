import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CollectDataDto {
  @ApiProperty({ description: 'Message content from project group' })
  message: string;

  @ApiProperty({ description: 'Name of the user sending the message' })
  nameUser: string;

  @ApiProperty({
    description: 'Role of the user in the project (PM, Dev, BA, QA, ...)',
  })
  role: string;

  @ApiProperty({ description: 'Name of the group / project channel' })
  groupName: string;

  @ApiPropertyOptional({
    description: 'Attached document file (optional)',
    type: 'string',
    format: 'binary',
  })
  file?: Buffer;
}

export class MessageItemDto {
  @ApiProperty({ description: 'Message content' })
  message: string;

  @ApiProperty({ description: 'Name of the user who sent this message' })
  nameUser: string;

  @ApiProperty({ description: 'Role of the user (PM, Dev, BA, QA, ...)' })
  role: string;

  @ApiPropertyOptional({
    description: 'Message timestamp (ISO 8601). Defaults to current time if omitted.',
    example: '2026-03-27T10:00:00Z',
  })
  timestamp?: string;
}

export class CollectBatchDto {
  @ApiProperty({ description: 'Name of the group / project channel' })
  groupName: string;

  @ApiProperty({
    description: 'Array of messages to analyze (max 50)',
    type: [MessageItemDto],
  })
  messages: MessageItemDto[];

  @ApiPropertyOptional({
    description: 'Shared document file attached to this conversation batch',
    type: 'string',
    format: 'binary',
  })
  file?: Buffer;
}

export class NormalizedDataResult {
  @ApiProperty()
  source: {
    nameUser: string;
    role: string;
    groupName: string;
    timestamp: string;
  };

  @ApiProperty()
  content: {
    summary: string;
    type: 'decision' | 'update' | 'risk' | 'question' | 'task' | 'other';
    keyPoints: string[];
    decisions: string[];
    risks: string[];
    tasks: string[];
    entities: {
      people: string[];
      features: string[];
      milestones: string[];
    };
  };

  @ApiPropertyOptional()
  attachment?: {
    filename: string;
    summary: string;
  };
}

export class BatchNormalizedResult {
  @ApiProperty({ description: 'Name of the group / project channel' })
  groupName: string;

  @ApiProperty({ description: 'Number of messages analyzed' })
  messageCount: number;

  @ApiProperty({ description: 'Time range of the conversation batch' })
  timeRange: {
    from: string;
    to: string;
  };

  @ApiProperty({ description: 'Overall summary of the entire conversation' })
  summary: string;

  @ApiProperty({
    description: 'Dominant type of the conversation',
    enum: ['decision', 'update', 'risk', 'question', 'task', 'other'],
  })
  type: 'decision' | 'update' | 'risk' | 'question' | 'task' | 'other';

  @ApiProperty({ description: 'Key points extracted from the conversation' })
  keyPoints: string[];

  @ApiProperty({ description: 'Decisions made in this conversation' })
  decisions: string[];

  @ApiProperty({ description: 'Risks identified' })
  risks: string[];

  @ApiProperty({ description: 'Tasks assigned or mentioned' })
  tasks: string[];

  @ApiProperty({ description: 'Entities extracted from the conversation' })
  entities: {
    people: string[];
    features: string[];
    milestones: string[];
  };

  @ApiPropertyOptional({ description: 'Attachment summary if a file was provided' })
  attachment?: {
    filename: string;
    summary: string;
  };
}
