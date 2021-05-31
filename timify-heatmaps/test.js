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
    columnIndexDay = columns.find(column => column.title.toUpperCase().indexOf("DAYOFWEEK"));
    columnIndexHour = columns.find(column => column.title.toUpperCase().indexOf("HOUR"));
    columnIndexHeatmap = columns.find(column => column.title.toUpperCase().matches("HEATMAP.*NAME"));

    // create empty intervals for the store
    let intervals = {
        "found": false,
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": [],
    };

    if (store in data) {
        // go through the data rows of a store
        data[store].rows.forEach((row, index) => {
            const day = row[columnIndexDay];
            const hour = row[columnIndexHour];
            const heatmap = row[columnIndexHeatmap];
            // create an interval record
            const intervalValue = { "begin": padN(hour, 2), "end": padN(hour + 1, 2), "footfall": heatmap };
            // depending on the day of the week, append the interval record to the right day array
            switch (parseInt(day)) {
                case 1:
                    intervals.monday.push(intervalValue);
                    break;
                case 2:
                    intervals.tuesday.push(intervalValue);
                    break;
                case 3:
                    intervals.wednesday.push(intervalValue);
                    break;
                case 4:
                    intervals.thursday.push(intervalValue);
                    break;
                case 5:
                    intervals.friday.push(intervalValue);
                    break;
                case 6:
                    intervals.saturday.push(intervalValue);
                    break;
                case 7:
                    intervals.sunday.push(intervalValue);
                    break;
                default:
                    throw new Error("invalid day of week received in data");
            }
        });
        // signal we actually found a store
        intervals.found = true;
    }
    return intervals;
};

let storeHash = {};

function convertDataToStoreHash(data, columns) {
    columnIndexStore = columns.find(column => column.title.toUpperCase().startsWith("STORE"));
    storeHash = {};
    data.forEach((row, index) => {
        const store = row[columnIndexStore];
        if (!(store in storeHash)) {
            storeHash[store] = { "rows": [] };
        }
        storeHash[store].rows.push(row);
    });
}

function sendToTimify(data, columns) {
    const storeData = convertDataToStoreHash(data, columns);
    getAccessToken(timify_auth_url).then((response) => {
        console.debug(response);
        const accessToken = response.accessToken;
        getCompanies(enterprise_id, accessToken).then((response) => {
            response.data.array.forEach((company, index, arrays) => {
                intervals = lookupCompanyData(storeData, columns, company.externalId, company.enterprise.name);
                // get footfallMapping for company external id
                // intervals: [{ "footfall": "GREEN", "begin": "09:00", "end": "17:00" }]
                if (intervals.found) {
                    footfallMapping = [
                            { "isActive": (intervals.monday.lenght == 0 ?    false : true), "intervals": intervals.monday },
                            { "isActive": (intervals.tuesday.lenght == 0 ?   false : true), "intervals": intervals.tuesday },
                            { "isActive": (intervals.wednesday.lenght == 0 ? false : true), "intervals": intervals.wednesday },
                            { "isActive": (intervals.thursday.lenght == 0 ?  false : true), "intervals": intervals.thursday },
                            { "isActive": (intervals.friday.lenght == 0 ?    false : true), "intervals": intervals.friday },
                            { "isActive": (intervals.saturday.lenght == 0 ?  false : true), "intervals": intervals.saturday },
                            { "isActive": (intervals.sunday.lenght == 0 ?    false : true), "intervals": intervals.sunday }
                    ];
                    postFootfallMapping(company.id, accessToken, footfallMapping).then((response) => {
                        console.log(response);
                    });                
                }
            });
        });
    });   
}
