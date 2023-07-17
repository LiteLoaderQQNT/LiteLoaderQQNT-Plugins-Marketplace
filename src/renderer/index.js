// 插件本体的路径
const plugin_path = LiteLoader.plugins.plugins_marketplace.path;


// 导入工具函数
const utils = await import(`file://${plugin_path.plugin}/src/renderer/utils.js`);


// 获取配置文件
const config = await plugins_marketplace.getConfig();


// 创建一个类型映射
const type_map = new Map();
type_map.set("core", "核心");
type_map.set("extension", "扩展");
type_map.set("theme", "主题");
type_map.set("framew", "依赖");

const platform_map = new Map();
platform_map.set("win32", "Windows");
platform_map.set("linux", "Linux");
platform_map.set("darwin", "MacOS");


// 自定义事件
const list_ctl_event_target = new EventTarget();
const list_ctl_previous_page_event = new CustomEvent("previousPage");
const list_ctl_next_page_event = new CustomEvent("nextPage");
const list_ctl_random_event = new CustomEvent("random");
const list_ctl_sequence_event = new CustomEvent("sequence");
const list_ctl_forward_event = new CustomEvent("forward");
const list_ctl_reverse_event = new CustomEvent("reverse");

const list_tips_event_target = new EventTarget();
const list_tips_offline_event = new CustomEvent("offline");
const list_tips_loading_event = new CustomEvent("loading");
const list_tips_error_event = new CustomEvent("error");
const list_tips_end_event = new CustomEvent("end");


// 一个插件列表-插件条目生成函数
function createPluginItem(manifest, details, install, uninstall, update, restart) {
    const temp = `
    <div class="wrap">
        <div class="vertical-list-item">
            <img src="${manifest?.thumbnail ?? ""}" class="thumbnail">
            <div class="info">
                <h2 class="name">${manifest.name}</h2>
                <p class="secondary-text description">${manifest.description}</p>
            </div>
            <div class="ops-btns">
                <button class="q-button q-button--small q-button--secondary details">详情</button>
                <button class="q-button q-button--small q-button--secondary install">安装</button>
                <button class="q-button q-button--small q-button--secondary uninstall">卸载</button>
                <button class="q-button q-button--small q-button--secondary update">更新</button>
                <button class="q-button q-button--small q-button--secondary restart">重启</button>
            </div>
        </div>
        <hr class="horizontal-dividing-line" />
        <div class="vertical-list-item">
            <p class="secondary-text extra-information">
                <span>类型：${type_map.get(manifest.type)}</span>
                <span>平台：${manifest?.platform?.map(platform => platform_map.get(platform).toString())}</span>
                <span>版本：${manifest.version}</span>
                <span>开发：
                    <a href="${manifest.author[0].link}" target="_blank">${manifest.author[0].name}</a>
                </span>
            </p>
        </div>
    </div>
    `;
    const doc = new DOMParser().parseFromString(temp, "text/html");

    // 获取按钮
    const details_btn = doc.querySelector(".details");
    const install_btn = doc.querySelector(".install");
    const uninstall_btn = doc.querySelector(".uninstall");
    const update_btn = doc.querySelector(".update");
    const restart_btn = doc.querySelector(".restart");

    // 初始化按钮功能
    details_btn.addEventListener("click", details);
    install_btn.addEventListener("click", install);
    uninstall_btn.addEventListener("click", uninstall);
    update_btn.addEventListener("click", update);
    restart_btn.addEventListener("click", restart);

    // 获取插件状态
    const local_version = LiteLoader.plugins[manifest.slug]?.manifest?.version ?? "";
    const remote_version = manifest.version;
    const is_installed = manifest.slug in LiteLoader.plugins;
    const is_updated = !utils.compareVersion(local_version, remote_version);

    // 初始化按钮显示
    install_btn.classList.toggle("hidden", is_installed);
    uninstall_btn.classList.toggle("hidden", !(is_installed && is_updated));
    update_btn.classList.toggle("hidden", !(is_installed && !is_updated));
    restart_btn.classList.toggle("hidden", true);

    return doc.querySelector(".wrap");
}


// 合并插件源为新列表
async function mergeMirrorlist(mirrorlist) {
    const mirrorlist_set = new Set();

    // 同时请求多个源的列表，并按照顺序返回
    const requests = mirrorlist.map(url => fetch(url));
    const responses = await Promise.allSettled(requests);

    // 处理多个仓库源
    for (const response of responses) {
        // 将每个源的列表整合到一个列表中
        if (response.status == "fulfilled") {
            const list = await response.value.json();
            list.forEach(item => mirrorlist_set.add(JSON.stringify(item)));
        }
    }

    // 转换为数组返回
    return Array.from(mirrorlist_set, item => JSON.parse(item));
}


