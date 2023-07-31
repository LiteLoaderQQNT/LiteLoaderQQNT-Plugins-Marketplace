// 运行在 Electron 主进程 下的插件入口
const { ipcMain, app, net, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const StreamZip = require("node-stream-zip");


// 默认配置
const default_config = {
    "mirrorlist": [
        "https://ghproxy.com/https://raw.githubusercontent.com/mo-jinran/LiteLoaderQQNT-Plugin-List/v3/plugins.json",
        "https://ghproxy.com/https://raw.githubusercontent.com/mo-jinran/LiteLoaderQQNT-Plugin-List/v3/builtins.json"
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
        const req = protocol.get(url);
        req.on("error", error => reject(error));
        req.on("response", res => {
            // 发生跳转就继续请求
            if (res.statusCode >= 300 && res.statusCode <= 399) {
                return resolve(request(res.headers.location));
            }
            const chunks = [];
            res.on("error", error => reject(error));
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks)));
        });
    });
}


function getConfig() {
    const config_path = LiteLoader.path.config;
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


function setConfig(new_config) {
    const config_path = LiteLoader.path.config;
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


async function install(manifest) {
    const { repo, branch, use_release } = manifest.repository;
    const { tag, name } = use_release ?? {};
    const release_latest_url = `https://ghproxy.com/https://github.com/${repo}/releases/${tag}/download/${name}`;
    const release_tag_url = `https://ghproxy.com/https://github.com/${repo}/releases/download/${tag}/${name}`;
    const source_code_url = `https://ghproxy.com/https://github.com/${repo}/archive/refs/heads/${branch}.zip`;

    const downloadAndInstallPlugin = async (url) => {
        const body = await request(url);

        // 保存插件压缩包
        const cache_path = path.join(LiteLoader.path.plugins_cache, "plugins_marketplace");
        const cache_file_path = path.join(cache_path, `${manifest.slug}.zip`);
        fs.mkdirSync(cache_path, { recursive: true });
        fs.writeFileSync(cache_file_path, body);

        // 解压并安装插件
        const { plugins, builtins } = LiteLoader.path;
        const plugin_path = `${manifest.type == "core" ? builtins : plugins}/${use_release ? manifest.slug : ""}`;
        fs.mkdirSync(plugin_path, { recursive: true });
        const zip = new StreamZip.async({ file: cache_file_path });
        const entries = await zip.entries();
        for (const entry of Object.values(entries)) {
            const pathname = `${plugin_path}/${entry.name}`;
            // 创建目录
            if (entry.isDirectory) {
                fs.mkdirSync(pathname, { recursive: true });
                continue;
            }
            // 创建文件
            if (entry.isFile) {
                await zip.extract(entry.name, pathname);
                continue;
            }
        }
        await zip.close();
    }

    try {
        const release_url = tag == "latest" ? release_latest_url : release_tag_url;
        const url = use_release ? release_url : source_code_url;
        await downloadAndInstallPlugin(url);
        return true;
    }
    catch (error) {
        return false;
    }
}


async function uninstall(manifest, update_mode = false) {
    const paths = LiteLoader.plugins[manifest.slug].path;

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


async function update(manifest) {
    // 先卸载
    if (!(await uninstall(manifest, true))) {
        return false;
    }
    // 后安装
    if (!(await install(manifest))) {
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

function openWeb(url) {
    shell.openExternal(url);
}

// 加载插件时触发
function onLoad(plugin) {
    // 获取配置
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.getConfig",
        (event, ...message) => getConfig(...message)
    );
    // 设置配置
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.setConfig",
        (event, ...message) => setConfig(...message)
    );
    // 安装
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.install",
        (event, ...message) => install(...message)
    );
    // 卸载
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.uninstall",
        (event, ...message) => uninstall(...message)
    );
    // 更新
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.update",
        (event, ...message) => update(...message)
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
    );
    // 外部打开网址
    ipcMain.on(
        "LiteLoader.plugins_marketplace.openWeb",
        (event, ...message) => openWeb(...message)
    );
}


module.exports = {
    onLoad
}
