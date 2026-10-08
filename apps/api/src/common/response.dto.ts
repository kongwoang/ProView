import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Public projections only; these schemas never describe database entities. */
export class SessionUserDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'email' }) email!: string;
  @ApiProperty({ type: String }) username!: string;
  @ApiProperty({ type: String }) displayName!: string;
  @ApiProperty({ type: String, enum: ['STUDENT', 'INSTRUCTOR', 'ADMIN'] })
  role!: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
}

export class AuthSessionDto {
  @ApiProperty({ type: String }) accessToken!: string;
  @ApiProperty({ type: SessionUserDto }) user!: SessionUserDto;
}

export class SuccessDto {
  @ApiProperty({ type: Boolean }) success!: boolean;
}

export class PasswordChangedDto extends SuccessDto {
  @ApiProperty({ type: Boolean }) requiresLogin!: boolean;
}

export class ApiErrorDto {
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) message!: string;
  @ApiPropertyOptional({
    oneOf: [
      { type: 'array', items: { type: 'string' } },
      { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
    ],
  })
  fieldErrors?: string[] | Record<string, string[]>;
  @ApiProperty({ type: String }) requestId!: string;
}

export class LiveDto {
  @ApiProperty({ type: String, enum: ['ok'] }) status!: 'ok';
}

export class ReadyDto extends LiveDto {
  @ApiProperty({ type: String, enum: ['ready'] }) database!: 'ready';
}

export class NotificationDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) body!: string;
  @ApiProperty({ type: String, nullable: true }) targetUrl!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) readAt!: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
}

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationDto] }) items!: NotificationDto[];
  @ApiProperty({ type: Number, minimum: 0 }) total!: number;
  @ApiProperty({ type: Number, minimum: 1 }) page!: number;
  @ApiProperty({ type: Number, minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ type: Number, minimum: 0 }) unread!: number;
}
