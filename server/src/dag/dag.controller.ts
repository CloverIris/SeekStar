import { Controller, Post, Body, Get } from '@nestjs/common';
import { DagService, DAGNode } from './dag.service';

@Controller('api/v1/dag')
export class DagController {
  constructor(private readonly dagService: DagService) {}

  /**
   * 执行DAG搜索
   */
  @Post('search')
  async executeDagSearch(@Body() body: { query: string }): Promise<DAGNode> {
    return this.dagService.executeDagSearch(body.query);
  }

  /**
   * 获取所有节点
   */
  @Get('nodes')
  getAllNodes() {
    return this.dagService.getAllNodes();
  }

  /**
   * 获取所有边
   */
  @Get('edges')
  getAllEdges() {
    return this.dagService.getAllEdges();
  }

  /**
   * 清空DAG
   */
  @Post('clear')
  clearDag() {
    this.dagService.clearDag();
    return { message: 'DAG cleared successfully' };
  }
}
