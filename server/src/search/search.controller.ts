import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchRequestDto } from './dto/search-request.dto';
import { SearchResponseDto } from './dto/search-response.dto';

@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  async search(@Body() request: SearchRequestDto): Promise<SearchResponseDto> {
    return this.searchService.search(request);
  }

  @Get('suggestions')
  async getSuggestions(@Query('q') query: string, @Query('limit') limit?: string) {
    // Mock implementation for search suggestions
    const suggestions = [
      { text: `${query} tutorial`, type: 'keyword', score: 0.95 },
      { text: `${query} examples`, type: 'keyword', score: 0.92 },
      { text: `${query} best practices`, type: 'keyword', score: 0.89 },
      { text: `${query} vs other tools`, type: 'comparison', score: 0.85 },
      { text: `${query} future trends`, type: 'topic', score: 0.82 }
    ];
    return {
      query,
      suggestions: suggestions.slice(0, parseInt(limit || '5'))
    };
  }
}