// 获取manifest并合并为列表返回
async function getManifestList(mirrorlist) {
    const plugins_list = [];

    // 同时请求多个源的列表，并按照顺序返回
    const requests = mirrorlist.map(info => {
        const url = `https://raw.githubusercontent.com/${info.repo}/${info.branch}/manifest.json`;
        return fetch(url);
    });
    const responses = await Promise.allSettled(requests);

    // 处理manifest列表
    for (const response of responses) {
        if (response.status == "fulfilled") {
            const manifest = await response.value.json();
            plugins_list.push(manifest);
        }
    }

    return plugins_list;
}


// 给插件列表添加内容
function getPluginListContentFragment(manifest_list) {
    const fragment = document.createDocumentFragment();
    for (const manifest of manifest_list) {
        const plugin_item = createPluginItem(
            manifest,
            // 详情
            async () => open(`https://github.com/${manifest.repository.repo}/tree/${manifest.repository.branch}`),
            // 安装
            async event => {
                event.target.disabled = true;
                const status_is_ok = await plugins_marketplace.install(manifest.repository);
                if (status_is_ok) {
                    event.target.classList.toggle("hidden", true);
                    const parentNode = event.target.parentNode;
                    parentNode.querySelector(".restart").classList.remove("hidden");
                }
                event.target.disabled = false;
            },
            // 卸载
            async event => {
                event.target.disabled = true;
                const status_is_ok = await plugins_marketplace.uninstall(manifest.slug);
                if (status_is_ok) {
                    event.target.classList.toggle("hidden", true);
                    const parentNode = event.target.parentNode;
                    parentNode.querySelector(".restart").classList.remove("hidden");
                }
                event.target.disabled = false;
            },
            // 更新
            async event => {
                event.target.disabled = true;
                const status_is_ok = await plugins_marketplace.update(manifest.repository, manifest.slug);
                if (status_is_ok) {
                    event.target.classList.toggle("hidden", true);
                    const parentNode = event.target.parentNode;
                    parentNode.querySelector(".restart").classList.remove("hidden");
                }
                event.target.disabled = false;
            },
            // 重启
            async event => {
                event.target.disabled = true;
                await plugins_marketplace.restart();
            }
        );
        fragment.appendChild(plugin_item);
    }
    return fragment;
}


