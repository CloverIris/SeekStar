export interface DAGNode {
    id: string;
    type: 'query' | 'search' | 'ai' | 'filter' | 'cluster' | 'result';
    data: any;
    children: string[];
    parents: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}
export interface DAGEdge {
    id: string;
    from: string;
    to: string;
    weight: number;
    type: 'dependency' | 'similarity' | 'hierarchy';
}
export declare class DagService {
    private nodes;
    private edges;
    private nodeEdges;
    createNode(type: DAGNode['type'], data: any): DAGNode;
    createEdge(from: string, to: string, weight?: number, type?: DAGEdge['type']): DAGEdge;
    getNode(id: string): DAGNode | undefined;
    getAllNodes(): DAGNode[];
    getAllEdges(): DAGEdge[];
    getNodeEdges(nodeId: string): DAGEdge[];
    updateNodeStatus(id: string, status: DAGNode['status']): DAGNode | undefined;
    executeDagSearch(query: string): Promise<DAGNode>;
    private executeNode;
    private executeSearch;
    private executeAIProcessing;
    private executeFiltering;
    private executeClustering;
    private executeResultGeneration;
    createSimilarityEdges(nodes: DAGNode[]): DAGEdge[];
    clearDag(): void;
}
