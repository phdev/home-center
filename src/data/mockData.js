export const CALENDAR = [
  { time: "9:00", title: "Soccer Practice", sub: "Elm Creek Park" },
  { time: "11:30", title: "Piano Lesson — Emma", sub: "Mrs. Chen's Studio" },
  { time: "3:00", title: "Dentist — Jack", sub: "Maple Grove Dental" },
  { time: "6:30", title: "Family Movie Night", sub: "Living Room" },
];

export const HOURLY = [
  { h: "Now", t: 72, i: "\u2600\uFE0F", p: 0 },
  { h: "11AM", t: 74, i: "\u{1F324}\uFE0F", p: 0 },
  { h: "12PM", t: 76, i: "\u{1F324}\uFE0F", p: 5 },
  { h: "1PM", t: 78, i: "\u26C5", p: 10 },
  { h: "2PM", t: 77, i: "\u26C5", p: 15 },
  { h: "3PM", t: 75, i: "\u{1F326}\uFE0F", p: 35 },
  { h: "4PM", t: 73, i: "\u{1F327}\uFE0F", p: 60 },
  { h: "5PM", t: 70, i: "\u{1F327}\uFE0F", p: 55 },
];

export const DAILY = [
  { d: "Today", hi: 78, lo: 62, i: "\u{1F324}\uFE0F" },
  { d: "Mon", hi: 72, lo: 58, i: "\u{1F327}\uFE0F" },
  { d: "Tue", hi: 68, lo: 55, i: "\u26C5" },
  { d: "Wed", hi: 75, lo: 60, i: "\u2600\uFE0F" },
  { d: "Thu", hi: 80, lo: 64, i: "\u2600\uFE0F" },
];

export const PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
    cap: "Mountain hike",
  },
  {
    url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=400&fit=crop",
    cap: "Beach day",
  },
  {
    url: "https://images.unsplash.com/photo-1504208434309-cb69f4fe52b0?w=600&h=400&fit=crop",
    cap: "Birthday party",
  },
  {
    url: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=600&h=400&fit=crop",
    cap: "Italy trip",
  },
];

export const FACTS = [
  { f: "Honey never spoils \u2014 3,000-year-old honey is still edible.", s: "National Geographic" },
  { f: "An octopus has three hearts and blue blood.", s: "Smithsonian" },
  { f: "The Moon drifts 1.5 inches from Earth every year.", s: "NASA" },
  { f: "Lightning is 5\u00D7 hotter than the Sun\u2019s surface.", s: "NOAA" },
  { f: "Some dinosaurs had feathers like parrots.", s: "Nature" },
];

export const BIRTHDAYS = [
  { name: "Grandma Sue", avatar: "\u{1F382}", date: "Mar 5", daysUntil: 8 },
  { name: "Uncle Mike", avatar: "\u{1F389}", date: "Mar 18", daysUntil: 19 },
  { name: "Cousin Lily", avatar: "\u{1F388}", date: "Apr 2", daysUntil: 34 },
];

export const SCHOOL_UPDATES = [
  { label: "DUE TOMORROW", date: "Feb 28", title: "Science Fair Project \u2014 Emma", desc: "Board display due Friday" },
  { label: "EVENT", date: "Mar 4", title: "Spring Book Fair", desc: "Volunteers needed 2\u20134 PM" },
  { label: "HOMEWORK", date: "Mar 3", title: "Math Chapter 7 Test \u2014 Jack", desc: "Study guide attached" },
];

export const TASKS = [
  { title: "Grocery list from recipes", detail: "Scanning meal plan...", status: "active" },
  { title: "Schedule vet appointment", detail: "Checking availability...", status: "active" },
  { title: "Compare flight prices SEA\u2192DEN", detail: "Found 4 options under $250", status: "done" },
];

export const CONVOS = [
  { q: "Recipe for banana pancakes?", a: "Mash 2 bananas, mix with 2 eggs, cinnamon, \u00BD cup oat flour.", who: "Mom", av: "\u{1F469}", ts: "9:15 AM" },
  { q: "How far is Mars?", a: "About 140M miles on average \u2014 a 7-month trip!", who: "Jake", av: "\u{1F466}", ts: "8:02 AM" },
];

export const EVENTS = [];

export const TIMER_PRESETS = [
  { label: "1 min", sec: 60, icon: "\u26A1" },
  { label: "5 min", sec: 300, icon: "\u2615" },
  { label: "10 min", sec: 600, icon: "\u{1F373}" },
  { label: "15 min", sec: 900, icon: "\u{1F4D6}" },
  { label: "30 min", sec: 1800, icon: "\u{1F3C3}" },
  { label: "1 hour", sec: 3600, icon: "\u{1F3AF}" },
];

export const SEARCH_SUGGESTIONS = [
  "What causes rainbows?",
  "Fun facts about space",
  "How do planes fly?",
];

export const TABS = [
  { id: "convos", label: "History", icon: "\u{1F4AC}" },
  { id: "agents", label: "Agents", icon: "\u{1F916}" },
  { id: "events", label: "Events", icon: "\u{1F389}" },
  { id: "birthdays", label: "Birthdays", icon: "\u{1F382}" },
  { id: "timers", label: "Timers", icon: "\u23F1\uFE0F" },
];
