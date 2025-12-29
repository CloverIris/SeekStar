import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

describe('SearchController', () => {
  let controller: SearchController;
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [SearchService],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call search service when search is called', async () => {
    // 模拟service.search方法
    jest.spyOn(service, 'search').mockResolvedValue({
      searchId: 'test-search-id',
      query: 'test',
      starMapId: 'test-star-map-id',
      estimatedCount: 0,
      stars: [],
      clusters: []
    });
    
    const request = {
      query: 'test',
      limit: 10
    };
    
    const result = await controller.search(request);
    
    expect(service.search).toHaveBeenCalledWith(request);
    expect(result).toHaveProperty('searchId');
    expect(result.query).toBe('test');
  });
});
