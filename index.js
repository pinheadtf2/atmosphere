// Load ST Core and extension settings
import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
const { registerMacro, unregisterMacro, eventSource, event_types } = SillyTavern.getContext();

// Extension data
const extensionName = "atmosphere";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {
    token: "",              // api token from https://www.weatherapi.com/
    location: "",           // location, see https://www.weatherapi.com/docs/#intro-request-param
    metric: false,          // false is metric, true is imperial (default true/imperial)
    cache_lifetime: 15,     // stored as minutes, recommend fairly high value
    weather_cache: {           // suboptimal
        data: {},
        location: "", 
        timestamp: 0
    },
};

async function loadSettings() {
    extension_settings[extensionName] = {
        ...defaultSettings,
        ...(extension_settings[extensionName] || {})
    };

    $("#atmosphere_token").val(extension_settings[extensionName].token);
    $("#atmosphere_location").val(extension_settings[extensionName].location);
    $("#atmosphere_cache_lifetime").val(extension_settings[extensionName].cache_lifetime);
}

function onSettingUpdateToken(event) {
    const value = String($(event.target).val());
    extension_settings[extensionName].token = value.trim();
    saveSettingsDebounced();
}

function onSettingUpdateLocation(event) {
    const value = String($(event.target).val());
    extension_settings[extensionName].location = value.trim();
    saveSettingsDebounced();
}

function onSettingUpdateCacheLifetime(event) {
    const value = String($(event.target).val());
    extension_settings[extensionName].cache_lifetime = value;
    saveSettingsDebounced();
}

function checkCacheValidity() {
    const extSet = extension_settings[extensionName];
    const now = Date.now();

    if (!extSet.weather_cache.timestamp || !extSet.weather_cache.data || !extSet.weather_cache.location) {
        console.log("[Atmosphere] No cached data available");
        return false;
    }

    if (extSet.weather_cache.location !== extSet.location) {
        console.log("[Atmosphere] Location changed, cache invalid");
        return false;
    }

    const cacheAgeMs = now - extSet.weather_cache.timestamp;
    const cacheAgeMinutes = cacheAgeMs / (1000 * 60);
    const isValid = cacheAgeMinutes < extSet.cache_lifetime;
    
    if (isValid) {
        console.log(`[Atmosphere] Cache valid (${cacheAgeMinutes.toFixed(0)} min old, expires in ${(extSet.cache_lifetime - cacheAgeMinutes).toFixed(0)} min)`);
    } else {
        console.log(`[Atmosphere] Cache expired (${cacheAgeMinutes.toFixed(0)} min old, limit is ${extSet.cache_lifetime} min)`);
    }
    
    return isValid;
}

async function fetchWeather(force_refresh = false) {
    const extSet = extension_settings[extensionName];
    
    if (!force_refresh && checkCacheValidity()) {
        console.log("[Atmosphere] Using cached data");
        return extSet.weather_cache.data;
    }

    try {
        console.log("[Atmosphere] Fetching fresh weather data from API");
        const request = await fetch(`https://api.weatherapi.com/v1/current.json?key=${extSet.token}&q=${extSet.location}&aqi=no`);
        
        if (!request.ok) {
            throw new Error(`[Atmosphere] WeatherAPI request failed with code ${request.status}`);
        }
        
        const response = await request.json();
        if (force_refresh) {
            toastr.success("Fresh weather data fetched!");
        }
        console.log("[Atmosphere] Fetched weather response:", response);
        
        extSet.weather_cache = {
            data: response,
            location: extSet.location,
            timestamp: Date.now()
        };
        
        saveSettingsDebounced();
        return response;
        
    } catch (error) {
        console.error("[Atmosphere] Error fetching weather:", error);
        toastr.error("Failed to fetch weather data, check browser console");
        
        if (extSet.weather_cache.data) {
            console.log("[Atmosphere] Falling back to cached data due to error");
            toastr.warning("Using cached weather data (API error)");
            return extSet.weather_cache.data;
        }
        
        throw error;
    }
}

async function updateMacros(initial_register = false, force_refresh = false) {
    if (checkCacheValidity() && !initial_register) {
        return;
    }

    try {
        const weatherData = await fetchWeather(force_refresh);
        
        if (!weatherData || !weatherData.current || !weatherData.location) {
            console.error("[Atmosphere] Invalid weather data structure");
            return;
        }

        const current = weatherData.current;
        const location = weatherData.location;

        // qol and sanity check
        const registeredMacros = [];

        // register location
        const locstr = `${location["name"]}, ${location["region"]}`;
        if (!initial_register) unregisterMacro("atmo_location");
        registerMacro("atmo_location", locstr);
        registeredMacros.push(`atmo_location (from location.name + location.region) = ${locstr}`);

        // register ready-to-go strings
        const conditionsf = `It is currently ${current["temp_f"]}°F and ${current["condition"]["text"]} in ${locstr}.`;
        if (!initial_register) unregisterMacro("atmo_conditionsf");
        registerMacro("atmo_conditionsf", conditionsf);
        registeredMacros.push(`atmo_conditionsf (from current.temp_f + current.condition.text) = ${conditionsf}`);
        
        const conditionsc = `It is currently ${current["temp_c"]}°C and ${current["condition"]["text"]} in ${locstr}.`;
        if (!initial_register) unregisterMacro("atmo_conditionsc");
        registerMacro("atmo_conditionsc", conditionsc);
        registeredMacros.push(`atmo_conditionsc (from current.temp_c + current.condition.text) = ${conditionsc}`);

        for (const [key, value] of Object.entries(current)) {
            if (key === "condition") {
                // condition is special, we only need to register `text`
                if (!initial_register) unregisterMacro(`atmo_cond_${key}`);
                registerMacro(`atmo_cond_${key}`, value.text);
                registeredMacros.push(`atmo_cond_${key} (from current.${key}.text) = ${value.text}`);
            } else {
                if (!initial_register) unregisterMacro(`atmo_cond_${key}`);
                registerMacro(`atmo_cond_${key}`, String(value));
                registeredMacros.push(`atmo_cond_${key} (from current.${key}) = ${String(value)}`);
            }
        }

        for (const [key, value] of Object.entries(location)) {
            if (!initial_register) unregisterMacro(`atmo_loc_${key}`);
            registerMacro(`atmo_loc_${key}`, String(value));
            registeredMacros.push(`atmo_loc_${key} (from location.${key}) = ${String(value)}`);
        }

        console.log("[Atmosphere] Macros registered:\n" + registeredMacros.join("\n"));
    } catch (error) {
        console.error("[Atmosphere] Failed to update macros:", error);
    }
}

// Extension initialization
jQuery(async () => {
    console.log("[Atmosphere] Extension loading...");
   
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
        $("#atmosphere_cache_lifetime").on("input", onSettingUpdateCacheLifetime);

        // Fetch weather button - force refresh
        $("#atmosphere_fetch_weather").on("click", () => updateMacros(false, true));
       
        // Load saved settings
        await loadSettings();

        console.log("[Atmosphere] Extension loaded");

        if (extension_settings[extensionName].token) {
            console.log("[Atmosphere] Token is filled, trying initial macro registration");
            await updateMacros(true, false);
        }

        eventSource.on(event_types.MESSAGE_SENT, updateMacros);
    } catch (error) {
        console.error("[Atmosphere] failed to load:", error);
    }
});