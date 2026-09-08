# Workflow 修复与真实试玩记录

日期：2026-09-08。范围：三个 room 的 Voting 崩溃、Manager 审查失败处理、Final Report 流程，并在真实浏览器中检查其他问题。

## 本次修改

- `src/langgraph/workflowUtils.ts`：缺省 agent 不再被判为 Ghost，避免读取 undefined.getBiasType；Manager 结构化返回使用 JSON schema，绕过生产文本重写。
- `src/langgraph/votingUtils.ts`：投票结束后保留上游输入，不再重新读取共享数据并覆盖它。
- `src/langgraph/discussionUtils.ts`：Visualization Discussion 将自己的图表交给最终评估，不再换成上一房间的文章、不再硬覆盖模型的数据；无效图表由共享评估处理，而非提前中断整个发布流程。
- `src/game/domain/editorialManager.ts`：增加独立评估/审查的严格响应 schema，明确比较同一统计范围，避免把分组与汇总领先者不同直接当作矛盾。
- `src/langgraph/editorialManager.ts`：接入上述 schema；独立评估额外提供完整的分组计数表，注明 CSV 是可能截断的摘录。生产 agent 的模型和角色不变。
- `src/game/scenes/level1.tsx`、`level2.tsx`、`level3.tsx`：Manager 评估或审查异常不再静默绕过；将失败/阻止发布状态绑定到真正可见的 simulation 标签。
- `src/game/utils/sceneUtils.ts`：删除改名/移除后留下的旧房间成员名。
- `tests/WorkflowRouting.test.ts`：新增 12 项回归测试，执行实际 Voting/Discussion 图，以模拟替代外部模型、动画和浏览器边界；覆盖三个房间、输入保留、结构化 Manager 请求、计数证据、旧成员清理、三个关卡的失败提示绑定及无效图表传递。

简化：删除了 Voting 的冗余上下文替换，以及 Discussion 的文章替代图表、真数据强制覆盖和提前编译中断；复用已有最终评估路径。没有添加依赖，没有禁用日志下载，没有强制 Manager 批准，没有修改普通 agent 的模型。

## 实际试玩

通过真实浏览器点击策略菜单、选择棒球数据、拖动帽子分配 Manager、启动、打开报告、滚动、展开评分完成验证。没有通过直接调用游戏内部状态跳过流程。

| Run ID | 配置和结果 |
| --- | --- |
| `cb5ac5be-377d-49f3-91ad-0050ac8f2152` | 三房间 Voting + Manager。前两房间运行成功，Manager JSON 能解析，但其事实判断自相矛盾；修改后复审仍拒绝，因此阻止发布。 |
| `925b928e-9da5-45d9-8aa0-69d11bc979c8` | 改善审查提示并提供完整计数后重试。Manager 仍误判，记录为未解决的模型质量问题，未强行放行。 |
| `478bf754-1af2-4d8c-b150-bbb551fc7c77` | 不分配 Manager 的对照。开发服务器停止、浏览器刷新显示连接被拒绝，未计为通过；随后恢复本地服务器。 |
| `4fde8e2a-7ff7-42e9-8443-9b1c948df7c0` | 恢复服务后的完整对照：三个房间 Voting 均完成，策略评估、质量优化、输出评分和发布均完成。页面显示 Strategy **8/10**、Output **10/10** 和 Next Level。实际点击 Final Report，看到正文及四个图表；报告上下滚动有效；评分详情展开有效。本轮详情能全部容纳，因此未证明超长评分文本的滚动上限。 |

原始记录保留于 `.local/mas-runs/<runId>/`。没有删除既有运行记录。159 项测试通过；生产构建通过。全仓库 TypeScript 与 ESLint 检查仍未通过，不能宣称仓库整体无错误；构建另有包体积和现有动态代码执行警告。

## 额外发现和剩余风险

1. **Manager 误判仍然存在**：当前配置为 gpt-5-nano / minimal。两次真实运行中，它复述相同事实仍判不一致。这是模型判断问题，结构化 JSON 只能修格式，不能保证事实判断；此次未换模型或强制批准。失败后不会绕过 Manager 发布。
2. **图表视觉质量与评分不一致**：成功运行的图表正常生成，但部分标题边缘被裁切，非零纵轴范围的柱形有向绘图区外延伸现象；模型仍给 Coding 10/10。渲染成功和满分不是视觉正确性的证明，需要独立的图表布局/渲染检查。
3. **Visualization Sequential 的另外两席仍需单独修复/验证**：代码检查发现后续编辑分支没有使用 Ghost 的反向数据选择逻辑，第三席还读取第一席而非第二席输出。本轮最终成功路径是 Voting，不证明这些 Sequential 路径正确。
4. 开发控制台有旧 sprite frame 缺失及 react-draggable 的 findDOMNode 弃用警告；本轮未因此中断。
5. 三个关卡的核心共享 Voting 用回归测试覆盖；真实端到端试玩在 Level 1 完成，未把所有关卡、数据集及策略组合全部玩遍。Manager blocked 的新可见标签有代码绑定回归测试，尚未在修改后的第三次 Manager 运行中复验。