// 初始化列表控制区域
async function initListCtl(list_ctl, plugin_list) {
    // 搜索框
    const search_input = list_ctl.querySelector(".search-input");
    search_input.addEventListener("change", event => {

    });


    // 高级选项
    const adv_ops_btn = list_ctl.querySelector(".adv-ops-btn");
    const adv_ops_list = list_ctl.querySelector(".adv-ops-list");
    adv_ops_btn.addEventListener("click", () => {
        const icon = adv_ops_btn.querySelector(".icon");
        icon.classList.toggle("is-fold");
        adv_ops_btn.classList.toggle("is-active");
        adv_ops_list.classList.toggle("hidden");
    });


    // 选择框按钮
    const all_pulldown_menu_button = list_ctl.querySelectorAll(".q-pulldown-menu-button");
    for (const pulldown_menu_button of all_pulldown_menu_button) {
        pulldown_menu_button.addEventListener("click", event => {
            const context_menu = event.currentTarget.nextElementSibling;
            context_menu.classList.toggle("hidden");
        });
    }

    addEventListener("pointerup", event => {
        if (event.target.closest(".q-pulldown-menu-button")) {
            return
        }
        if (!event.target.closest(".q-context-menu")) {
            const all_context_menu = list_ctl.querySelectorAll(".q-context-menu");
            for (const context_menu of all_context_menu) {
                context_menu.classList.add("hidden");
            }
        }
    });


    // 选择框
    const pulldown_menus = list_ctl.querySelectorAll(".q-pulldown-menu");
    for (const pulldown_menu of pulldown_menus) {
        const content = pulldown_menu.querySelector(".q-pulldown-menu-button .content");
        const pulldown_menu_list = pulldown_menu.querySelector(".q-pulldown-menu-list");
        const pulldown_menu_list_items = pulldown_menu_list.querySelectorAll(".q-pulldown-menu-list-item");

        // 初始化选择框按钮显示内容
        const setValueAndAddSelectedClass = (value) => {
            const name = pulldown_menu.querySelector(`[data-value="${value}"] .content`);
            name.parentNode.classList.add("selected");
            content.value = name.textContent;
        };

        switch (pulldown_menu.dataset.id) {
            case "plugin_type_1": {
                const value = config.plugin_type[0];
                setValueAndAddSelectedClass(value);
            } break;
            case "plugin_type_2": {
                const value = config.plugin_type[1];
                setValueAndAddSelectedClass(value);
            } break;
            case "sort_order_1": {
                const value = config.sort_order[0];
                setValueAndAddSelectedClass(value);
                plugin_list.classList.add(value);
            } break;
            case "sort_order_2": {
                const value = config.sort_order[1];
                setValueAndAddSelectedClass(value);
                plugin_list.classList.add(value);
            } break;
            case "list_style_1": {
                const value = config.list_style[0];
                setValueAndAddSelectedClass(value);
                plugin_list.classList.add(value);
            } break;
            case "list_style_2": {
                const value = config.list_style[1];
                setValueAndAddSelectedClass(value);
                plugin_list.classList.add(value);
            } break;
        }

        // 选择框条目点击
        pulldown_menu_list.addEventListener("click", async event => {
            const target = event.target.closest(".q-pulldown-menu-list-item");
            if (target && !target.classList.contains("selected")) {
                //下拉框菜单点击后，先隐藏下拉框本身
                const all_context_menu = list_ctl.querySelectorAll(".q-context-menu");
                for (const context_menu of all_context_menu) {
                    context_menu.classList.add("hidden");
                }

                // 移除所有条目的选择状态
                for (const pulldown_menu_list_item of pulldown_menu_list_items) {
                    pulldown_menu_list_item.classList.remove("selected");
                }

                // 添加选择状态
                target.classList.add("selected");

                // 获取选中的选项文本
                const text_content = target.querySelector(".content").textContent;
                content.value = text_content;

                const item_value = target.dataset.value;

                // 判断是哪个选择框的，单独设置
                switch (pulldown_menu.dataset.id) {
                    // 插件类型
                    case "plugin_type_1":
                        config.plugin_type = [item_value, config["plugin_type"][1]];
                        break;
                    case "plugin_type_2":
                        config.plugin_type = [config["plugin_type"][0], item_value];
                        break;
                    // 排序顺序
                    case "sort_order_1":
                        config.sort_order = [item_value, config["sort_order"][1]];
                        plugin_list.classList.remove("random", "sequence");
                        plugin_list.classList.add(item_value);
                        if (item_value == "random") {
                            list_ctl_event_target.dispatchEvent(list_ctl_random_event);
                        }
                        if (item_value == "sequence") {
                            list_ctl_event_target.dispatchEvent(list_ctl_sequence_event);
                        }
                        break;
                    case "sort_order_2":
                        config.sort_order = [config["sort_order"][0], item_value];
                        plugin_list.classList.remove("forward", "reverse");
                        plugin_list.classList.add(item_value);
                        if (item_value == "forward") {
                            list_ctl_event_target.dispatchEvent(list_ctl_forward_event);
                        }
                        if (item_value == "reverse") {
                            list_ctl_event_target.dispatchEvent(list_ctl_reverse_event);
                        }
                        break;
                    // 列表样式
                    case "list_style_1":
                        config.list_style = [item_value, config["list_style"][1]];
                        plugin_list.classList.remove("single", "double");
                        plugin_list.classList.add(item_value);
                        break;
                    case "list_style_2":
                        config.list_style = [config["list_style"][0], item_value];
                        plugin_list.classList.remove("loose", "compact");
                        plugin_list.classList.add(item_value);
                        break;
                }

                // 保存配置文件
                await plugins_marketplace.setConfig(config);
            }
        });
    }


    // 页码指标，上一页，下一页
    const current_page_text = list_ctl.querySelector(".current-page");
    const total_page_text = list_ctl.querySelector(".total-page");

    const previous_page_btn = list_ctl.querySelector(".previous-page");
    const next_page_btn = list_ctl.querySelector(".next-page");

    current_page_text.textContent = 0;
    total_page_text.textContent = 0;

    previous_page_btn.addEventListener("click", () => {
        const content = current_page_text.textContent;
        if (parseInt(content) > 1) {
            current_page_text.textContent = parseInt(content) - 1;
            list_ctl_event_target.dispatchEvent(list_ctl_previous_page_event);
        }
    });
    next_page_btn.addEventListener("click", () => {
        const content = current_page_text.textContent;
        if (parseInt(content) < parseInt(total_page_text.textContent)) {
            current_page_text.textContent = parseInt(content) + 1;
            list_ctl_event_target.dispatchEvent(list_ctl_next_page_event);
        }
    });
}


