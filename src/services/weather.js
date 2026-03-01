const WMO_ICONS = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  77: "🌨️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

const WMO_DESC = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Freezing Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  56: "Freezing Drizzle",
  57: "Heavy Freezing Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Heavy Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Light Showers",
  81: "Showers",
  82: "Heavy Showers",
  85: "Light Snow Showers",
  86: "Heavy Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ Hail",
  99: "Severe Thunderstorm",
};

function wmoIcon(code) {
  return WMO_ICONS[code] || "🌡️";
}

function wmoDesc(code) {
  return WMO_DESC[code] || "Unknown";
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function fetchWeather(lat, lng, units = "fahrenheit") {
  const tempUnit = units === "fahrenheit" ? "fahrenheit" : "celsius";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,weathercode,precipitation_probability` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
    `&current=temperature_2m,weathercode` +
    `&temperature_unit=${tempUnit}` +
    `&timezone=auto&forecast_days=5`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const data = await res.json();

  const nowHour = new Date().getHours();
  const hourly = [];
  for (let i = 0; i < Math.min(8, data.hourly.time.length); i++) {
    const hDate = new Date(data.hourly.time[nowHour + i]);
    const hHour = hDate.getHours();
    const label =
      i === 0
        ? "Now"
        : hHour === 0
          ? "12AM"
          : hHour < 12
            ? `${hHour}AM`
            : hHour === 12
              ? "12PM"
              : `${hHour - 12}PM`;
    hourly.push({
      h: label,
      t: Math.round(data.hourly.temperature_2m[nowHour + i]),
      i: wmoIcon(data.hourly.weathercode[nowHour + i]),
      p: data.hourly.precipitation_probability[nowHour + i] || 0,
    });
  }

  const daily = data.daily.time.map((d, i) => {
    const date = new Date(d + "T12:00:00");
    return {
      d: i === 0 ? "Today" : DAYS[date.getDay()],
      hi: Math.round(data.daily.temperature_2m_max[i]),
      lo: Math.round(data.daily.temperature_2m_min[i]),
      i: wmoIcon(data.daily.weathercode[i]),
    };
  });

  const current = {
    temp: Math.round(data.current.temperature_2m),
    icon: wmoIcon(data.current.weathercode),
    desc: wmoDesc(data.current.weathercode),
    hi: daily[0]?.hi,
    lo: daily[0]?.lo,
  };

  return { hourly, daily, current };
}

async function getLocationFromIP() {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("IP geolocation failed");
  const data = await res.json();
  if (data.latitude && data.longitude) {
    return { lat: data.latitude, lng: data.longitude };
  }
  throw new Error("IP geolocation returned no coordinates");
}

export async function getLocationCoords() {
  // Try browser geolocation first, fall back to IP-based
  try {
    const coords = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { timeout: 5000 },
      );
    });
    return coords;
  } catch {
    return getLocationFromIP();
  }
}
