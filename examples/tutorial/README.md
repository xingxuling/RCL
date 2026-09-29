# RCL 从零开始｜第 05 课：第一次自己写一个 RCL 程序

本目录对应 B 站《RCL 从零开始》系列的第一次实战课。

## 本课目标

从一个空文件开始，写出一个真正可以由 RCL Runtime 执行的程序。

场景：

- 钱包余额：100
- 商店状态：营业中
- 咖啡价格：30
- 行动者：me
- 需要权限：`wallet.spend on wallet`
- 安全边界：余额不能小于 0
- 最终结果：余额 70

## 运行

在 RCL 仓库根目录执行：

```bash
node src/cli.mjs run examples/tutorial/05-my-first-program.rcl
```

正常结果中应看到：

```text
program: CoffeeShop
status: realized
wallet.balance: 70
```

## 自己改一改

1. 把 `shop.open` 改成 `false`，观察事件是否触发。
2. 把初始余额改成 `20`，观察 `preserve wallet.balance >= 0` 如何阻止越界。
3. 把咖啡价格 `30` 改成其他数值，观察最终余额。

本课只把 `alter` 理解成“这次要改什么”，把 `realize` 理解成“真正执行这个事件”。它们的完整语义会在后续课程单独展开。
