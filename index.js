// Load ST Core and extension settings
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Extension data
const extensionName = "atmosphere";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {
    token: "",              // api token from https://www.weatherapi.com/
    location: "",           // location, see https://www.weatherapi.com/docs/#intro-request-param
    metric: false,          // false is metric, true is imperial (default true/imperial)
    cache_lifetime: 15,     // stored as minutes, recommend fairly high value
};

async function loadSettings() {
    extensionSettings = extensionSettings || {};
    if (Object.keys(extensionSettings).length === 0) {
        Object.assign(extensionSettings, defaultSettings);
    }

    $("#atmosphere_token").val(extensionSettings.token);
    $("#atmosphere_location").val(extensionSettings.location);
    $("#atmosphere_metric").prop("checked", extensionSettings.metric);
    $("#atmosphere_cache_lifetime").val(extensionSettings.cache_lifetime);
}

function onSettingUpdateToken(event) {
    const value = String($(event.target).val());
    extensionSettings.token = value.trim();
    saveSettingsDebounced();
}

function onSettingUpdateLocation(event) {
    const value = String($(event.target).val());
    extensionSettings.location = value.trim();
    toastr.info(`Location updated to ${value.trim()}!`);
    console.log(`[Atmosphere] Location updated to ${value.trim()}!`)
    saveSettingsDebounced();
}

function onSettingUpdateUnit(event) {
    const value = Boolean($(event.target).prop("checked"));
    extensionSettings.metric = value;
    saveSettingsDebounced();
}

function onSettingUpdateCacheLifetime(event) {
    const value = String($(event.target).val());
    extensionSettings.cache_lifetime = value;
    saveSettingsDebounced();
}

// actual weather api work happens here
async function fetchWeather() {
    toastr.info("Fetch weather function was called!");
    const request = await fetch(`https://api.weatherapi.com/v1/current.json?key=${extensionSettings.token}&q=${extensionSettings.location}&aqi=no`)
    const response = await request.json();
    console.log("[Atmosphere] fetched weather:", response)
    toastr.info("Fetch weather function should be logged to console!");
}

// Extension initialization
jQuery(async () => {
    console.log("[Atmosphere] loading...");
   
    try {
        // Load settings panel HTML from file
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
       
        // Append settingsHtml to extensions_settings
        // extension_settings and extensions_settings2 are the left and right columns of the settings menu
        // Left should be extensions that deal with system functions and right should be visual/UI related 
        $("#extensions_settings2").append(settingsHtml);
       
        // Bind setting panel elements to update events
        $("#atmosphere_token").on("input", onSettingUpdateToken);
        $("#atmosphere_location").on("input", onSettingUpdateLocation);
        $("#atmosphere_metric").on("click", onSettingUpdateUnit);
        $("#atmosphere_cache_lifetime").on("input", onSettingUpdateCacheLifetime);

        // Fetch weather button (mostly for debugging)
        $("#atmosphere_fetch_weather").on("click", fetchWeather)
       
        // Load saved settings
        await loadSettings();
       
        console.log("[Atmosphere] loaded");
    } catch (error) {
        console.error("[Atmosphere] failed to load:", error);
    }
});