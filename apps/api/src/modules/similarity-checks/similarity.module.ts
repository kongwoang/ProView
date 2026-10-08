import { Module } from '@nestjs/common';
import { SimilarityController } from './similarity.controller';
import { SimilarityService } from './similarity.service';
@Module({
  providers: [SimilarityService],
  controllers: [SimilarityController],
  exports: [SimilarityService],
})
export class SimilarityChecksModule {}
