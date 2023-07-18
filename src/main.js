// 运行在 Electron 主进程 下的插件入口
const { ipcMain, app, net } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const StreamZip = require("node-stream-zip");


// 默认配置
const default_config = {
    "mirrorlist": [
        "https://ghproxy.com/https://raw.githubusercontent.com/mo-jinran/LiteLoaderQQNT-Plugin-List/main/builtins.json",
        "https://ghproxy.com/https://raw.githubusercontent.com/mo-jinran/LiteLoaderQQNT-Plugin-List/main/plugins.json"
    ],
    "plugin_type": [
        "all",
        "current"
    ],
    "sort_order": [
        "random",
        "forward"
    ],
    "list_style": [
        "single",
        "loose"
    ]
}


// 简易的GET请求函数
function request(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith("https") ? https : http;
        const request = protocol.get(url);
        request.on("error", error => reject(error));
        request.on("response", response => {
            // 发生跳转就继续请求
            if (response.statusCode >= 300 && response.statusCode <= 399) {
                return reject(request(response.headers.location));
            }
            const chunks = [];
            response.on("error", error => reject(error));
            response.on("data", chunk => chunks.push(chunk));
            response.on("end", () => resolve(Buffer.concat(chunks)));
        });
    });
}


function getConfig(liteloader) {
    const config_path = liteloader.path.config;
    try {
        const data = fs.readFileSync(config_path, "utf-8");
        const config = JSON.parse(data);
        return {
            ...default_config,
            ...config?.[plugin.manifest.slug] ?? {}
        };
    }
    catch (error) {
        return default_config;
    }
}


function setConfig(liteloader, new_config) {
    const config_path = liteloader.path.config;
    try {
        const data = fs.readFileSync(config_path, "utf-8");
        const config = JSON.parse(data);

        config[plugin.manifest.slug] = new_config;

        const config_string = JSON.stringify(config, null, 4);
        fs.writeFileSync(config_path, config_string, "utf-8");
    }
    catch (error) {
        return error;
    }
}


async function install(liteloader, manifest) {
    const { repo, branch, use_release } = manifest.repository;
    const { tag, name } = use_release ?? {};
    const latest_release_url = `https://ghproxy.com/https://github.com/${repo}/releases/${tag}/download/${name}`;
    const source_code_url = `https://ghproxy.com/https://github.com/${repo}/archive/refs/heads/${branch}.zip`;

    const downloadAndInstallPlugin = async (url) => {
        const body = await request(url);

        // 保存插件压缩包
        const cache_path = path.join(liteloader.path.plugins_cache, "plugins_marketplace");
        const cache_file_path = path.join(cache_path, `${repo.split("/")[1]}.zip`);
        fs.mkdirSync(cache_path, { recursive: true });
        fs.writeFileSync(cache_file_path, body);

        // 解压并安装插件
        const { plugins, builtins } = liteloader.path;
        const plugin_path = manifest.type == "core" ? builtins : plugins;
        const zip = new StreamZip.async({ file: cache_file_path });
        await zip.extract(null, plugin_path);
        await zip.close();
    }

    try {
        const url = use_release ? latest_release_url : source_code_url;
        await downloadAndInstallPlugin(url);
        return true;
    }
    catch (error) {
        return false;
    }
}


async function uninstall(liteloader, manifest, update_mode = false) {
    const paths = liteloader.plugins[manifest.slug].path;

    // 没有返回false
    if (!paths) {
        return false;
    }

    // 更新模式只删除插件本体
    if (update_mode) {
        fs.rmSync(paths.plugin, { recursive: true, force: true });
        return true;
    }

    // 删除插件的目录
    for (const [name, path] of Object.entries(paths)) {
        fs.rmSync(path, { recursive: true, force: true });
    }

    // 成功返回true
    return true;
}


async function update(liteloader, manifest) {
    // 先卸载
    if (!(await uninstall(liteloader, manifest, true))) {
        return false;
    }
    // 后安装
    if (!(await install(liteloader, manifest))) {
        return false;
    }
    return true;
}


async function restart() {
    app.relaunch();
    app.exit(0);
}


function isOnline() {
    return net.online;
}


// 加载插件时触发
function onLoad(plugin, liteloader) {
    // 获取配置
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.getConfig",
        (event, ...message) => getConfig(liteloader, ...message)
    );
    // 设置配置
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.setConfig",
        (event, ...message) => setConfig(liteloader, ...message)
    );
    // 安装
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.install",
        (event, ...message) => install(liteloader, ...message)
    );
    // 卸载
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.uninstall",
        (event, ...message) => uninstall(liteloader, ...message)
    );
    // 更新
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.update",
        (event, ...message) => update(liteloader, ...message)
    );
    // 重开
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.restart",
        (event, ...message) => restart()
    );
    // 是否有网
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.isOnline",
        (event, ...message) => isOnline()
    )
}


module.exports = {
    onLoad
}
