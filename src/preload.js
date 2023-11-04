// Electron 主进程 与 渲染进程 交互的桥梁
const { contextBridge, ipcRenderer } = require("electron");

// 在window对象下导出只读对象
contextBridge.exposeInMainWorld("plugins_marketplace", {
    // 请求
    request: (url) =>
        ipcRenderer.invoke("LiteLoader.plugins_marketplace.request", url),
    // 获取配置
    getConfig: () =>
        ipcRenderer.invoke("LiteLoader.plugins_marketplace.getConfig"),
    // 设置配置
    setConfig: (config) =>
        ipcRenderer.invoke("LiteLoader.plugins_marketplace.setConfig", config),
    // 安装
    install: (manifest) =>
        ipcRenderer.invoke("LiteLoader.plugins_marketplace.install", manifest),
    // 卸载
    uninstall: (manifest) =>
        ipcRenderer.invoke(
            "LiteLoader.plugins_marketplace.uninstall",
            manifest
        ),
    // 更新
    update: (manifest) =>
        ipcRenderer.invoke("LiteLoader.plugins_marketplace.update", manifest),
    // 重开
    restart: () => ipcRenderer.invoke("LiteLoader.plugins_marketplace.restart"),
    // 是否有网
    isOnline: () =>
        ipcRenderer.invoke("LiteLoader.plugins_marketplace.isOnline"),
    // 外部打开网址
    openWeb: (url) =>
        ipcRenderer.send("LiteLoader.plugins_marketplace.openWeb", url)
});
