# SeekStar 后端 API 设计文档

## 1. API 设计原则

- **RESTful 风格**：采用 RESTful 设计原则，使用合适的 HTTP 方法和状态码
- **版本控制**：通过 URL 路径前缀进行版本控制（如 `/api/v1/`）
- **统一响应格式**：所有 API 返回统一的 JSON 格式响应
- **认证授权**：使用 JWT 令牌进行身份验证和授权
- **错误处理**：提供详细的错误信息和错误码
- **参数验证**：严格的请求参数验证
- **速率限制**：实现 API 速率限制，防止滥用

## 2. 认证与授权

### 2.1 JWT 令牌

- **获取方式**：通过登录 API 获取
- **有效期**：默认 24 小时
- **刷新机制**：支持令牌刷新
- **传递方式**：通过 HTTP `Authorization` 头，格式为 `Bearer <token>`

### 2.2 权限级别

| 权限级别 | 描述 |
|----------|------|
| 公共 API | 无需认证即可访问 |
| 用户 API | 需要普通用户认证 |
| 管理员 API | 需要管理员权限 |

## 3. 统一响应格式

### 3.1 成功响应

```json
{
  "success": true,
  "data": {...},        // 响应数据，根据 API 不同而变化
  "message": "",       // 可选的成功消息
  "timestamp": 1234567890,  // 响应时间戳
  "requestId": "uuid"  // 请求唯一标识符
}
```

### 3.2 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",  // 错误码
    "message": "错误描述",  // 错误消息
    "details": {...}        // 可选的详细错误信息
  },
  "timestamp": 1234567890,
  "requestId": "uuid"
}
```

### 3.3 错误码列表

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| INVALID_REQUEST | 400 | 请求参数无效 |
| UNAUTHORIZED | 401 | 未授权，需要登录 |
| FORBIDDEN | 403 | 禁止访问，权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| INTERNAL_SERVER_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务不可用 |
| RATE_LIMIT_EXCEEDED | 429 | 超出速率限制 |

## 4. API 端点设计

### 4.1 搜索相关 API

#### 4.1.1 执行搜索

- **URL**: `/api/v1/search`
- **方法**: `POST`
- **权限**: 公共 API
- **请求体**:

```json
{
  "query": "人工智能",  // 搜索关键词
  "limit": 100,        // 结果数量限制，默认 100
  "sources": ["google", "bing"],  // 数据源过滤
  "languages": ["zh-CN", "en-US"],  // 语言过滤
  "contentTypes": ["web", "blog", "paper"]  // 内容类型过滤
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "searchId": "uuid",  // 搜索唯一标识符
    "query": "人工智能",
    "starMapId": "uuid",  // 生成的星图 ID
    "estimatedCount": 1000,  // 估计结果总数
    "stars": [/* 星点列表，详见星点数据结构 */],
    "clusters": [/* 星团列表，详见星团数据结构 */]
  },
  "message": "搜索成功"
}
```

#### 4.1.2 获取搜索建议

- **URL**: `/api/v1/search/suggestions`
- **方法**: `GET`
- **权限**: 公共 API
- **查询参数**:
  - `q`: 搜索关键词（必填）
  - `limit`: 建议数量限制，默认 10

- **响应**:

```json
{
  "success": true,
  "data": {
    "query": "人工智能",
    "suggestions": [
      {
        "text": "人工智能发展历史",
        "type": "keyword",
        "score": 0.95
      },
      {
        "text": "人工智能应用领域",
        "type": "keyword",
        "score": 0.92
      }
    ]
  }
}
```

#### 4.1.3 获取搜索历史

- **URL**: `/api/v1/search/history`
- **方法**: `GET`
- **权限**: 用户 API
- **查询参数**:
  - `limit`: 历史记录数量限制，默认 20
  - `offset`: 偏移量，默认 0

- **响应**:

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "query": "人工智能",
        "timestamp": 1234567890,
        "starMapId": "uuid"
      }
    ],
    "total": 10
  }
}
```

