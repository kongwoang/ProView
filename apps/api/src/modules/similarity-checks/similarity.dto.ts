import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SimilarityStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageDto } from '../../common/page.dto';
export class SimilarityQueryDto extends PageDto {
  @ApiPropertyOptional({ enum: SimilarityStatus })
  @IsOptional()
  @IsEnum(SimilarityStatus)
  status?: SimilarityStatus;
}
export class SimilarityUpdateDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentage?: number;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  resultDate?: string;
  @ApiPropertyOptional({ type: String, maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string;
  @ApiPropertyOptional({ type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
