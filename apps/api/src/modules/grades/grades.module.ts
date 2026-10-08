import { Module } from '@nestjs/common';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';
@Module({ providers: [GradesService], controllers: [GradesController], exports: [GradesService] })
export class GradesModule {}
