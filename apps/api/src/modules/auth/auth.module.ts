import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController, ProfileController } from './auth.controller';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_SECRET,
        signOptions: {
          expiresIn: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
          issuer: 'proview',
          audience: 'proview-web',
        },
        verifyOptions: { issuer: 'proview', audience: 'proview-web' },
      }),
    }),
  ],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  controllers: [AuthController, ProfileController],
  exports: [AuthService],
})
export class AuthModule {}
