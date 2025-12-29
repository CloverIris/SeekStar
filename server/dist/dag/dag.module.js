"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagModule = void 0;
const common_1 = require("@nestjs/common");
const dag_controller_1 = require("./dag.controller");
const dag_service_1 = require("./dag.service");
let DagModule = class DagModule {
};
exports.DagModule = DagModule;
exports.DagModule = DagModule = __decorate([
    (0, common_1.Module)({
        controllers: [dag_controller_1.DagController],
        providers: [dag_service_1.DagService],
        exports: [dag_service_1.DagService]
    })
], DagModule);
//# sourceMappingURL=dag.module.js.map