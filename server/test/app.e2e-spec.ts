import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import axios from 'axios';

// 模拟axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});

describe('SearchController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/search (POST) should return search results', async () => {
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
    
    // 模拟搜索响应
    const mockSearchResponse = {
      data: mockBingHtml
    };
    
    // 模拟AI服务响应
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
    
    // 设置模拟响应
    mockedAxios.get.mockResolvedValue(mockSearchResponse);
    mockedAxios.post.mockResolvedValue(mockAiResponse);
    
    return request(app.getHttpServer())
      .post('/api/v1/search')
      .send({
        query: 'test',
        limit: 2
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('searchId');
        expect(res.body).toHaveProperty('starMapId');
        expect(res.body.query).toBe('test');
        expect(res.body.stars).toHaveLength(2);
        expect(res.body.clusters).toHaveLength(2);
        expect(res.body.stars[0].title).toContain('Test Result');
        expect(res.body.stars[0].position).toBeDefined();
      });
  });

  it('/api/search (POST) should handle empty search results', async () => {
    // 模拟Bing API返回空结果（没有.b_algo元素）
    const mockBingHtml = `
      <html>
        <body>
          <!-- 没有搜索结果 -->
        </body>
      </html>
    `;
    
    // 模拟搜索响应
    const mockSearchResponse = {
      data: mockBingHtml
    };
    
    // 模拟AI服务响应
    const mockAiResponse = {
      data: {
        coordinates: [[0, 0, 0]],
        embeddings: [[0, 0, 0]],
        clustering: {
          labels: [0],
          clusters: {
            '0': {
              center: [0, 0, 0],
              points: [0]
            }
          }
        }
      }
    };
    
    // 设置模拟响应
    mockedAxios.get.mockResolvedValue(mockSearchResponse);
    mockedAxios.post.mockResolvedValue(mockAiResponse);
    
    return request(app.getHttpServer())
      .post('/api/v1/search')
      .send({
        query: 'nonexistentquery',
        limit: 1
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.stars).toHaveLength(1);
        expect(res.body.clusters).toHaveLength(1);
      });
  });

  it('/api/search (POST) should handle external API errors', async () => {
    // 模拟DuckDuckGo API调用失败
    mockedAxios.get.mockRejectedValue(new Error('API Error'));
    
    // 模拟AI服务响应
    const mockAiResponse = {
      data: {
        coordinates: [[0, 0, 0], [1, 1, 1]],
        embeddings: [[0, 0, 0], [1, 1, 1]],
        clustering: {
          labels: [0, 1],
          clusters: {
            '0': {
              center: [0, 0, 0],
              points: [0]
            },
            '1': {
              center: [1, 1, 1],
              points: [1]
            }
          }
        }
      }
    };
    
    mockedAxios.post.mockResolvedValue(mockAiResponse);
    
    return request(app.getHttpServer())
      .post('/api/v1/search')
      .send({
        query: 'test',
        limit: 2
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.stars).toHaveLength(2);
        expect(res.body.clusters).toHaveLength(2);
      });
  });
});
