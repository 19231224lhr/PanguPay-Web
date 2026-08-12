# Ledger Plane 美学重构实施记录

1. 用组件测试先锁定账户菜单、显式锁定、移动端“我的”和访问空间结构。
2. 重整钱包 Token、216px 侧栏、1240px 内容平面与 hairline 分组。
3. 建立 `WalletAccountMenu`、`WalletMobileNavigation`、`WalletBalanceField` 和 `WalletStatusSummary`。
4. 将解锁、创建和导入页统一为 7:5 品牌空间与无外框表单。
5. 将总览改为单一余额价值场和连续资产/活动平面。
6. 将发送、收款、活动、安全、组织和设置页统一为紧凑页面语法。
7. 只给首页入口启用 620ms View Transition，钱包内部保持 190ms 短切换。
8. 删除正式 `/__ledger-preview` 路由，仅在开发模式注册 `/__foundation`。
9. 用深浅主题、桌面/手机共 16 张视觉基准图锁定 Landing、Unlock、Overview 和 Security。
10. 运行类型、格式、静态检查、单元、协议、E2E、构建及可见浏览器真实点击验收。
