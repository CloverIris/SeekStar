import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { DagModule } from '../dag/dag.module';

@Module({
  imports: [DagModule],
  providers: [SearchService],
  controllers: [SearchController]
})
export class SearchModule {}
