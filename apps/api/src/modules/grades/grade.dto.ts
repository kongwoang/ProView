import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class CriterionScoreDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  criterionId!: string;
  @ApiProperty({ type: Number })
  @IsNumber({ maxDecimalPlaces: 4 })
  score!: number;
  @ApiPropertyOptional({ type: String, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}
export class SaveGradeDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
  @ApiProperty({ isArray: true, type: () => CriterionScoreDto, maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreDto)
  criterionScores!: CriterionScoreDto[];
  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  overall?: number;
  @ApiPropertyOptional({ type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  overrideReason?: string;
  @ApiPropertyOptional({ type: String, maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  feedback?: string;
  @ApiPropertyOptional({ type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correctionReason?: string;
}
export class PublishGradeDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
}
