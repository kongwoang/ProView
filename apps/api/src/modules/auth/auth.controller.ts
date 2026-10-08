import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Req,
  Res,
  ForbiddenException,
  HttpCode,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import type { Request, Response, CookieOptions } from 'express';
import { Public } from '../../common/public.decorator';
import { Actor, CurrentActor, publicUser } from '../../common/actor';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto, UpdateProfileDto } from './auth.dto';
import {
  AuthSessionDto,
  SessionUserDto,
  SuccessDto,
  PasswordChangedDto,
} from '../../common/response.dto';

const COOKIE = 'proview_refresh';
const attempts = new Map<string, { count: number; resetAt: number }>();

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true' || process.env.APP_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7) * 86_400_000,
    };
  }
  private checkOrigin(request: Request) {
    const origin = request.headers.origin;
    if (origin !== (process.env.FRONTEND_URL ?? 'http://localhost:3000'))
      throw new ForbiddenException('Invalid request origin');
  }
  private limit(request: Request) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
    const key = request.ip ?? 'unknown';
    const value = attempts.get(key) ?? { count: 0, resetAt: now + 60_000 };
    value.count++;
    attempts.set(key, value);
    if (value.count > 30)
      throw new HttpException('Too many authentication attempts; try again later', 429);
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthSessionDto })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    this.checkOrigin(req);
    this.limit(req);
    const result = await this.auth.login(body.identifier, body.password, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    res.cookie(COOKIE, result.refreshToken, this.cookieOptions());
    return { accessToken: result.accessToken, user: result.user };
  }
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthSessionDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    this.checkOrigin(req);
    this.limit(req);
    const result = await this.auth.refresh(req.cookies?.[COOKIE] as string | undefined, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    res.cookie(COOKIE, result.refreshToken, this.cookieOptions());
    return { accessToken: result.accessToken, user: result.user };
  }
  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOkResponse({ type: SuccessDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SuccessDto> {
    this.checkOrigin(req);
    const result = await this.auth.logout(req.cookies?.[COOKIE] as string | undefined);
    res.clearCookie(COOKIE, { ...this.cookieOptions(), maxAge: undefined });
    return result;
  }
}

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('me')
export class ProfileController {
  constructor(private readonly auth: AuthService) {}
  @Get()
  @ApiOkResponse({ type: SessionUserDto })
  me(@CurrentActor() actor: Actor): SessionUserDto {
    return publicUser(actor);
  }
  @Patch()
  @ApiOkResponse({ type: SessionUserDto })
  update(@CurrentActor() actor: Actor, @Body() input: UpdateProfileDto): Promise<SessionUserDto> {
    return this.auth.updateProfile(actor, input);
  }
  @Post('password')
  @HttpCode(200)
  @ApiOkResponse({ type: PasswordChangedDto })
  password(
    @CurrentActor() actor: Actor,
    @Body() input: ChangePasswordDto,
  ): Promise<PasswordChangedDto> {
    return this.auth.changePassword(actor, input.currentPassword, input.newPassword);
  }
}
