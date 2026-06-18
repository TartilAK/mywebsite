const API_KEY = "826a2f6dd825637a0e51a6ae5ad8f5a2";
const AQI_TOKEN = "8c7abbc9a29e9314f58db6e38265601b1940db99";
const TOMTOM_KEY = "DtoqwLqfOSGjzgfghg2kw2DwHg9tN2cc";
let transportLoaded = false;
let transportMarkers = [];

const map = L.map("map").setView([13.7563, 100.5018], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
}).addTo(map);

let userMarker = null;
let accuracyCircle = null;

const transportLayer = L.layerGroup().addTo(map);

let traffic = 40;

// =====================
// TRAFFIC
// =====================

async function updateTraffic() {

    try {

        const lat = 13.7563;
        const lon = 100.5018;

        const url =
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_KEY}&point=${lat},${lon}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.flowSegmentData)
            throw new Error("ไม่พบข้อมูล");

        const current = data.flowSegmentData.currentSpeed;
        const free = data.flowSegmentData.freeFlowSpeed;

        traffic = Math.round(
            100 - ((current / free) * 100)
        );

        document.getElementById("trafficLevel").innerHTML = `
            🚦 ${traffic}%<br>
            🚗 ${current} km/h
        `;

    } catch (e) {

        console.error(e);

        document.getElementById("trafficLevel").innerHTML =
        "โหลดข้อมูลจราจรไม่ได้";

    }

}

// =====================
// WEATHER
// =====================

async function loadWeather(lat, lon) {
    try {

        const url =
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=th`;

        const response = await fetch(url);
        const data = await response.json();

        document.getElementById("weather").innerHTML = `
            🌡 ${data.main.temp} °C<br>
            ☁ ${data.weather[0].description}<br>
            💧 ${data.main.humidity}%<br>
            💨 ${data.wind.speed} m/s
        `;

    } catch {

        document.getElementById("weather").innerHTML =
        "โหลดข้อมูลไม่ได้";

    }

}

// =====================
// AQI
// =====================

async function loadAQI(lat, lon) {
    try {

        const url =
        `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQI_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== "ok") {

            document.getElementById("aqiValue").innerHTML =
            "ไม่พบข้อมูล";

            return;
        }

        const aqi = data.data.aqi;

        let color = "green";
        let level = "ดี";

        if (aqi > 50) {
            color = "orange";
            level = "ปานกลาง";
        }

        if (aqi > 100) {
            color = "red";
            level = "เริ่มมีผลต่อสุขภาพ";
        }

        if (aqi > 150) {
            color = "purple";
            level = "อันตราย";
        }

        document.getElementById("aqiValue").innerHTML = `
            <span style="font-size:24px;color:${color}">
                ${aqi}
            </span>
            <br>${level}
        `;

    } catch (e) {

        console.error(e);

        document.getElementById("aqiValue").innerHTML =
        "โหลด AQI ไม่ได้";

    }

}

// =====================
// TRANSPORT POINTS
// =====================

async function loadTransportPoints(lat, lon) {

    const query = `
[out:json][timeout:25];
(
  node["highway"="bus_stop"](around:3000,${lat},${lon});
  node["amenity"="bus_station"](around:3000,${lat},${lon});

  node["railway"="station"](around:5000,${lat},${lon});
  node["railway"="halt"](around:5000,${lat},${lon});

  node["station"="subway"](around:5000,${lat},${lon});

  node["amenity"="taxi"](around:3000,${lat},${lon});

  node["amenity"="bicycle_rental"](around:3000,${lat},${lon});
);
out body;
`;

    try {

        const url =
        "https://overpass-api.de/api/interpreter?data=" +
        encodeURIComponent(query);

        const response = await fetch(url);
        const data = await response.json();

        data.elements.forEach(point => {

            const id = point.id;

            if (transportMarkers.includes(id))
                return;

            transportMarkers.push(id);

            let icon = "📍";

            if (point.tags?.highway === "bus_stop")
                icon = "🚌";

            else if (point.tags?.amenity === "bus_station")
                icon = "🚏";

            else if (point.tags?.railway === "station")
                icon = "🚆";

            else if (point.tags?.station === "subway")
                icon = "🚇";

            else if (point.tags?.amenity === "taxi")
                icon = "🚕";

            else if (point.tags?.amenity === "bicycle_rental")
                icon = "🚲";

            L.marker([point.lat, point.lon])
                .addTo(transportLayer)
                .bindPopup(`
                    <b>${icon}</b><br>
                    ${point.tags?.name || "ไม่ระบุชื่อ"}
                `);

        });

    } catch (err) {

        console.error("Transport Error:", err);

    }

}

// =====================
// USER LOCATION
// =====================
function refreshEnvironment(lat, lon){
    loadWeather(lat, lon);
    loadAQI(lat, lon);
}
navigator.geolocation.watchPosition(

    function(position) {

const lat = position.coords.latitude;
const lon = position.coords.longitude;
const accuracy = position.coords.accuracy;

refreshEnvironment(lat, lon);

if(!window.firstLoad){

    setInterval(()=>{

    if(userMarker){

        const pos = userMarker.getLatLng();

        refreshEnvironment(
            pos.lat,
            pos.lng
        );

    }

},300000);

    window.firstLoad = true;
}

if (!transportLoaded) {
    loadTransportPoints(lat, lon);
    transportLoaded = true;
}
        if (!userMarker) {

        userMarker = L.circleMarker(
    [lat, lon],
    {
        radius: 8,
        weight: 2
    }
)
.addTo(map)
.bindPopup("📍 คุณอยู่ที่นี่");

            accuracyCircle = L.circle([lat, lon], {
                radius: accuracy,
                color: "blue",
                fillColor: "#30a3ff",
                fillOpacity: 0.2
            }).addTo(map);

            map.setView([lat, lon], 15);

        } else {

            userMarker.setLatLng([lat, lon]);

            accuracyCircle.setLatLng([lat, lon]);
            accuracyCircle.setRadius(accuracy);

        }

    },

    function() {

        document.getElementById("weather").innerHTML =
        "ไม่สามารถระบุตำแหน่ง";

        document.getElementById("aqiValue").innerHTML =
        "ไม่สามารถระบุตำแหน่ง";

    },

    {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    }

);

// =====================
// BUTTON LOCATION
// =====================

document.getElementById("myLocationBtn")
.addEventListener("click", () => {

    if (!userMarker) return;

    map.flyTo(
        userMarker.getLatLng(),
        17,
        {
            animate: true,
            duration: 2
        }
    );

    userMarker.openPopup();

});

// =====================
// CHART
// =====================

const chart = new Chart(
    document.getElementById("trafficChart"),
    {
        type: "line",
        data: {
            labels: ["Start"],
            datasets: [{
                label: "Traffic",
                data: [40],
                borderWidth: 3
            }]
        }
    }
);

function updateChart() {

    chart.data.labels.push(
        new Date().toLocaleTimeString()
    );

    chart.data.datasets[0].data.push(traffic);

    if (chart.data.labels.length > 12) {

        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();

    }

    chart.update();

}

// =====================
// CLOCK
// =====================

setInterval(() => {

    document.getElementById("clock").innerHTML =
    new Date().toLocaleString("th-TH");

}, 1000);

// =====================
// AUTO UPDATE
// =====================

updateTraffic();

setInterval(updateTraffic, 60000);
setInterval(updateChart, 2500);