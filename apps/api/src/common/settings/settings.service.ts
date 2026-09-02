import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Runtime-editable configuration (audited via the admin controller). */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T = unknown>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  }

  async set(key: string, value: unknown, updatedBy?: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value: value as never, updatedBy },
      create: { key, value: value as never, updatedBy },
    });
  }

  async all(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
