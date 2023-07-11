// 运行在 Electron 主进程 下的插件入口
const { ipcMain } = require("electron");
const fs = require("fs");


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


// 加载插件时触发
function onLoad(plugin, liteloader) {
    ipcMain.handle(
        "LiteLoader.plugins_marketplace.getConfig",
        (event, message) => {
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
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.setConfig",
        (event, new_config) => {
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
    );

    ipcMain.handle(
        "LiteLoader.plugins_marketplace.install",
        async (event, info) => {
            // // 下载插件并解压
            // const url = `https://codeload.github.com/${info.repo}/zip/refs/heads/${info.branch}`;
            // const request = https.get(url);

            // request.on("response", response => {
            //     const chunks = [];
            //     response.on("data", chunk => chunks.push(chunk));
            //     response.on("end", () => console.log(Buffer.concat(chunks)));
            // });
        }
    );
}


// 这两个函数都是可选的
module.exports = {
    onLoad
}