# 开发条款

来源 A 的四个模块；同编号在后半部“去AI味版本”重复出现。级别为当前临时默认，差异见 source-notes.md。

| 编号 | 原文定位 | 级别 | 执行要求 | 主要验证证据 |
|---|---|---|---|---|
| DEV-01 | A 1.1 | 必须/禁止 | 优先官方 Theme Store 高性能主题（如 Dawn 或认证商业主题）；不用非标准渠道的臃肿、过期或恶意脚本主题 | 主题来源及现有项目记录 |
| DEV-02 | A 1.1 | 必须 | 保留基础主题架构，定制走原生机制或标准扩展，避免破坏性重构 | 修改范围、架构差异 |
| DEV-03 | A 1.2 | 必须 | 主题定制基于 OS 2.0 Section/Block；不自建封闭式页面逻辑 | 模板、Section、Block 结构 |
| DEV-04 | A 1.2 | 必须 | 最大程度复用颜色、字体、间距变量及按钮、卡片、标签组件；避免跨 Section 重复相似样式 | 代码与整站视觉检查 |
| DEV-05 | A 1.3 | 必须（新组件） | 编码前规划样式变体、动效与配置，提供适用的多种布局模式；Schema 支持动效开关、速度、延迟，供运营复用 | 方案、Schema、Theme Editor 配置演示 |
| DEV-06 | A 2.1 | 优先/限制 | 优先 Vanilla JS；非 headless 项目不无节制引入 jQuery、React 等重量框架，headless 例外需识别 | 依赖和交互代码 |
| DEV-07 | A 2.1 | 必须 | 自定义 CSS 使用 BEM 或明确项目前缀，防止主题与 App 样式冲突 | 选择器和页面集成检查 |
| DEV-08 | A 2.2 | 必须 | 简单面包屑、尺码表弹窗、分享图标等可用 Liquid/CSS/JS 实现时优先源码，不为其引入 App | 实现选择与依赖 |
| DEV-09 | A 2.2 | 条件适用 | 必须使用 App 时优先官方推荐、Built for Shopify、Plus Certified 或高评分、性能好、支持完善的 App；例子不是指定供应商 | 选型依据，执行时核实当前资格 |
| DEV-10 | A 2.2 | 必须 | 避免硬编码脚本污染 theme.liquid；手动接入用有注释的 Snippet（后版亦提 App Block）隔离，卸载可完整移除，无无效脚本/请求 | 集成位置、清理说明、请求检查；未执行卸载不得声称实测 |
| DEV-11 | A 3.1 | 必须 | 对实际首屏 Banner、关键字体、CDN 等关键依赖采用适用的 preload/preconnect/dns-prefetch | 最终 HTML 与网络请求 |
| DEV-12 | A 3.1 | 必须 | 首屏首图显式 fetchpriority="high" | 渲染 HTML 与首屏请求 |
| DEV-13 | A 3.1 | 必须 | 视口外图片、音视频、社交组件延迟加载；按资源类型落实 | 元素及实际加载时机 |
| DEV-14 | A 3.1 | 必须 | 自定义 JS/CSS 发布前 Minify，验证线上 gzip/brotli 传输压缩 | 构建产物、响应头 |
| DEV-15 | A 3.2 表格 | 必须（正式交付） | 含商品、变体、评论、合规追踪的真实环境提供 PSI/Lighthouse 报告：性能得分移动端 ≥60、桌面端 ≥80；低于标准优化后复测 | 两端报告、URL、时间、环境与配置 |
| DEV-16 | A 4.1 | 必须 | 语义化 HTML5；每页且仅一个 H1；H2–H6 合理层级 | 最终整页 DOM/HTML |
| DEV-17 | A 4.1 | 必须 | 图片有 alt；商品、集合、博客图片后台缺 Alt 时以相应标题动态兜底 | 有/无后台 Alt 两种数据下渲染结果 |
| DEV-18 | A 4.1 | 必须 | 页面跳转用 a[href]，不用 onclick 代替；Ajax 动作除外 | 可抓取 HTML、交互检查 |
| DEV-19 | A 4.2 | 必须 | PDP 完整动态 JSON-LD，Rich Results Test 无 Error；包含 Name、Image、Description，Offers 的 Price、PriceCurrency、Availability，存在真实评价时同步 AggregateRating/Review | JSON-LD、真实商品对照及外部测试报告 |
| DEV-20 | A 4.2 | 必须（适用页面） | 输出面包屑 JSON-LD，表达页面层级 | 页面导航与 JSON-LD 对照 |
