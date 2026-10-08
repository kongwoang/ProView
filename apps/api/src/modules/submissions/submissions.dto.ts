import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class CreateSubmissionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  stageId!: string;
}
export class UploadVersionDto {
  @ApiPropertyOptional({ type: String, maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  changeNote?: string;
}
export class SubmissionRevisionDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  revision!: number;
}
export class SubmitDto extends SubmissionRevisionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  versionId!: string;
}
export class ReopenSubmissionDto extends SubmissionRevisionDto {
  @ApiProperty({ type: String, minLength: 5, maxLength: 2000 })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  until!: string;
}