### 4.2 星图相关 API

#### 4.2.1 获取星图详情

- **URL**: `/api/v1/starmaps/{starMapId}`
- **方法**: `GET`
- **权限**: 公共 API
- **路径参数**:
  - `starMapId`: 星图 ID（必填）

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "人工智能相关星图",
    "description": "关于人工智能的语义星图",
    "searchQuery": "人工智能",
    "stars": [/* 星点列表 */],
    "clusters": [/* 星团列表 */],
    "cameraPosition": {
      "x": 0,
      "y": 0,
      "z": 100
    },
    "cameraTarget": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

#### 4.2.2 创建星图（保存当前视图）

- **URL**: `/api/v1/starmaps`
- **方法**: `POST`
- **权限**: 用户 API
- **请求体**:

```json
{
  "name": "我的人工智能星图",  // 星图名称
  "description": "自定义的人工智能星图",  // 星图描述
  "searchQuery": "人工智能",  // 关联的搜索词
  "stars": [/* 星点列表 */],
  "clusters": [/* 星团列表 */],
  "cameraPosition": {
    "x": 0,
    "y": 0,
    "z": 100
  },
  "cameraTarget": {
    "x": 0,
    "y": 0,
    "z": 0
  }
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "我的人工智能星图",
    "createdAt": 1234567890
  },
  "message": "星图创建成功"
}
```

#### 4.2.3 更新星图

- **URL**: `/api/v1/starmaps/{starMapId}`
- **方法**: `PUT`
- **权限**: 用户 API（仅星图所有者或管理员）
- **路径参数**:
  - `starMapId`: 星图 ID（必填）

- **请求体**:

```json
{
  "name": "更新后的星图名称",
  "description": "更新后的星图描述"
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "更新后的星图名称",
    "updatedAt": 1234567890
  },
  "message": "星图更新成功"
}
```

#### 4.2.4 删除星图

- **URL**: `/api/v1/starmaps/{starMapId}`
- **方法**: `DELETE`
- **权限**: 用户 API（仅星图所有者或管理员）
- **路径参数**:
  - `starMapId`: 星图 ID（必填）

- **响应**:

```json
{
  "success": true,
  "message": "星图删除成功"
}
```

#### 4.2.5 获取用户星图列表

- **URL**: `/api/v1/users/{userId}/starmaps`
- **方法**: `GET`
- **权限**: 用户 API（仅本人或管理员）
- **路径参数**:
  - `userId`: 用户 ID（必填）

- **查询参数**:
  - `limit`: 星图数量限制，默认 20
  - `offset`: 偏移量，默认 0

- **响应**:

```json
{
  "success": true,
  "data": {
    "starmaps": [
      {
        "id": "uuid",
        "name": "我的星图",
        "description": "描述",
        "searchQuery": "关键词",
        "createdAt": 1234567890,
        "updatedAt": 1234567890
      }
    ],
    "total": 5
  }
}
```

### 4.3 星点与星团相关 API

#### 4.3.1 获取星点详情

- **URL**: `/api/v1/stars/{starId}`
- **方法**: `GET`
- **权限**: 公共 API
- **路径参数**:
  - `starId`: 星点 ID（必填）

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "人工智能简介",
    "url": "https://example.com/ai-intro",
    "source": "google",
    "content": "人工智能是...",
    "author": ["张三"],
    "publishDate": 1234567890,
    "tags": ["人工智能", "机器学习"],
    "position": {
      "x": 10.5,
      "y": 20.3,
      "z": -5.7
    },
    "size": 1.2,
    "brightness": 0.8,
    "color": "#03a9f4",
    "clusterId": "uuid",
    "relatedStars": [
      {
        "id": "uuid",
        "weight": 0.9
      }
    ],
    "relevanceScore": 0.95,
    "qualityScore": 0.9
  }
}
```

#### 4.3.2 获取星团详情

- **URL**: `/api/v1/clusters/{clusterId}`
- **方法**: `GET`
- **权限**: 公共 API
- **路径参数**:
  - `clusterId`: 星团 ID（必填）

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "人工智能基础",
    "description": "关于人工智能基础知识的星团",
    "position": {
      "x": 15.2,
      "y": 18.7,
      "z": -3.2
    },
    "radius": 25.5,
    "color": "#7b1fa2",
    "opacity": 0.6,
    "starCount": 50,
    "starIds": ["uuid1", "uuid2"],
    "tags": ["人工智能", "基础知识"],
    "mainTopic": "人工智能基础",
    "subTopics": ["机器学习", "深度学习"],
    "relatedClusters": [
      {
        "id": "uuid",
        "weight": 0.85
      }
    ],
    "relevanceScore": 0.92,
    "qualityScore": 0.88
  }
}
```

