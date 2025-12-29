"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagService = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
let DagService = class DagService {
    nodes = new Map();
    edges = new Map();
    nodeEdges = new Map();
    createNode(type, data) {
        const node = {
            id: (0, uuid_1.v4)(),
            type,
            data,
            children: [],
            parents: [],
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.nodes.set(node.id, node);
        this.nodeEdges.set(node.id, []);
        return node;
    }
    createEdge(from, to, weight = 1, type = 'dependency') {
        if (!this.nodes.has(from) || !this.nodes.has(to)) {
            throw new Error('Invalid node IDs');
        }
        const edge = {
            id: (0, uuid_1.v4)(),
            from,
            to,
            weight,
            type
        };
        this.edges.set(edge.id, edge);
        this.nodeEdges.get(from)?.push(edge.id);
        this.nodeEdges.get(to)?.push(edge.id);
        const fromNode = this.nodes.get(from);
        const toNode = this.nodes.get(to);
        if (fromNode && toNode) {
            if (!fromNode.children.includes(to)) {
                fromNode.children.push(to);
                fromNode.updatedAt = new Date();
            }
            if (!toNode.parents.includes(from)) {
                toNode.parents.push(from);
                toNode.updatedAt = new Date();
            }
        }
        return edge;
    }
    getNode(id) {
        return this.nodes.get(id);
    }
    getAllNodes() {
        return Array.from(this.nodes.values());
    }
    getAllEdges() {
        return Array.from(this.edges.values());
    }
    getNodeEdges(nodeId) {
        const edgeIds = this.nodeEdges.get(nodeId) || [];
        return edgeIds.map(edgeId => this.edges.get(edgeId)).filter(Boolean);
    }
    updateNodeStatus(id, status) {
        const node = this.nodes.get(id);
        if (node) {
            node.status = status;
            node.updatedAt = new Date();
            return node;
        }
        return undefined;
    }
    async executeDagSearch(query) {
        const queryNode = this.createNode('query', { query });
        const searchNode = this.createNode('search', { query });
        this.createEdge(queryNode.id, searchNode.id);
        const aiNode = this.createNode('ai', { query });
        this.createEdge(searchNode.id, aiNode.id);
        const filterNode = this.createNode('filter', { query });
        this.createEdge(aiNode.id, filterNode.id);
        const clusterNode = this.createNode('cluster', { query });
        this.createEdge(filterNode.id, clusterNode.id);
        const resultNode = this.createNode('result', { query });
        this.createEdge(clusterNode.id, resultNode.id);
        await this.executeNode(queryNode.id);
        return resultNode;
    }
    async executeNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return;
        if (node.status === 'completed' || node.status === 'running') {
            return;
        }
        node.status = 'running';
        node.updatedAt = new Date();
        try {
            switch (node.type) {
                case 'query':
                    for (const childId of node.children) {
                        await this.executeNode(childId);
                    }
                    break;
                case 'search':
                    await this.executeSearch(node);
                    break;
                case 'ai':
                    await this.executeAIProcessing(node);
                    break;
                case 'filter':
                    await this.executeFiltering(node);
                    break;
                case 'cluster':
                    await this.executeClustering(node);
                    break;
                case 'result':
                    await this.executeResultGeneration(node);
                    break;
            }
            node.status = 'completed';
            for (const childId of node.children) {
                await this.executeNode(childId);
            }
        }
        catch (error) {
            node.status = 'failed';
            console.error(`Node ${node.id} failed:`, error);
        }
        node.updatedAt = new Date();
    }
    async executeSearch(node) {
        node.data.results = [];
        node.data.searchQuery = node.data.query;
    }
    async executeAIProcessing(node) {
        node.data.aiResults = {
            embeddings: [],
            entities: [],
            relations: []
        };
    }
    async executeFiltering(node) {
        node.data.filteredResults = [];
    }
    async executeClustering(node) {
        node.data.clusters = [];
    }
    async executeResultGeneration(node) {
        const parentResults = [];
        for (const parentId of node.parents) {
            const parentNode = this.nodes.get(parentId);
            if (parentNode && parentNode.data.finalResults) {
                parentResults.push(parentNode.data.finalResults);
            }
        }
        node.data.finalResults = {
            query: node.data.query,
            timestamp: new Date(),
            totalResults: parentResults.length > 0 ? parentResults[0].totalResults : 0,
            clusters: parentResults.length > 0 ? parentResults[0].clusters : [],
            status: 'success',
            parentResults
        };
    }
    createSimilarityEdges(nodes) {
        const edges = [];
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const node1 = nodes[i];
                const node2 = nodes[j];
                const similarity = Math.random() * 0.5 + 0.5;
                if (similarity > 0.7) {
                    const edge = this.createEdge(node1.id, node2.id, similarity, 'similarity');
                    edges.push(edge);
                }
            }
        }
        return edges;
    }
    clearDag() {
        this.nodes.clear();
        this.edges.clear();
        this.nodeEdges.clear();
    }
};
exports.DagService = DagService;
exports.DagService = DagService = __decorate([
    (0, common_1.Injectable)()
], DagService);
//# sourceMappingURL=dag.service.js.map