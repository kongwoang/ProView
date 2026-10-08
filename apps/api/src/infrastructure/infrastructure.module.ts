import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], controllers: [HealthController], exports: [PrismaService] })
export class InfrastructureModule {}
