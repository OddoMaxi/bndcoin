import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ValidationError } from '../../common/errors/domain-errors';
import { BLOCKCHAIN_PROVIDER, BlockchainProvider } from './blockchain.provider';

@Injectable()
export class CryptoNetworksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(BLOCKCHAIN_PROVIDER) private readonly chain: BlockchainProvider,
  ) {}

  listEnabled() {
    return this.prisma.cryptoNetwork.findMany({ where: { enabled: true }, orderBy: { networkName: 'asc' } });
  }

  listAll() {
    return this.prisma.cryptoNetwork.findMany({ orderBy: { networkName: 'asc' } });
  }

  async getEnabledOrThrow(id: string) {
    const net = await this.prisma.cryptoNetwork.findUnique({ where: { id } });
    if (!net || !net.enabled) throw new ValidationError('Selected network is not available');
    return net;
  }

  async validateAddress(networkId: string, address: string): Promise<boolean> {
    const net = await this.getEnabledOrThrow(networkId);
    return this.chain.validateAddress(net.key, address, net.addressRegex ?? undefined);
  }

  async upsert(actorId: string, id: string | undefined, dto: Record<string, unknown>) {
    const data = {
      key: dto.key as string,
      asset: 'USDT' as const,
      networkName: dto.networkName as string,
      enabled: dto.enabled === undefined ? false : Boolean(dto.enabled),
      depositEnabled: Boolean(dto.depositEnabled),
      withdrawEnabled: Boolean(dto.withdrawEnabled),
      confirmationsRequired: (dto.confirmationsRequired as number) ?? 12,
      minimumAmount: (dto.minimumAmount as string) ?? '0',
      withdrawalFee: (dto.withdrawalFee as string) ?? '0',
      contractAddress: (dto.contractAddress as string) ?? null,
      explorerUrl: (dto.explorerUrl as string) ?? null,
      addressRegex: (dto.addressRegex as string) ?? null,
      status: (dto.status as string) ?? 'DISABLED',
    };
    const net = id
      ? await this.prisma.cryptoNetwork.update({ where: { id }, data: data as never })
      : await this.prisma.cryptoNetwork.create({ data: data as never });
    await this.audit.recordStandalone({
      action: id ? 'crypto.network_updated' : 'crypto.network_created',
      entityType: 'CryptoNetwork',
      entityId: net.id,
      actorType: 'ADMIN',
      actorId,
      after: data,
    });
    return net;
  }
}
