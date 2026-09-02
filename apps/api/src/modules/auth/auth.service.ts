import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextStore } from '../../common/context/request-context';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/domain-errors';
import { AccessTokenPayload } from '../../common/rbac/rbac.constants';
import { NotificationsService } from '../../common/notifications/notifications.service';
import { SMS_PROVIDER, SmsProvider } from '../../common/sms/sms.provider';
import { otpCode, publicUserId } from '../../common/util/public-id';
import { toUserDto } from '../users/user.mapper';
import { LoginPasswordDto, RegisterDto } from './dto';

const OTP_TTL_SECONDS = 300;
const OTP_RESEND_COOLDOWN_MS = 30_000;
const OTP_MAX_ACTIVE_PER_HOUR = 8;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async issueTokens(
    user: { id: string; phone: string; role: AccessTokenPayload['role'] },
    sessionId?: string,
  ) {
    const payload: AccessTokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      sid: sessionId,
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
        sessionId,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + this.config.jwt.refreshTtl * 1000),
      },
    });
    return { accessToken, refreshToken, expiresIn: this.config.jwt.accessTtl };
  }

  private async createSession(userId: string, deviceLabel?: string) {
    const ctx = RequestContextStore.get();
    return this.prisma.session.create({
      data: { userId, deviceLabel, ip: ctx?.ip, userAgent: ctx?.userAgent },
    });
  }

  // -------------------------------------------------------------------------
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.phone }, ...(dto.email ? [{ email: dto.email }] : [])] },
    });
    if (existing) {
      throw new ConflictError('USER_EXISTS', 'An account with that phone or email already exists');
    }
    const user = await this.prisma.user.create({
      data: {
        publicUserId: publicUserId(),
        phone: dto.phone,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        kycStatus: 'UNVERIFIED',
        passwordHash: dto.password ? await argon2.hash(dto.password) : null,
      },
    });
    await this.prisma.kycRecord.create({ data: { userId: user.id } });
    await this.audit.recordStandalone({
      action: 'user.registered',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      after: { phone: user.phone },
    });
    // Immediately start an OTP so the client can verify in one step.
    await this.requestOtp(dto.phone, 'LOGIN');
    return { user: toUserDto(user), otpRequired: true };
  }

  // -------------------------------------------------------------------------
  async requestOtp(phone: string, purpose: 'LOGIN' | 'PHONE_VERIFY' | 'STEP_UP' = 'LOGIN') {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (purpose === 'STEP_UP' && !user) throw new NotFoundError('User');
    if (user?.status === 'SUSPENDED' || user?.status === 'CLOSED') {
      throw new UnauthorizedException('Account not active');
    }

    const since = new Date(Date.now() - 3_600_000);
    const recent = await this.prisma.otpRequest.findMany({
      where: { destination: phone, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent.length >= OTP_MAX_ACTIVE_PER_HOUR) {
      throw new DomainError('OTP_RATE_LIMITED', 'Too many OTP requests. Try again later.', 429);
    }
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw new DomainError('OTP_COOLDOWN', 'Please wait before requesting another code.', 429);
    }

    const code = otpCode();
    const ctx = RequestContextStore.get();
    const record = await this.prisma.otpRequest.create({
      data: {
        userId: user?.id,
        channel: 'SMS',
        purpose: purpose as OtpPurpose,
        destination: phone,
        codeHash: this.hash(code),
        status: 'CREATED',
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
        createdIp: ctx?.ip,
      },
    });

    const message = `Bory & Norbert: votre code de vérification est ${code}. Valable ${OTP_TTL_SECONDS / 60} min.`;
    try {
      await this.sms.send(phone, message);
      await this.prisma.otpRequest.update({
        where: { id: record.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      await this.prisma.otpRequest.update({ where: { id: record.id }, data: { status: 'FAILED' } });
      throw new DomainError('OTP_SEND_FAILED', 'Could not send the verification code', 502);
    }

    // In mock mode, surface the code so developers/tests can proceed.
    const debugCode = this.config.otpMode === 'mock' ? code : undefined;
    return { sent: true, expiresInSeconds: OTP_TTL_SECONDS, debugCode };
  }

  // -------------------------------------------------------------------------
  async verifyOtp(phone: string, code: string, deviceLabel?: string) {
    const record = await this.prisma.otpRequest.findFirst({
      where: { destination: phone, status: { in: ['SENT', 'CREATED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new ValidationError('No active verification code for this number');
    if (record.expiresAt < new Date()) {
      await this.prisma.otpRequest.update({ where: { id: record.id }, data: { status: 'EXPIRED' } });
      throw new DomainError('OTP_EXPIRED', 'The verification code has expired', 410);
    }
    if (record.attempts >= record.maxAttempts) {
      await this.prisma.otpRequest.update({ where: { id: record.id }, data: { status: 'FAILED' } });
      throw new DomainError('OTP_LOCKED', 'Too many wrong attempts. Request a new code.', 429);
    }
    if (record.codeHash !== this.hash(code)) {
      await this.prisma.otpRequest.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.prisma.otpRequest.update({
      where: { id: record.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // Passwordless first-time login: create a minimal profile.
      user = await this.prisma.user.create({
        data: {
          publicUserId: publicUserId(),
          phone,
          firstName: 'Client',
          lastName: phone.slice(-4),
          role: 'CUSTOMER',
          phoneVerified: true,
        },
      });
      await this.prisma.kycRecord.create({ data: { userId: user.id } });
    } else if (!user.phoneVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      });
    }

    const session = await this.createSession(user.id, deviceLabel);
    const tokens = await this.issueTokens(user, session.id);
    await this.audit.recordStandalone({
      action: 'auth.otp_verified',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      after: { sessionId: session.id },
    });
    return { ...tokens, user: toUserDto(user) };
  }

  // -------------------------------------------------------------------------
  async loginPassword(dto: LoginPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    if (user.status === 'SUSPENDED' || user.status === 'CLOSED') {
      throw new UnauthorizedException('Account not active');
    }
    const session = await this.createSession(user.id, 'password-login');
    const tokens = await this.issueTokens(user, session.id);
    return { ...tokens, user: toUserDto(user) };
  }

  // -------------------------------------------------------------------------
  async refresh(refreshToken: string) {
    const tokenHash = this.hash(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    if (record.sessionId) {
      const session = await this.prisma.session.findUnique({ where: { id: record.sessionId } });
      if (!session || session.revokedAt) throw new UnauthorizedException('Session revoked');
    }
    const tokens = await this.issueTokens(record.user, record.sessionId ?? undefined);
    const replacement = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(tokens.refreshToken) },
    });
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date(), replacedById: replacement?.id },
    });
    return { ...tokens, user: toUserDto(record.user) };
  }

  async logout(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
    });
    if (record) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: record.tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (record.sessionId) {
        await this.prisma.session.update({
          where: { id: record.sessionId },
          data: { revokedAt: new Date() },
        });
      }
    }
    return { ok: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundError('Session', sessionId);
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
