import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextStore } from '../context/request-context';
import { AccessTokenPayload, AuthUser } from './rbac.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.status === 'SUSPENDED' || user.status === 'CLOSED') {
      throw new UnauthorizedException('Account not active');
    }

    if (payload.sid) {
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
      if (!session || session.revokedAt) throw new UnauthorizedException('Session revoked');
      await this.prisma.session.update({
        where: { id: payload.sid },
        data: { lastSeenAt: new Date() },
      });
    }

    RequestContextStore.set({ userId: user.id, actorRole: user.role });

    return {
      id: user.id,
      publicUserId: user.publicUserId,
      phone: user.phone,
      role: user.role,
      status: user.status,
      kycLevel: user.kycLevel,
      kycStatus: user.kycStatus,
      sessionId: payload.sid,
    };
  }
}