// 初始化列表提示区域
async function initListTips(list_tips) {
    const offline_tips = list_tips.querySelector(".offline");
    const loading_tips = list_tips.querySelector(".loading");
    const error_tips = list_tips.querySelector(".error");
    const end_tips = list_tips.querySelector(".end");

    list_tips_event_target.addEventListener("offline", () => {
        offline_tips.classList.remove("hidden");
    });

    list_tips_event_target.addEventListener("loading", () => {
        loading_tips.classList.remove("hidden");
    });

    list_tips_event_target.addEventListener("error", () => {
        loading_tips.classList.add("hidden");
        error_tips.classList.remove("hidden");
    });

    list_tips_event_target.addEventListener("end", () => {
        loading_tips.classList.add("hidden");
        end_tips.classList.remove("hidden");
    });
}


// 初始化插件列表区域
async function initPluginList(plugin_list, list_ctl) {
    // 无网络先显示检查网络的tips
    if (!(await plugins_marketplace.isOnline())) {
        list_tips_event_target.dispatchEvent(list_tips_offline_event);
        return;
    }
    // 有网络先显示正在加载的tips
    else {
        list_tips_event_target.dispatchEvent(list_tips_loading_event);
    }

    try {
        const mirrorlist = await mergeMirrorlist(config.mirrorlist);
        let mirrorlist_chunks = utils.groupArrayElements(mirrorlist, 10);

        // 初始化界面
        const current_page_text = list_ctl.querySelector(".current-page");
        const total_page_text = list_ctl.querySelector(".total-page");
        current_page_text.textContent = mirrorlist_chunks.length > 0 ? 1 : 0;
        total_page_text.textContent = mirrorlist_chunks.length;


        // 切换页面
        const switchPage = async () => {
            list_tips_event_target.dispatchEvent(list_tips_loading_event);
            const current_page = parseInt(current_page_text.textContent) - 1;
            const manifest_list = await getManifestList(mirrorlist_chunks[current_page]);
            const fragment = getPluginListContentFragment(manifest_list);
            plugin_list.innerHTML = "";
            plugin_list.appendChild(fragment);
            list_tips_event_target.dispatchEvent(list_tips_end_event);
        }

        // 触发上一页与下一页
        list_ctl_event_target.addEventListener("previousPage", switchPage);
        list_ctl_event_target.addEventListener("nextPage", switchPage);


        // 列表排序
        const triggerSortEvent = () => {
            let sorted_list = [];

            if (plugin_list.classList.contains("random")) {
                sorted_list = utils.shuffleList(mirrorlist);
            }
            else if (plugin_list.classList.contains("sequence")) {
                sorted_list = [...mirrorlist];
            }

            if (plugin_list.classList.contains("reverse")) {
                sorted_list.reverse();
            }

            mirrorlist_chunks = utils.groupArrayElements(sorted_list, 10);
            switchPage();
        }

        list_ctl_event_target.addEventListener("random", triggerSortEvent);
        list_ctl_event_target.addEventListener("sequence", triggerSortEvent);
        list_ctl_event_target.addEventListener("forward", triggerSortEvent);
        list_ctl_event_target.addEventListener("reverse", triggerSortEvent);

        // 初始化
        triggerSortEvent();
    }
    // 加载报错显示对应tips
    catch (error) {
        list_tips_event_target.dispatchEvent(list_tips_error_event);
    }
}


// 配置界面
export async function onConfigView(view) {
    // CSS
    const css_file_path = `file://${plugin_path.plugin}/src/renderer/style.css`;
    const link_element = document.createElement("link");
    link_element.rel = "stylesheet";
    link_element.href = css_file_path;
    document.head.appendChild(link_element);

    // HTMl
    const html_file_path = `file://${plugin_path.plugin}/src/renderer/view.html`;
    const html_text = await (await fetch(html_file_path)).text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html_text, "text/html");
    doc.querySelectorAll("section").forEach(node => view.appendChild(node));

    // 初始化
    const list_ctl = view.querySelector(".list-ctl");
    const list_tips = view.querySelector(".list-tips");
    const plugin_list = view.querySelector(".plugin-list");
    await initListCtl(list_ctl, plugin_list);
    await initListTips(list_tips);
    await initPluginList(plugin_list, list_ctl);
}