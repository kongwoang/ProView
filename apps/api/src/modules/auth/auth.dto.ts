import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 254 })
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 256 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
export class ChangePasswordDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 256 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;
  @ApiProperty({ type: String, minLength: 12, maxLength: 256 })
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  newPassword!: string;
}
export class UpdateProfileDto {
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;
  @ApiPropertyOptional({ type: String, maxLength: 254, format: 'email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
