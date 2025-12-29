import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import axios from 'axios';

// 模拟axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchRealSearchResults', () => {
    it('should fetch real search results from Bing', async () => {
      // 模拟Bing HTML响应
      const mockBingHtml = `
        <html>
          <body>
            <div class="b_algo">
              <h2><a href="https://example.com/result1">Test Result 1</a></h2>
              <div class="b_caption"><p>This is test result 1 content</p></div>
            </div>
            <div class="b_algo">
              <h2><a href="https://example.com/result2">Test Result 2</a></h2>
              <div class="b_caption"><p>This is test result 2 content</p></div>
            </div>
          </body>
        </html>
      `;
      
      const mockResponse = {
        data: mockBingHtml
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const results = await service['fetchRealSearchResults']('test', 2);
      
      expect(mockedAxios.get).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Test Result 1');
      expect(results[0].url).toBe('https://example.com/result1');
      expect(results[0].content).toBe('This is test result 1 content');
    });
    
    it('should fallback to mock results if API call fails', async () => {
      // 模拟API调用失败
      mockedAxios.get.mockRejectedValue(new Error('API Error'));
      
      const results = await service['fetchRealSearchResults']('test', 2);
      
      expect(mockedAxios.get).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0].title).toContain('test');
    });
  });

  describe('generateStarMap', () => {
    it('should call AI service to generate star map', async () => {
      // 模拟AI服务响应
      const mockResponse = {
        data: {
          embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
          coordinates: [[1, 2, 3], [4, 5, 6]],
          clustering: {
            labels: [0, 1],
            n_clusters: 2,
            clusters: {
              '0': {
                center: [1, 2, 3],
                points: [0]
              },
              '1': {
                center: [4, 5, 6],
                points: [1]
              }
            },
            noise_points: [],
            algorithm: 'hdbscan',
            parameters: {}
          },
          metadata: {
            embedding_model: 'test-model',
            timestamp: new Date().toISOString()
          }
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      const result = await service['generateStarMap'](['test text 1', 'test text 2']);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/starmap/generate'),
        expect.any(Object)
      );
      expect(result).toHaveProperty('coordinates');
      expect(result).toHaveProperty('embeddings');
      expect(result).toHaveProperty('clustering');
    });
    
    it('should throw error if AI service call fails', async () => {
      // 模拟AI服务调用失败
      mockedAxios.post.mockRejectedValue(new Error('AI Service Error'));
      
      await expect(service['generateStarMap'](['test text'])).rejects.toThrow('Failed to generate star map');
    });
  });

  describe('mapToStarPoints', () => {
    it('should convert search results to star points', () => {
      const searchResults = [
        {
          title: 'Test Result',
          url: 'https://example.com/result',
          source: 'example.com',
          content: 'Test content',
          author: ['Test Author'],
          publishDate: new Date(),
          tags: ['test', 'example']
        }
      ];
      
      const coordinates = [[1, 2, 3]];
      const embeddings = [[0.1, 0.2, 0.3]];
      const clusterLabels = [0];
      
      const starPoints = service['mapToStarPoints'](searchResults, coordinates, embeddings, clusterLabels);
      
      expect(starPoints).toHaveLength(1);
      expect(starPoints[0].title).toBe('Test Result');
      expect(starPoints[0].position).toEqual({ x: 1, y: 2, z: 3 });
      expect(starPoints[0].clusterId).toBe('cluster-0');
    });
  });

  describe('mapToStarClusters', () => {
    it('should convert clustering results to star clusters', () => {
      const clusteringResult = {
        clusters: {
          '0': {
            center: [1, 2, 3],
            points: [0]
          },
          '1': {
            center: [4, 5, 6],
            points: [1]
          }
        },
        labels: [0, 1]
      };
      
      const starClusters = service['mapToStarClusters'](clusteringResult as any);
      
      expect(starClusters).toHaveLength(2);
      expect(starClusters[0].id).toBe('cluster-0');
      expect(starClusters[0].position).toEqual({ x: 1, y: 2, z: 3 });
      expect(starClusters[0].starCount).toBe(1);
    });
  });

  describe('generateMockSearchResults', () => {
    it('should generate mock search results', () => {
      const results = service['generateMockSearchResults']('test', 3);
      
      expect(results).toHaveLength(3);
      expect(results[0].title).toContain('test');
      expect(results[0].url).toContain('test');
      expect(results[0].author).toBeDefined();
      expect(results[0].tags).toContain('test');
    });
    
    it('should generate correct number of mock results', () => {
      const results = service['generateMockSearchResults']('test', 7);
      
      expect(results).toHaveLength(7);
    });
  });

  describe('getRandomColor', () => {
    it('should return a valid color from the predefined list', () => {
      const color = service['getRandomColor']();
      const validColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
      ];
      
      expect(validColors).toContain(color);
    });
  });

  describe('search', () => {
    it('should perform a complete search and return formatted results', async () => {
      // Mock Bing HTML response
      const mockBingHtml = `
        <html>
          <body>
            <div class="b_algo">
              <h2><a href="https://example.com/result1">Test Result 1</a></h2>
              <div class="b_caption"><p>This is test result 1 content</p></div>
            </div>
            <div class="b_algo">
              <h2><a href="https://example.com/result2">Test Result 2</a></h2>
              <div class="b_caption"><p>This is test result 2 content</p></div>
            </div>
          </body>
        </html>
      `;
      
      // Mock search response
      const mockSearchResponse = {
        data: mockBingHtml
      };
      
      // Mock AI service response
      const mockAiResponse = {
        data: {
          coordinates: [[1, 2, 3], [4, 5, 6]],
          embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
          clustering: {
            labels: [0, 1],
            clusters: {
              '0': {
                center: [1, 2, 3],
                points: [0]
              },
              '1': {
                center: [4, 5, 6],
                points: [1]
              }
            }
          }
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockSearchResponse);
      mockedAxios.post.mockResolvedValue(mockAiResponse);
      
      const request = {
        query: 'test',
        limit: 2
      };
      
      const result = await service.search(request);
      
      expect(result).toHaveProperty('searchId');
      expect(result).toHaveProperty('starMapId');
      expect(result.query).toBe('test');
      expect(result.stars).toHaveLength(2);
      expect(result.clusters).toHaveLength(2);
      expect(result.stars[0].title).toContain('Test Result');
      expect(result.stars[0].position).toBeDefined();
    });
    
    it('should handle errors gracefully', async () => {
      // Mock Bing API to throw an error
      mockedAxios.get.mockRejectedValue(new Error('API Error'));
      
      // Mock AI service response
      const mockAiResponse = {
        data: {
          coordinates: [[1, 2, 3], [4, 5, 6]],
          embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
          clustering: {
            labels: [0, 1],
            clusters: {
              '0': {
                center: [1, 2, 3],
                points: [0]
              },
              '1': {
                center: [4, 5, 6],
                points: [1]
              }
            }
          }
        }
      };
      
      mockedAxios.post.mockResolvedValue(mockAiResponse);
      
      const request = {
        query: 'test',
        limit: 2
      };
      
      const result = await service.search(request);
      
      expect(result).toHaveProperty('searchId');
      expect(result.stars).toHaveLength(2);
      expect(result.clusters).toHaveLength(2);
    });
  });
});
