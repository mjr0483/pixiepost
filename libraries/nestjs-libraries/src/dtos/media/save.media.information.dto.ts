import { IsNumber, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class SaveMediaInformationDto {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  alt?: string;

  @IsUrl()
  @IsOptional()
  @ValidateIf((o) => !!o.thumbnail)
  thumbnail?: string;

  @IsNumber()
  @IsOptional()
  @ValidateIf((o) => !!o.thumbnailTimestamp)
  thumbnailTimestamp?: number;
}
