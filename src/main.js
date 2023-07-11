// 运行在 Electron 主进程 下的插件入口
const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const StreamZip = require("node-stream-zip");


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
    // 下载插件
    const url = `https://codeload.github.com/${info.repo}/zip/refs/heads/${info.branch}`;
    const { isRedirect, body } = await request(url);

    // 如果需要跳转
    if (isRedirect) {
        return;
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
}


// 加载插件时触发
function onLoad(plugin, liteloader) {
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.getConfig",
        (event, message) => getConfig(liteloader)
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.setConfig",
        (event, message) => setConfig(liteloader, message)
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.install",
        (event, message) => install(liteloader, message)
    );
}


// 这两个函数都是可选的
module.exports = {
    onLoad
}