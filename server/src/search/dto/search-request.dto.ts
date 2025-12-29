import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class SearchRequestDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
  
  @IsOptional()
  @IsNumber()
  offset?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentTypes?: string[];
}
