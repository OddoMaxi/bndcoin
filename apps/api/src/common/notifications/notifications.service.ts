import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  userId?: string;
  channel: NotificationChannel;
  template: string;
  destination: string;
  payload?: Record<string, unknown>;
}

/**
 * Notification dispatch. In this build every channel is MOCKED (no SMS/email/push
 * credentials configured). Real providers plug in behind the same `send()`.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async send(input: NotifyInput): Promise<void> {
    const mocked = this.config.orangeMode === 'mock';
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        channel: input.channel,
        template: input.template,
        destination: input.destination,
        payload: input.payload as never,
        status: mocked ? 'MOCKED' : 'QUEUED',
        sentAt: mocked ? new Date() : null,
      },
    });
    this.logger.log(
      `[notification:${mocked ? 'MOCK' : 'QUEUED'}] ${input.channel} ${input.template} -> ${input.destination} (${row.id})`,
    );
  }
}
