import { DagService, DAGNode } from './dag.service';
export declare class DagController {
    private readonly dagService;
    constructor(dagService: DagService);
    executeDagSearch(body: {
        query: string;
    }): Promise<DAGNode>;
    getAllNodes(): DAGNode[];
    getAllEdges(): import("./dag.service").DAGEdge[];
    clearDag(): {
        message: string;
    };
}