#### 4.3.3 获取相关星点

- **URL**: `/api/v1/stars/{starId}/related`
- **方法**: `GET`
- **权限**: 公共 API
- **路径参数**:
  - `starId`: 星点 ID（必填）

- **查询参数**:
  - `limit`: 相关星点数量限制，默认 20

- **响应**:

```json
{
  "success": true,
  "data": {
    "starId": "uuid",
    "relatedStars": [/* 相关星点列表 */]
  }
}
```

### 4.4 用户相关 API

#### 4.4.1 用户注册

- **URL**: `/api/v1/auth/register`
- **方法**: `POST`
- **权限**: 公共 API
- **请求体**:

```json
{
  "username": "user123",  // 用户名
  "email": "user@example.com",  // 邮箱
  "password": "password123"  // 密码
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "user123",
    "email": "user@example.com",
    "token": "jwt_token",  // JWT 令牌
    "refreshToken": "refresh_token"  // 刷新令牌
  },
  "message": "注册成功"
}
```

#### 4.4.2 用户登录

- **URL**: `/api/v1/auth/login`
- **方法**: `POST`
- **权限**: 公共 API
- **请求体**:

```json
{
  "email": "user@example.com",  // 邮箱或用户名
  "password": "password123"  // 密码
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "user123",
    "email": "user@example.com",
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  },
  "message": "登录成功"
}
```

#### 4.4.3 刷新令牌

- **URL**: `/api/v1/auth/refresh`
- **方法**: `POST`
- **权限**: 公共 API
- **请求体**:

```json
{
  "refreshToken": "refresh_token"  // 刷新令牌
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "refreshToken": "new_refresh_token"
  },
  "message": "令牌刷新成功"
}
```

#### 4.4.4 获取用户信息

- **URL**: `/api/v1/users/me`
- **方法**: `GET`
- **权限**: 用户 API

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "user123",
    "email": "user@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "createdAt": 1234567890,
    "preferences": {
      "theme": "dark",
      "defaultView": "3d",
      "starDensity": 0.7,
      "showLabels": true,
      "autoFly": false
    }
  }
}
```

#### 4.4.5 更新用户信息

- **URL**: `/api/v1/users/me`
- **方法**: `PUT`
- **权限**: 用户 API
- **请求体**:

```json
{
  "username": "new_username",  // 可选，用户名
  "email": "new_email@example.com",  // 可选，邮箱
  "avatar": "https://example.com/new_avatar.jpg"  // 可选，头像 URL
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "new_username",
    "email": "new_email@example.com",
    "avatar": "https://example.com/new_avatar.jpg"
  },
  "message": "用户信息更新成功"
}
```

#### 4.4.6 更新用户偏好设置

- **URL**: `/api/v1/users/me/preferences`
- **方法**: `PUT`
- **权限**: 用户 API
- **请求体**:

```json
{
  "theme": "light",  // 可选，主题
  "defaultView": "2d",  // 可选，默认视图
  "starDensity": 0.5,  // 可选，星点密度
  "showLabels": false,  // 可选，是否显示标签
  "autoFly": true  // 可选，是否自动飞行
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "preferences": {
      "theme": "light",
      "defaultView": "2d",
      "starDensity": 0.5,
      "showLabels": false,
      "autoFly": true
    }
  },
  "message": "偏好设置更新成功"
}
```

### 4.5 收藏相关 API

#### 4.5.1 添加收藏

- **URL**: `/api/v1/favorites`
- **方法**: `POST`
- **权限**: 用户 API
- **请求体**:

```json
{
  "type": "star",  // 收藏类型：star, cluster, map
  "targetId": "uuid"  // 目标 ID
}
```

- **响应**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "star",
    "targetId": "uuid",
    "createdAt": 1234567890
  },
  "message": "收藏成功"
}
```

