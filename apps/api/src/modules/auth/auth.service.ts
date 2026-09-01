import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ConflictError } from '../../common/errors/domain-errors';
import { AccessTokenPayload } from '../../common/rbac/rbac.constants';
import { toUserDto } from '../users/user.mapper';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(user: { id: string; phone: string; role: AccessTokenPayload['role'] }) {
    const payload: AccessTokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      type: 'access',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessTtl,
    });

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.config.jwt.refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: this.config.jwt.accessTtl };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.phone }, ...(dto.email ? [{ email: dto.email }] : [])] },
    });
    if (existing) {
      throw new ConflictError('USER_EXISTS', 'An account with that phone or email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await argon2.hash(dto.password),
      },
    });
    await this.audit.recordStandalone({
      action: 'user.registered',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      after: { phone: user.phone },
    });

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: toUserDto(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: toUserDto(user) };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Rotate: revoke the presented token, mint a fresh pair.
    const tokens = await this.issueTokens(record.user);
    const newHash = this.hashToken(tokens.refreshToken);
    const replacement = await this.prisma.refreshToken.findUnique({ where: { tokenHash: newHash } });
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date(), replacedById: replacement?.id },
    });

    return { ...tokens, user: toUserDto(record.user) };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
