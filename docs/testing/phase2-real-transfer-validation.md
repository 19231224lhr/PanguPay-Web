# Phase 2 真实转账对接验证

适用基线：2026-07-28，`PanguPay-Web` Phase 2 工作树与 `UTXO-Area` `experiment` 分支。

## 验证方法

测试使用可见浏览器、全新临时 Profile 和全新 4-ComNode 数据库。钱包恢复、解锁、组织状态、转账模式、地址、金额、审核和提交均通过页面真实点击与输入完成；没有直接调用交易构造函数，也没有通过 LocalStorage 绕过页面。

每笔交易分别核对：

- 页面生成的 64 位十六进制 TXID；
- 普通 UTXO、TXCer 输入和找零组成；
- Gateway/Assign 的入口接收结果；
- TXCer Active 快速可用状态；
- GQNC 后台认证与最终余额。

## 已通过流程

- 快速转账：Alice 向 Bob 支付 12 PGC，Bob 在来源交易后台结算前获得 Active TXCer。
- 纯 TXCer 再支付：Bob 使用 1 个 TXCer 输入向 Charlie 支付 12 PGC，普通输入为 0，SettlementAuth 完整。
- 普通成员转账：3 PGC 交易完成入口校验和 GQNC 结算。
- 混合转账：普通 UTXO 与 TXCer 同时作为输入，交易 `1fa081…faacf` 完成后台结算。
- 跨链转账：修正 seed-sweep 选币后，以 1 个普通输入和 39 PGC 找零完成提交及结算。
- 散户普通转账：Alice 以独立账户向 Bob 支付 2 PGC，交易 `a74d15303396f5dbcba65025d6408aea365baf42a31c5449567abae211bb64e9` 显示“后台已结算”；Alice 余额由 100 变为 98 PGC，Bob 由 100 变为 102 PGC。

此前的完整场景最终达到 GQNC certified height 19，4 个 validator 状态一致，安全状态为 `NORMAL`。
散户专项复验结束时 certified height 为 3、QC 数量为 3，pending 地址授权为 0，安全状态同样为 `NORMAL`。

## 本轮发现并修复的问题

### seed-sweep 选币冲突

同一 RootSeed 派生的一组 UTXO 中，只要任一成员已为 TXCer 提供来源担保，其他兄弟 UTXO 就不能被跨链或普通选币单独消费。客户端现在按完整 seed-sweep 组过滤，避免生成后端必然拒绝的部分消费交易。

### 散户路由不等于地址授权

后端返回 `GroupID=1` 只说明地址路由到散户路径，不代表该地址的 `SignPublicKeyV2` 已被 GQNC 认证。提交散户交易前，客户端现在始终重发可幂等验证的地址授权，再确认路由状态。

### 地址授权重试必须字节一致

地址授权的 `TimeStamp` 参与 `RegistrationID`。若每次重试使用当前时间，相同地址会形成不同授权并触发 pending 冲突。客户端改用协议允许的确定性非零授权时间值，使同一钱包在重试、刷新和重新导入后生成完全相同的授权对象与签名材料。

## 保留边界

- 本阶段没有修改 GQNC、TXCer、CFAA、LevelDB、Gateway 路由或后端生产代码。
- 收款地址尚未认证时，后端返回的 seed metadata 可能暂时落后；客户端不得猜测或改写权威数据。真实链路通过先完成地址接入再发起后续支付规避该窗口，后续若需要任意新收款地址立即再支付，应单独补充后端契约。
- 页面将“入口已接收”“TXCer 可用”和“后台已结算”作为三个独立状态，不以单一成功提示混淆它们。
