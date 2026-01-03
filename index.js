// Load ST Core and extension settings
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "atmosphere";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {
    token: "",  // api token from https://www.weatherapi.com/
    location: "",  // location, see https://www.weatherapi.com/docs/#intro-request-param
    metric: false,  // false is metric, true is imperial
    cache_lifetime: 15,  // stored as minutes
};

async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    $("#atmosphere_token").val(extension_settings[extensionName].token);
    $("#atmosphere_location").val(extension_settings[extensionName].location);
    $("#atmosphere_metric").prop("checked", extension_settings[extensionName].metric);
    $("#atmosphere_cache_lifetime").val(extension_settings[extensionName].cache_lifetime);
}

function onTokenChange(event) {
    const value = String($(event.target).val());
    extension_settings[extensionName].token = value;
    saveSettingsDebounced();
}

function onLocationChange(event) {
    const value = String($(event.target).val());
    extension_settings[extensionName].location = value;
    saveSettingsDebounced();
}

function onUnitChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].metric = value;
    saveSettingsDebounced();
}

function onCacheLifetimeChange(event) {
    const value = String($(event.target).val());
    extension_settings[extensionName].cache_lifetime = value;
    saveSettingsDebounced();
}

// Extension initialization
jQuery(async () => {
    console.log(`[${extensionName}] loading...`);
   
    try {
        // Load HTML from file
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
       
        // Append settingsHtml to extensions_settings
        // extension_settings and extensions_settings2 are the left and right columns of the settings menu
        // Left should be extensions that deal with system functions and right should be visual/UI related 
        $("#extensions_settings2").append(settingsHtml);
       
        // Bind events
        $("#atmosphere_token").on("input", onTokenChange);
        $("#atmosphere_location").on("input", onLocationChange);
        $("#atmosphere_metric").on("click", onUnitChange);
        $("#atmosphere_cache_lifetime").on("input", onCacheLifetimeChange);
       
        // Load saved settings
        await loadSettings();
       
        console.log(`[${extensionName}] loaded`);
    } catch (error) {
        console.error(`[${extensionName}] failed to load:`, error);
    }
});