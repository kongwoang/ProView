import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
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
import { AnonymityMode, MembershipRole, OfferingStatus } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

export class CourseDto {
  @ApiProperty({ type: String, minLength: 2, maxLength: 32 })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  code!: string;
  @ApiProperty({ type: String, minLength: 2, maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;
  @ApiPropertyOptional({ type: String, maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
}
export class CoursePatchDto extends PartialType(CourseDto) {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class OfferingDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  courseId!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  semester!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 32 })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  academicYear!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  termStartAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  termEndAt!: string;
  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
  @ApiPropertyOptional({ enum: AnonymityMode })
  @IsOptional()
  @IsEnum(AnonymityMode)
  anonymityMode?: AnonymityMode;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  copyFromOfferingId?: string;
  @ApiPropertyOptional({ isArray: true, type: String, maxItems: 20, format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  instructorIds?: string[];
}
export class OfferingPatchDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
  @ApiPropertyOptional({ enum: OfferingStatus })
  @IsOptional()
  @IsEnum(OfferingStatus)
  status?: OfferingStatus;
  @ApiPropertyOptional({ enum: AnonymityMode })
  @IsOptional()
  @IsEnum(AnonymityMode)
  anonymityMode?: AnonymityMode;
  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}
export class MembershipDto {
  @ApiProperty({ type: String, format: 'email' })
  @IsEmail()
  email!: string;
  @ApiPropertyOptional({ enum: MembershipRole })
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;
}
export class CsvDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 200000 })
  @IsString()
  @MinLength(1)
  @MaxLength(200000)
  csv!: string;
}
export class ImportDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  previewId!: string;
}
export class GroupDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 240 })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  title!: string;
  @ApiPropertyOptional({ type: String, maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
  @ApiProperty({ isArray: true, type: String, minItems: 1, maxItems: 100, format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
export class GroupPatchDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 240 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  title?: string;
  @ApiPropertyOptional({ type: String, maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
  @ApiPropertyOptional({ isArray: true, type: String, minItems: 1, maxItems: 100, format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds?: string[];
}
export class CriterionDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;
  @ApiPropertyOptional({ type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
  @ApiProperty({ type: Number, minimum: 0, maximum: 9999 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(9999)
  weight!: number;
  @ApiProperty({ type: Number, minimum: -9999, maximum: 9999 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-9999)
  @Max(9999)
  scoreMin!: number;
  @ApiProperty({ type: Number, minimum: -9999, maximum: 9999 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-9999)
  @Max(9999)
  scoreMax!: number;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  requireComment?: boolean;
}
export class RubricDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;
  @ApiPropertyOptional({ type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
  @ApiProperty({ isArray: true, type: () => CriterionDto, minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria!: CriterionDto[];
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  requireRecommendation?: boolean;
  @ApiPropertyOptional({ isArray: true, type: String, maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  recommendationOptions?: string[];
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  requireOverallComment?: boolean;
}
export class StageDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  sequence!: number;
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  rubricRevisionId!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  openAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  submissionDeadline!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  reviewDeadline?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  rebuttalDeadline?: string;
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  allowReviews!: boolean;
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  allowRebuttal!: boolean;
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  requireSimilarityCheck!: boolean;
  @ApiProperty({ type: Number, minimum: 0, maximum: 20 })
  @IsInt()
  @Min(0)
  @Max(20)
  peerReviewCount!: number;
}
export class StagePatchDto extends StageDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
}
