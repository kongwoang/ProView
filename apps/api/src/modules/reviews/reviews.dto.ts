import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
export class AssignmentPlanDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  stageId!: string;
}
export class ManualAssignmentDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  submissionId!: string;
  @ApiProperty({ enum: ['GROUP', 'INSTRUCTOR'] })
  @IsIn(['GROUP', 'INSTRUCTOR'])
  reviewerType!: 'GROUP' | 'INSTRUCTOR';
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reviewerGroupId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reviewerUserId?: string;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
export class ReasonDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  reason!: string;
}
export class ConflictDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
  @ApiProperty({ type: String, minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  note!: string;
}
export class ScoreResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  criterionId!: string;
  @ApiProperty({ type: Number, minimum: -10000, maximum: 10000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-10000)
  @Max(10000)
  score!: number;
  @ApiProperty({ type: String, maxLength: 10000 })
  @IsString()
  @MaxLength(10000)
  comment!: string;
}
export class ReviewDraftDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
  @ApiProperty({ type: String, maxLength: 15000 })
  @IsString()
  @MaxLength(15000)
  strengths!: string;
  @ApiProperty({ type: String, maxLength: 15000 })
  @IsString()
  @MaxLength(15000)
  weaknesses!: string;
  @ApiProperty({ type: String, maxLength: 15000 })
  @IsString()
  @MaxLength(15000)
  overallComment!: string;
  @ApiPropertyOptional({ type: String, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recommendation?: string;
  @ApiProperty({ isArray: true, type: () => ScoreResponseDto, maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((r: ScoreResponseDto) => r.criterionId)
  @ValidateNested({ each: true })
  @Type(() => ScoreResponseDto)
  responses!: ScoreResponseDto[];
}
export class RevisionDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
}
export class CorrectionDto extends ReasonDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  deadline!: string;
}
export class ReleaseDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  reason?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  rebuttalDeadline?: string;
}
export class RebuttalResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  reviewId!: string;
  @ApiProperty({ type: String, maxLength: 15000 })
  @IsString()
  @MaxLength(15000)
  content!: string;
}
export class RebuttalDraftDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
  @ApiProperty({ type: String, maxLength: 30000 })
  @IsString()
  @MaxLength(30000)
  generalResponse!: string;
  @ApiProperty({ isArray: true, type: () => RebuttalResponseDto, maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((r: RebuttalResponseDto) => r.reviewId)
  @ValidateNested({ each: true })
  @Type(() => RebuttalResponseDto)
  responses!: RebuttalResponseDto[];
}
export class ReopenRebuttalDto extends CorrectionDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  acknowledgePublishedGrade!: boolean;
}
export class DiscussionDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reviewId?: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 10000 })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
}
