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
        "https://ghproxy.com/https://raw.githubusercontent.com/mo-jinran/LiteLoaderQQNT-Plugin-List/main/list.json"
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
            const chunks = [];
            const result = {
                isRedirect: false,
                body: null
            }
            // 发生跳转就返回新连接
            if (response.statusCode >= 300 && response.statusCode <= 399) {
                result.isRedirect = true;
                result.body = response.headers.location;
                reject(result);
                return;
            }
            response.on("error", error => reject(error));
            response.on("data", chunk => chunks.push(chunk));
            response.on("end", () => {
                result.isRedirect = false;
                result.body = Buffer.concat(chunks);
                resolve(result);
            });
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


async function install(liteloader, info) {
    const latest_release_url = `https://github.com/${info.repo}/releases/latest/download/plugin.zip`;
    const source_code_url = `https://codeload.github.com/${info.repo}/zip/refs/heads/${info.branch}`;

    const downloadAndInstallPlugin = async (url) => {
        const { isRedirect, body } = await request(url);

        // 一般情况下是useRelease，这里用来重新调用函数下载
        if (isRedirect) {
            const { isRedirect, body } = await request(body);
            if (isRedirect) {
                return await downloadAndInstallPlugin(body);
            }
        }

        // 保存插件压缩包
        const cache_path = path.join(liteloader.path.plugins_cache, "plugins_marketplace");
        const cache_file_path = path.join(cache_path, `${info.repo.split("/")[1]}.zip`);
        fs.mkdirSync(cache_path, { recursive: true });
        fs.writeFileSync(cache_file_path, body);

        // 解压并安装插件
        const zip = new StreamZip.async({ file: cache_file_path });
        await zip.extract(null, liteloader.path.plugins);
        await zip.close();
    };

    try {
        const url = info.useRelease ? latest_release_url : source_code_url;
        await downloadAndInstallPlugin(url);
        return true;
    }
    catch (error) {
        return false;
    }
}


async function uninstall(liteloader, slug, update_mode = false) {
    const paths = liteloader.plugins?.[slug]?.path;

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


async function update(liteloader, info, slug) {
    const uninstall_status_is_ok = await uninstall(liteloader, slug, true);
    if (!uninstall_status_is_ok) {
        return false;
    }
    const install_status_is_ok = await install(liteloader, info);
    if (!install_status_is_ok) {
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
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.getConfig",
        (event, ...message) => getConfig(liteloader, ...message)
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.setConfig",
        (event, ...message) => setConfig(liteloader, ...message)
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.install",
        (event, ...message) => install(liteloader, ...message)
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.uninstall",
        (event, ...message) => uninstall(liteloader, ...message)
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.update",
        (event, ...message) => update(liteloader, ...message)
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.restart",
        (event, ...message) => restart()
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.isOnline",
        (event, ...message) => isOnline()
    )
}


module.exports = {
    onLoad
}
