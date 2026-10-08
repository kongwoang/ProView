import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PageDto } from '../../common/page.dto';
export class ArchiveQueryDto extends PageDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  courseId?: string;
  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  semester?: string;
  @ApiPropertyOptional({ type: String, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  student?: string;
}
export class ApproveArchiveDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  submissionVersionId!: string;
  @IsOptional() @IsBoolean() allowDownload = false;
}
export class RevokeArchiveDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
