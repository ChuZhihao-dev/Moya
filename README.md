# Moya

Shopify 主题项目。主题文件沿用现有目录；开发脚本与说明单独管理。

| 目录 / 文件 | 用途 |
| --- | --- |
| `assets/` | CSS、JavaScript、字体、图片和视频；保留平级资源路径 |
| `sections/` | 可配置的页面模块 |
| `snippets/` | 共享 Liquid 片段 |
| `templates/` | 页面模板及现有第三方模板 |
| `layout/` | 页面外层布局 |
| `config/` | 主题配置 |
| `locales/` | 多语言文案 |
| `docs/` | 文件索引和维护说明 |
| `agents/skills/` | 项目开发规范 |
| `skills-lock.json` | 技能来源锁定记录 |
| `.shopify/` | Shopify CLI 本地文件 |

## 开发与验证

自定义组件沿用主题的原生加载方式：Section 引用 `assets/` 中的 `.css` 和 `.js`，修改后直接生效，不需要构建或生成 `.min` 副本。基础主题和第三方库的原有压缩资源保留。

自定义组件沿用主题的 `type="module"` 加载方式，脚本自动延迟执行并隔离作用域；共享资源通过相对路径导入。

Talk 布局逻辑回归测试：

```sh
npm test
```

语法检查和逻辑测试不能替代浏览器中的布局、滚动及交互验证。
