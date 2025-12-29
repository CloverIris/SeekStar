import { Module } from '@nestjs/common';
import { DagController } from './dag.controller';
import { DagService } from './dag.service';

@Module({
  controllers: [DagController],
  providers: [DagService],
  exports: [DagService]
})
export class DagModule {}
