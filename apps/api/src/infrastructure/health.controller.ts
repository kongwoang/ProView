import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { LiveDto, ReadyDto } from '../common/response.dto';
import { Public } from '../common/public.decorator';
import { PrismaService } from './prisma.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('live')
  @ApiOkResponse({ type: LiveDto })
  live(): LiveDto {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOkResponse({ type: ReadyDto })
  async ready(): Promise<ReadyDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ready' };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Database unavailable',
      });
    }
  }
}
