export const CALENDAR = [
  { time: "8:30 AM", title: "School Drop-off", who: "Mom", c: "#FF6B6B" },
  { time: "10:00 AM", title: "Dentist \u2014 Lily", who: "Dad", c: "#4ECDC4" },
  { time: "12:00 PM", title: "Lunch w/ Grandma", who: "Everyone", c: "#FFE66D" },
  { time: "3:30 PM", title: "Soccer Practice", who: "Jake", c: "#6BCB77" },
  { time: "5:00 PM", title: "Piano Lesson", who: "Lily", c: "#9B59B6" },
  { time: "7:00 PM", title: "Movie Night", who: "Everyone", c: "#FF8A5C" },
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
  { e: "\u{1F419}", f: "An octopus has three hearts and blue blood." },
  { e: "\u{1F319}", f: "The Moon drifts 1.5 inches from Earth every year." },
  { e: "\u{1F36F}", f: "Honey never spoils \u2014 3,000-year-old honey is still edible." },
  { e: "\u26A1", f: "Lightning is 5\u00D7 hotter than the Sun\u2019s surface." },
  { e: "\u{1F995}", f: "Some dinosaurs had feathers like parrots." },
];

export const CONVOS = [
  {
    q: "Recipe for banana pancakes?",
    a: "Mash 2 bananas, mix with 2 eggs, cinnamon, \u00BD cup oat flour.",
    who: "Mom",
    av: "\u{1F469}",
    ts: "9:15 AM",
  },
  {
    q: "How far is Mars?",
    a: "About 140M miles on average \u2014 a 7-month trip!",
    who: "Jake",
    av: "\u{1F466}",
    ts: "8:02 AM",
  },
  {
    q: "Thank you note for Grandma",
    a: "Dear Grandma, thank you for the sweater\u2026",
    who: "Lily",
    av: "\u{1F467}",
    ts: "Yesterday",
  },
  {
    q: "Weekend projects for kids?",
    a: "Baking soda volcano, bird feeder, stop-motion LEGO\u2026",
    who: "Dad",
    av: "\u{1F468}",
    ts: "Yesterday",
  },
  {
    q: "Explain photosynthesis for age 8",
    a: "Plants are tiny chefs cooking food with sunlight!",
    who: "Jake",
    av: "\u{1F466}",
    ts: "2 days ago",
  },
];

export const TASKS = [
  {
    title: "Order groceries",
    status: "active",
    prog: 65,
    agent: "Shopping",
    detail: "18/24 items added",
    icon: "\u{1F6D2}",
    c: "#4ECDC4",
  },
  {
    title: "Book campsite",
    status: "waiting",
    agent: "Travel",
    detail: "3 Yosemite options \u2014 needs vote",
    icon: "\u26FA",
    c: "#FFE66D",
    opts: ["Site A $45", "Site B $62", "Site C $38"],
  },
  {
    title: "Frame Lily\u2019s art",
    status: "done",
    agent: "Tasks",
    detail: "Pickup ready Tue 2 PM",
    icon: "\u{1F5BC}\uFE0F",
    c: "#6BCB77",
  },
  {
    title: "Car maintenance",
    status: "active",
    prog: 30,
    agent: "Auto",
    detail: "Comparing 3 shop quotes",
    icon: "\u{1F697}",
    c: "#FF8A5C",
  },
];

export const EVENTS = [
  {
    title: "Farmers Market",
    where: "Downtown Sq",
    when: "Sat 8AM\u20131PM",
    icon: "\u{1F955}",
    c: "#6BCB77",
    dist: "1.2mi",
    price: "Free",
    desc: "Produce, baked goods, kids crafts",
  },
  {
    title: "Dinosaur Exhibit",
    where: "History Museum",
    when: "Now\u2013Mar 15",
    icon: "\u{1F996}",
    c: "#FF6B6B",
    dist: "3.4mi",
    price: "$12/$8",
    desc: "Animatronics, fossil dig, VR",
  },
  {
    title: "Astronomy Night",
    where: "Observatory",
    when: "Fri 7:30PM",
    icon: "\u{1F52D}",
    c: "#9B59B6",
    dist: "5.1mi",
    price: "Free",
    desc: "Jupiter & Saturn viewing",
  },
  {
    title: "Kids Cooking",
    where: "Community Ctr",
    when: "Next Sat 2PM",
    icon: "\u{1F468}\u200D\u{1F373}",
    c: "#FFE66D",
    dist: "0.8mi",
    price: "$15",
    desc: "Pasta & pizza, ages 6\u201312",
  },
  {
    title: "Outdoor Movie",
    where: "Riverside Park",
    when: "Next Fri dusk",
    icon: "\u{1F3AC}",
    c: "#4ECDC4",
    dist: "2.0mi",
    price: "Free",
    desc: "Encanto \u2014 bring blankets",
  },
];

export const BIRTHDAYS = [
  {
    name: "Grandma Rose",
    date: "Feb 3",
    avatar: "\u{1F475}",
    age: 72,
    passed: true,
    gift: "Delivered",
    giftIdea: "Knitting basket & yarn set",
    c: "#FF6B6B",
  },
  {
    name: "Jake",
    date: "Feb 14",
    avatar: "\u{1F466}",
    age: 10,
    passed: true,
    gift: "Opened!",
    giftIdea: "LEGO Space Shuttle + telescope",
    c: "#4ECDC4",
  },
  {
    name: "Uncle Marco",
    date: "Feb 22",
    avatar: "\u{1F468}\u200D\u{1F9B1}",
    age: 38,
    passed: false,
    daysUntil: 1,
    gift: "Shipped",
    giftIdea: "Italian cookbook & olive oil set",
    c: "#FFE66D",
  },
  {
    name: "Lily\u2019s friend Mia",
    date: "Feb 25",
    avatar: "\u{1F467}",
    age: 9,
    passed: false,
    daysUntil: 4,
    gift: "Need to buy",
    giftIdea: "Art supplies kit",
    c: "#FF8ED4",
  },
  {
    name: "Cousin Sam",
    date: "Feb 28",
    avatar: "\u{1F9D1}",
    age: 15,
    passed: false,
    daysUntil: 7,
    gift: "Idea phase",
    giftIdea: "Gaming headset?",
    c: "#9B59B6",
  },
];

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
