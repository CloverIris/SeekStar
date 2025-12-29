"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagController = void 0;
const common_1 = require("@nestjs/common");
const dag_service_1 = require("./dag.service");
let DagController = class DagController {
    dagService;
    constructor(dagService) {
        this.dagService = dagService;
    }
    async executeDagSearch(body) {
        return this.dagService.executeDagSearch(body.query);
    }
    getAllNodes() {
        return this.dagService.getAllNodes();
    }
    getAllEdges() {
        return this.dagService.getAllEdges();
    }
    clearDag() {
        this.dagService.clearDag();
        return { message: 'DAG cleared successfully' };
    }
};
exports.DagController = DagController;
__decorate([
    (0, common_1.Post)('search'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DagController.prototype, "executeDagSearch", null);
__decorate([
    (0, common_1.Get)('nodes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DagController.prototype, "getAllNodes", null);
__decorate([
    (0, common_1.Get)('edges'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DagController.prototype, "getAllEdges", null);
__decorate([
    (0, common_1.Post)('clear'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DagController.prototype, "clearDag", null);
exports.DagController = DagController = __decorate([
    (0, common_1.Controller)('api/v1/dag'),
    __metadata("design:paramtypes", [dag_service_1.DagService])
], DagController);
//# sourceMappingURL=dag.controller.js.map