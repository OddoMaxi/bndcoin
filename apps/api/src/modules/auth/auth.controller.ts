import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../common/rbac/decorators';
import { AuthUser } from '../../common/rbac/rbac.constants';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toUserDto } from '../users/user.mapper';
import { AuthService } from './auth.service';
import { LoginPasswordDto, RefreshDto, RegisterDto, RequestOtpDto, VerifyOtpDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public() @Throttle({ default: { limit: 8, ttl: 60_000 } }) @HttpCode(200)
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone, dto.purpose ?? 'LOGIN');
  }

  @Public() @Throttle({ default: { limit: 12, ttl: 60_000 } }) @HttpCode(200)
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code, dto.deviceLabel);
  }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('login')
  loginPassword(@Body() dto: LoginPasswordDto) {
    return this.auth.loginPassword(dto);
  }

  @Public() @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public() @HttpCode(200)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @HttpCode(200)
  @Post('logout-all')
  logoutAll(@CurrentUser('id') userId: string) {
    return this.auth.logoutAll(userId);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return toUserDto(full);
  }

  @Get('sessions')
  sessions(@CurrentUser('id') userId: string) {
    return this.auth.listSessions(userId);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.auth.revokeSession(userId, id);
  }
}
