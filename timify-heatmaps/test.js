// this can go when running in a browser
const fetch = require("node-fetch");

const timify_base_url = "https://api.timify.com/v1";
const timify_auth_path = "auth/token";

// app credentials
const app_id = "6076ede9c017fc117103bfbd";
const app_secret = "a4aa1715-b320-488e-a341-a10c9e240e50";

// enterprise data
const enterprise_id = "5fe088b075be2d11bd18a578"

const timify_auth_url = timify_base_url + "/" + timify_auth_path + "?" + "appid=" + app_id + "&appsecret=" + app_secret;

const getAccessToken = async () => {
    try {
        const response = await fetch(timify_auth_url);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("there has been a problem with the retrieval of the access token: ", error.message);
        throw error;
    }
};

const headers = (method, accessToken) => {
    return {
        "method": method,
        "headers": {
            "Accept": "application/json",
            "Content-Type": "application/json",
            authorization: accessToken,
        },
    };
};

const getCompanies = async (enterprise_id, accessToken) => {
    try {
        const timify_companies_path = "companies";
        const timify_companies_url = timify_base_url + "/" + timify_companies_path + "?" + "enterprise_id=" + enterprise_id;
        const options = headers("GET", accessToken);
        const response = await fetch(timify_companies_url, options);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("there has been a problem with the retrieval of the companies information: ", error.message);
        throw error;
    }
};

const postFootfallMapping = async (id, accessToken, footfallMapping) => {
    try {
        const timify_companies_settings_path = `companies/${id}/settings`;
        const timify_companies_settings_url = timify_base_url + "/" + timify_companies_settings_path;
        let options = headers("POST", accessToken);
        options.body = JSON.stringify({
            "footfall_mapping": footfallMapping,
        });
        const response = await fetch(timify_companies_settings_url, options);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("there has been a problem with the posting of footfall mappings: ", error.message);
        throw error;
    }
};

function padN(num, length) {
    return String(num).padStart(length, "0");
}

function convertToDwhConvention(externalId, enterpriseName) {
    switch (enterpriseName) {
        case "eyes + more Österreich":
            return "EA" + padN(externalId, 4);
        case "eyes + more Deutschland":
            return "EG" + padN(externalId, 4);
        case "eyes + more België":
            return "EB" + padN(externalId, 4);
        case "eyes + more Nederland":
            return "EN" + padN(externalId, 4);;
        default:
            return externalId;
    }    
}

const lookupCompanyData = (data, columns, externalId, enterpriseName) => {
    const store = convertToDwhConvention(externalId, enterpriseName);
    columnIndexStore = columns.find(column => column.title.toUpperCase().startsWith("STORE"));
    columnIndexHour = columns.find(column => column.title.toUpperCase().indexOf("HOUR") );
    columnIndexHeatmap = columns.find(column => column.title.toUpperCase().matches("HEATMAP.*NAME"));
    
};

getAccessToken(timify_auth_url).then((response) => {
    console.debug(response);
    const accessToken = response.accessToken;
    getCompanies(enterprise_id, accessToken).then((response) => {
        response.data.array.forEach((company, index, arrays) => {
            intervals = lookupCompanyData(data, columns, company.externalId, company.enterprise.name);
            // get footfallMapping for company external id
            // intervals: [{ "footfall": "GREEN", "begin": "09:00", "end": "17:00" }]
            if (intervals.found) {
                footfallMapping = [
                        { "isActive": true, "intervals": intervals.monday },
                        { "isActive": true, "intervals": intervals.tuesday },
                        { "isActive": true, "intervals": intervals.wednesday },
                        { "isActive": true, "intervals": intervals.thursday },
                        { "isActive": true, "intervals": intervals.friday },
                        { "isActive": true, "intervals": intervals.saturday },
                        { "isActive": true, "intervals": intervals.sunday }
                ];
                postFootfallMapping(company.id, accessToken, footfallMapping).then((response) => {
                    console.log(response);
                });                
            }
        });
    });
});
