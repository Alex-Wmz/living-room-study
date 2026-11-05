# 客厅学习站 · 浏览器演示包

版本：0.1.0-preview.1。

完整解压后，文件保持在一起。运行代码无第三方依赖，题目与练习记录不上传。
已验证的方式是本机 HTTP：准备 Python 3.10+，在解压目录执行以下命令，**可整段复制执行**：

```powershell
python serve.py
```

看到 `Demo: http://127.0.0.1:8947/` 后在本机浏览器打开该地址。结束时在此终端按 Ctrl+C。
只监听本机，不是电视或远程管理入口。
支持本地文件的浏览器也可尝试直接打开 `index.html`；本轮自动浏览器不允许 file 协议，此方式尚未实测。

可试：课程选择、方向键/Enter 答题、解析、错题复习、模拟观看倒计时、JSON 题库导入。
`question-bank.example.json` 是可编辑的原创演示题库，不是正式教材配套题。

这是网页流程演示，没有 APK，不会锁定电视、修改电视固件、覆盖其他应用或移除开机广告。
电视原生适配与实机验收见源码仓库的通用实现指南。

方向键移动焦点，Enter 确认，Esc 返回；也可用鼠标。
题库、许可证、商业授权与源代码：
https://github.com/Alex-Wmz/living-room-study

符合 PolyForm Noncommercial 1.0.0 的非商业用途免费，商业使用另行书面授权。
请一并保留 LICENSE、NOTICE 与 COMMERCIAL_LICENSE.md。
