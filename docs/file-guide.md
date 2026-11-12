# 文件索引与维护约定

## 自定义组件资源

Section 直接引用 `assets/` 中的 CSS 和 JavaScript，不生成额外的压缩副本，也不需要构建命令。

| 功能 | Section | 资源前缀 |
| --- | --- | --- |
| Talk 互动 | `moya-talk.liquid` | `moya-talk` |
| 商品详情 | `moya-product-details.liquid` | `moya-product-details` |
| 卖点 | `moya-selling-points.liquid` | `moya-selling-points` |
| 常见问题 | `moya-faq.liquid` | `moya-faq` |
| 使用轮播 | `moya-how-carousel.liquid` | `moya-how-carousel` |
| 材质 | `moya-materials.liquid` | `moya-materials` |
| 使用场景 | `moya-scenarios.liquid` | `moya-scenarios` |
| 规格 | `moya-specifications.liquid` | `moya-specifications` |
| 商品页导航 | `moya-product-nav.liquid` | `moya-product-nav` |
| 页脚 | `footer.liquid` | `moya-footer` |

修改对应的 `.liquid`、`.css`、`.js` 文件即可。不要手动维护第二份相同功能的 `.min` 文件。

## 其他资源

- `moya-hero-*`：首页轮播脚本与素材。
- `moya-science-*`：科学介绍脚本、样式和素材。
- `moya-meet-*`、`moya-customer-voices.*`、`moya-tab-slider.*`：对应内容模块。
- `moya-pdp-*`：商品详情图标和图片，供 `moya-product-details` 等模块使用。
- `moya-selling-physics.js`、`moya-loop-geometry.js`：卖点与轮播使用的共享源码。
- `moya-public-sans-*`：字体及许可证，需一并保留。
- `theme.*`、`vendor.min.js` 及其他无 `moya-` 前缀的资源：基础主题或第三方资源，不能仅按命名判断是否可删除。

## 整理规则

1. 主题运行资源保留现有路径，避免移动后破坏 Liquid 引用和资源加载。
2. 新增说明放到 `docs/`；确认失效的开发文件直接清理，历史版本可通过 Git 查询。
3. 第三方和备份模板可能仍被后台页面使用，删除前需核对 Shopify 后台分配。
4. `node_modules/` 和 `.DS_Store` 由 Git 忽略；依赖由锁文件管理。
