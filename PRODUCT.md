# PanguPay Web 产品范围

PanguPay Web 是 Pangu 转账区的用户钱包，也是 TXCer、GQNC 和跨链终局状态的可信可视化入口。

## 产品承诺

- 用户操作必须对应真实协议状态；不以一个含糊的“成功”代替入口接收、快速可用、后台认证或目标链到账。
- 金额、交易 ID、地址和安全证据必须精确，不为视觉效果牺牲协议真实性。
- 首页负责品牌叙事，钱包负责高频操作；两者共享 Logo、蓝色价值场和克制运动。
- 正常状态保持安静，只有离线、隔离、验证失败或需要恢复时提高视觉优先级。

## 当前产品能力

- 创建、加密备份、独立恢复材料、导入、解锁、忘记密码恢复、手动和自动锁定。
- 与 Go `wallet-keystore/wallet.json` v1 互通的浏览器 keystore。
- 组织身份恢复、独立使用、组织详情、加入和带二次确认的安全退出。
- 多地址账户、真实地址登记、切换、二维码、复制和 fail-closed 归档。
- 原始地址和胶囊地址收款；胶囊地址生成、权威公钥获取、P-256 验签和真实地址解析。
- 独立账户普通转账，以及组织成员的普通、快速、纯 TXCer、混合与跨链转账。
- 普通、快速、跨链三种交易在审核、结果和活动记录中使用一致名称。
- 快速转账分别展示交易接收、担保/组织确认、收款方可用和后台结算。
- 跨链转账分别展示本地 GQNC 认证、轻计算区接收和目标链 receipt 确认；目标链未确认时不显示到账。
- TXCer 生命周期、FastEvidence、AssignAck、LiabilityReceipt、CFAA 和 ExposureShares 可视化。
- 只读 GQNC 认证链浏览器：认证高度、区块、交易、系统动作、QC 签名者和委员会状态。
- 本地显示名、头像、Obsidian/Pearl 主题、中文/英文和减少动态效果。
- protocol-v2 客户端核心与 Go golden vectors。

## 安全与数据边界

- 私钥和 RootSeed 只存在于已解锁会话内存；IndexedDB 仅保存加密 envelope 和公共账户快照。
- LocalStorage 只保存非秘密偏好和可恢复的公共状态，不得保存明文秘密。
- 胶囊地址是可重复使用的签名隐私别名，不是一次性地址；链上 wire 只使用解析后的真实 40-hex 地址。
- 跨链不接受胶囊地址，目标链 `receipt.status=1` 且存在区块高度后才算完成。
- CFAA `Pending/Unavailable` 不阻塞 Active TXCer；FastEvidence、Ack 或责任收据明确失败时 fail closed。
- 区块链页只读取 Gateway 公开的 GQNC 观测接口，不提供投票、治理、赔付或节点控制。

## 明确非目标

- 不复制旧 Web 或浏览器插件的视觉结构。
- 不提供 Governance、Redemption Claim、Compensation、Liability 运维或 GQNC 控制台。
- 不新增后端共识、状态根、交易 wire 或钱包协议。
- 不使用假价格、假吞吐或没有实验依据的实时指标。
- 不为每个数值增加动画；金额、ID、责任份额和安全证据以稳定阅读为优先。

正式页面与真实点击路径见 [钱包 UI 操作图谱](./docs/testing/wallet-ui-operation-atlas.md)。
