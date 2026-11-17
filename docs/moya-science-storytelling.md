# Moya Science Storytelling

独立的 OS 2.0 Section，复刻 https://moya-companion.pages.dev/ 的四章摄影叙事。
首页保留并显示原 moya_science_intro，新组件紧随其后；新旧两个组件的代码和配置独立保留。
没有修改 layout/theme.liquid，没有发布线上主题。

## 配置

编辑器添加 Moya Science Storytelling，预设包含白天、傍晚、触摸和温暖四章，支持 1–8 章。
每章可配置图片、手机图片、换行标题、主题标签、科学说明、产品关联、研究链接、氛围与粒子位置。

- Scroll journey / Stacked chapters：空间旅程或普通图文。
- Enable scroll animation：关闭后所有文字仍然可读。
- Enable page smooth scrolling：页面共用一个 Lenis，影响含本组件的整页；编辑器停用，触屏保持原生滚动。
- Reading hold / Scroll distance / Opening hold：阅读距离与开场停留。
- Animation smoothing without Lenis：不启用 Lenis 时的 ScrollTrigger scrub。
- Particle effect / offsets / size：按原图校准的四种效果，可关闭；更换图片后需重新校准。
- Optional page anchor：外部导航锚点；多实例需使用不同值，首页使用 moya-science。

沿用项目 Outfit 字体和源码直接加载约定，没有新增自定义源码压缩步骤。
四张参考 WebP 本地托管，自定义图使用 Shopify 响应式图片。

## 实现

- moya-science-storytelling.liquid：服务端图文、唯一章节 ID、Schema。
- moya-science-storytelling.css：隔离样式、原生 sticky 舞台、普通流降级。
- moya-science-storytelling.js：Custom Element 生命周期、测量、导航、编辑器事件。
- moya-story-timeline.js：单个 GSAP 时间轴，命名照片站、阅读站、相机转场。
- 每组照片停稳后保留 0.25 个时间轴单位，再让文字卡片淡入；卡片入场完成后展开正文，不提前跨入上一组。
- moya-story-geometry.js：照片角点投影、世界路径；路径合并为三个深度组，停留时不重算。
- moya-story-particles.js：照片坐标系 Canvas，按活跃状态暂停，约 30 FPS，DPR 上限 1.5。
- moya-story-runtime.js：依赖懒加载、Lenis 引用计数、GSAP ticker 同步、Impact 抽屉锁定与清理。

依赖 GSAP / ScrollTrigger 3.15.1（现有 npm 安装）、Lenis 1.3.27（npm 官方包）。
第三方压缩资源保留许可证头，Lenis MIT 许可证位于 assets/lenis-license.txt。
UMD 文件按经典 script 加载，避免 ES module 严格模式下的全局赋值错误。

高度低于 650px、完整说明放不进舞台、减少动态效果、关闭动效或依赖失败时，恢复完整图文。
禁用 JS 时 Liquid 内容仍可读。卸载仅清理本实例的时间轴、Observer、事件与共享滚动租约。
既有 Meet 到旧 Science 的特殊覆盖规则不应用到新组件，新组件按正常文档流衔接。

## 验证记录（2026-11-17）

| 条款 / 项目 | 结果 | 证据与边界 |
| --- | --- | --- |
| DEV-02/03/07 原生组件与隔离 | 通过 | Section/Blocks、项目前缀、保留旧配置 |
| DEV-05 配置 | 通过 | 两种布局、动效开关、阅读距离、开场停留与分章配置；开发主题接受 Schema |
| DEV-10 接入 | 通过 | 组件运行时加载，不改 theme.liquid；引用计数测试覆盖释放 |
| DEV-13 媒体 | 通过 | 预览 HTML 中图片 lazy、尺寸齐全，Canvas 按活跃状态暂停 |
| DEV-14 自定义源码压缩 | 不适用 | 按本项目明确约定直接加载自定义源码，第三方使用官方压缩文件 |
| DEV-16/17/18、HOME-02/03/06 | 通过 | 本组件 H2/H3/H4、HTML 文本、alt、真实 a[href]；预览无 Liquid error，不代表全站 SEO 审查 |
| 逻辑回归 | 通过 | npm test 共 22 项，覆盖照片先于文字卡片的顺序、投影、正反向及刷新时间轴、隔离、Lenis 释放和原有回归 |
| Theme Check 增量 | 通过 | 前后均 423 项（357 error / 66 warning），新增 0，既有问题未处理 |
| 桌面与手机视觉 | 通过 | Chrome 开发预览，1920×1080、393×852，检查开场、透视、夜间卡片、手机完整说明、减少动态效果降级 |
| 编辑器完整交互 | 待验证 | 已实现生命周期与选择事件，未逐项操作真实编辑器验证重复添加、拖动、删除和所有设置 |
| DEV-15 正式性能 | 待验证 | 未生成真实业务环境 Lighthouse 报告，不承诺测得 60 FPS 或正式性能分数 |
| 正式上线 | 待验证 | 仅开发主题预览，未发布 |

开发地址 http://127.0.0.1:9293/#moya-science，预览主题 187271774508；开发服务停止后本地地址不可用。
浏览器仍显示现有 React/ReactDOM 外链 404/CORS 和 Shopify 预览请求错误，本次保留原状。
