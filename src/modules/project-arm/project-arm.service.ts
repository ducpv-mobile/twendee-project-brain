import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  BatchNormalizedResult,
  MessageItemDto,
  NormalizedDataResult,
} from './dto/collect-data.dto';
import { PrismaService } from '../common/provider';

const CONTEXT_WINDOW_SIZE = 20;

const SYSTEM_SINGLE = `You are a project data collection agent analyzing messages from project group chats.
Your task is to extract and normalize valuable project information.

You will receive:
1. A "CONVERSATION HISTORY" section with recent messages from the same group (for context)
2. The "CURRENT MESSAGE" to analyze

Use the history to understand context, but focus your output on the CURRENT MESSAGE.

Return valid JSON matching this exact schema, with NO markdown code blocks:
{
  "source": {
    "nameUser": string,
    "role": string,
    "groupName": string,
    "timestamp": string (ISO 8601)
  },
  "content": {
    "summary": string (concise summary of the current message, informed by context),
    "type": "decision" | "update" | "risk" | "question" | "task" | "other",
    "keyPoints": string[],
    "decisions": string[],
    "risks": string[],
    "tasks": string[],
    "entities": {
      "people": string[],
      "features": string[],
      "milestones": string[]
    }
  },
  "attachment": null | { "filename": string, "summary": string }
}

Type classification rules:
- decision: a clear decision was made
- update: progress or status update
- risk: risk warning or problem raised
- question: asking for information or clarification
- task: assigning or reminding about work
- other: none of the above`;

const SYSTEM_BATCH = `You are a project intelligence agent. You will receive a conversation thread (up to 50 messages) from a project group chat.

Analyze the ENTIRE conversation as a whole to extract meaningful project intelligence.
Pay attention to:
- How the conversation evolves
- Decisions that emerge from discussion
- Risks or blockers raised and whether they were resolved
- Tasks assigned across the thread
- Who said what and in what context

Return valid JSON matching this exact schema, with NO markdown code blocks:
{
  "groupName": string,
  "messageCount": number,
  "timeRange": { "from": string (ISO 8601), "to": string (ISO 8601) },
  "summary": string (paragraph summarizing the entire conversation),
  "type": "decision" | "update" | "risk" | "question" | "task" | "other",
  "keyPoints": string[],
  "decisions": string[],
  "risks": string[],
  "tasks": string[],
  "entities": {
    "people": string[],
    "features": string[],
    "milestones": string[]
  },
  "attachment": null | { "filename": string, "summary": string }
}

For "type": choose the dominant theme of the overall conversation.`;

@Injectable()
export class ProjectArmService {
  private readonly logger = new Logger(ProjectArmService.name);
  private readonly client: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async collectAndNormalize(params: {
    message: string;
    nameUser: string;
    role: string;
    groupName: string;
    fileContent?: string;
    filename?: string;
  }): Promise<NormalizedDataResult> {
    const { message, nameUser, role, groupName, fileContent, filename } =
      params;

    const history = await this.getGroupHistory(groupName);
    const historyBlock =
      history.length > 0
        ? `--- CONVERSATION HISTORY (${history.length} recent messages) ---\n${history}\n--- END OF HISTORY ---\n\n`
        : '';

    const text = `${historyBlock}--- CURRENT MESSAGE ---
Group/Channel: ${groupName}
Sender: ${nameUser} (${role})
Content: ${message}${fileContent ? `\n\nAttached file (${filename}):\n${fileContent}` : ''}`;

    const stream = this.client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: SYSTEM_SINGLE,
      messages: [{ role: 'user', content: text }],
    });

    const finalMessage = await stream.finalMessage();
    const result = this.parseJson<NormalizedDataResult>(
      finalMessage,
      (parsed) => {
        if (!parsed.source.timestamp) {
          parsed.source.timestamp = new Date().toISOString();
        }
      },
    );

    await this.saveMessage({ groupName, nameUser, role, message, result });

    return result;
  }

  async collectAndNormalizeBatch(params: {
    groupName: string;
    messages: MessageItemDto[];
    fileContent?: string;
    filename?: string;
  }): Promise<BatchNormalizedResult> {
    const { groupName, messages, fileContent, filename } = params;

    const thread = messages
      .map((m, i) => {
        const ts = m.timestamp ?? '';
        return `[${i + 1}] ${ts ? `(${ts}) ` : ''}${m.nameUser} (${m.role}): ${m.message}`;
      })
      .join('\n');

    const text = `Group/Channel: ${groupName}
Total messages: ${messages.length}

--- CONVERSATION THREAD ---
${thread}
--- END OF THREAD ---${fileContent ? `\n\nAttached file (${filename}):\n${fileContent}` : ''}`;

    const stream = this.client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      system: SYSTEM_BATCH,
      messages: [{ role: 'user', content: text }],
    });

    const finalMessage = await stream.finalMessage();
    const result = this.parseJson<BatchNormalizedResult>(finalMessage);

    await this.prisma.groupMessage.createMany({
      data: messages.map((m) => ({
        groupName,
        nameUser: m.nameUser,
        role: m.role,
        message: m.message,
      })),
    });

    return result;
  }

  private async getGroupHistory(groupName: string): Promise<string> {
    const rows = await this.prisma.groupMessage.findMany({
      where: { groupName },
      orderBy: { createdAt: 'desc' },
      take: CONTEXT_WINDOW_SIZE,
      select: { nameUser: true, role: true, message: true, createdAt: true },
    });

    return rows
      .reverse()
      .map(
        (r) =>
          `(${r.createdAt.toISOString()}) ${r.nameUser} (${r.role}): ${r.message}`,
      )
      .join('\n');
  }

  private async saveMessage(params: {
    groupName: string;
    nameUser: string;
    role: string;
    message: string;
    result: NormalizedDataResult;
  }): Promise<void> {
    await this.prisma.groupMessage.create({
      data: {
        groupName: params.groupName,
        nameUser: params.nameUser,
        role: params.role,
        message: params.message,
        normalized: params.result as object,
      },
    });
  }

  private parseJson<T>(
    finalMessage: Anthropic.Message,
    transform?: (parsed: T) => void,
  ): T {
    const textBlock = finalMessage.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );

    if (!textBlock) {
      throw new Error('No text response from Claude');
    }

    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    try {
      const parsed = JSON.parse(raw) as T;
      transform?.(parsed);
      return parsed;
    } catch {
      this.logger.error('Failed to parse Claude response as JSON', raw);
      throw new Error('Claude returned invalid JSON');
    }
  }
}