#### 4.5.2 获取收藏列表

- **URL**: `/api/v1/favorites`
- **方法**: `GET`
- **权限**: 用户 API
- **查询参数**:
  - `type`: 可选，收藏类型过滤
  - `limit`: 数量限制，默认 20
  - `offset`: 偏移量，默认 0

- **响应**:

```json
{
  "success": true,
  "data": {
    "favorites": [
      {
        "id": "uuid",
        "type": "star",
        "targetId": "uuid",
        "target": {/* 目标详细信息 */},
        "createdAt": 1234567890
      }
    ],
    "total": 15
  }
}
```

#### 4.5.3 删除收藏

- **URL**: `/api/v1/favorites/{favoriteId}`
- **方法**: `DELETE`
- **权限**: 用户 API
- **路径参数**:
  - `favoriteId`: 收藏 ID（必填）

- **响应**:

```json
{
  "success": true,
  "message": "收藏删除成功"
}
```

### 4.6 系统相关 API

#### 4.6.1 获取系统状态

- **URL**: `/api/v1/system/status`
- **方法**: `GET`
- **权限**: 公共 API

- **响应**:

```json
{
  "success": true,
  "data": {
    "status": "online",
    "version": "1.0.0",
    "uptime": 3600,  // 系统运行时间（秒）
    "services": {
      "search": "online",
      "semantic": "online",
      "starmap": "online",
      "database": "online"
    },
    "stats": {
      "totalUsers": 1000,
      "totalSearches": 10000,
      "totalStarMaps": 5000
    }
  }
}
```

#### 4.6.2 获取 API 文档

- **URL**: `/api/v1/docs`
- **方法**: `GET`
- **权限**: 公共 API

- **响应**: 返回 API 文档（Swagger/OpenAPI 格式）

## 5. API 版本控制

- **当前版本**: v1
- **版本格式**: `/api/v{version}/`
- **版本策略**: 
  - 主版本号变化（v1 → v2）表示不兼容的 API 变更
  - 次版本号变化（v1.1 → v1.2）表示向后兼容的功能添加
  - 补丁版本号变化（v1.0.1 → v1.0.2）表示向后兼容的错误修复

## 6. 速率限制

- **公共 API**: 60 次/分钟/IP
- **认证用户**: 300 次/分钟/用户
- **管理员 API**: 无限制
- **超出限制响应**:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求频率超过限制，请稍后再试",
    "details": {
      "resetTime": 1234567890,  // 限制重置时间
      "remaining": 0,  // 剩余请求次数
      "limit": 60  // 限制次数
    }
  }
}
```

## 7. 最佳实践

- **使用 HTTPS**: 所有 API 请求必须使用 HTTPS
- **设置合理的超时时间**: 建议 30 秒
- **处理错误响应**: 正确处理各种错误状态码
- **缓存频繁访问的数据**: 对于不经常变化的数据，使用缓存机制
- **使用批量操作**: 对于大量数据操作，使用批量 API 端点
- **监控 API 性能**: 定期监控 API 响应时间和错误率

## 8. 开发与测试

- **开发环境**: `https://dev-api.seekstar.com`
- **测试环境**: `https://test-api.seekstar.com`
- **生产环境**: `https://api.seekstar.com`
- **API 调试工具**: 提供 Swagger UI 界面，可在 `/api/v1/docs` 访问

---

# 版本历史

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2025-12-29 | SeekStar Team | 初始后端 API 设计 |
