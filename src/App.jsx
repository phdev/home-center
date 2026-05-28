import { useEffect, useMemo, useState } from "react";
import {
  AudioLines,
  Cake,
  CalendarDays,
  CloudSun,
  Gift,
  CheckCircle2,
  LayoutDashboard,
  Mic,
  PartyPopper,
  Send,
  Settings,
  Wind,
  Droplets,
  Thermometer,
} from "lucide-react";
import { useTime } from "./hooks/useTime";
import { useTimers } from "./hooks/useTimers";
import { usePreviewMode } from "./hooks/usePreviewMode";
import { useSettings } from "./hooks/useSettings";
import { useWeather } from "./hooks/useWeather";
import { useCalendar } from "./hooks/useCalendar";
import { usePhotos } from "./hooks/usePhotos";
import { useBirthdays } from "./hooks/useBirthdays";
import { useSchoolUpdates } from "./hooks/useSchoolUpdates";
import { useNavigation } from "./hooks/useNavigation";
import { useHandController } from "./hooks/useHandController";
import { useLLMQuery } from "./hooks/useLLMQuery";
import { useWakeRecord } from "./hooks/useWakeRecord";
import { useLiveCaption } from "./hooks/useLiveCaption";
import { useKnowledgeFeedbackAcknowledgement } from "./hooks/useKnowledgeFeedbackAcknowledgement";
import { useDesignSystem } from "./hooks/useDesignSystem";
import { Header } from "./components/Header";
import { CalendarPanel } from "./components/CalendarPanel";
import { WeatherPanel } from "./components/WeatherPanel";
import { FactPanel } from "./components/FactPanel";
import { EventsPanel } from "./components/EventsPanel";
import { BirthdaysPanel } from "./components/BirthdaysPanel";
import { HolidaysPanel } from "./components/HolidaysPanel";
import { AlarmOverlay } from "./components/AlarmOverlay";
import { FullCalendarPage } from "./components/FullCalendarPage";
import { FullWeatherPage } from "./components/FullWeatherPage";
import { FullPhotosPage } from "./components/FullPhotosPage";
import { FullLLMResponsePage } from "./components/FullLLMResponsePage";
import { FullKnowledgePage } from "./components/FullKnowledgePage";
import { FullHistoryPage } from "./components/FullHistoryPage";
import { SideNav } from "./components/SideNav";
import { FamilyMemberPage } from "./components/FamilyMemberPage";
import { LiveCaption } from "./components/LiveCaption";
import { KnowledgeFeedbackOverlay } from "./components/KnowledgeFeedbackOverlay";
import { ModelHealthPanel } from "./modules/model-health/ModelHealthPanel";
import { FullModelHealthPage } from "./modules/model-health/FullModelHealthPage";
import { createStateSnapshot } from "./core/state/store";
import { runInterventionEngine } from "./core/interventions/engine";
import { useClawAugmentedCards } from "./core/agents/clawAdapter";
import { buildHowieActions } from "./core/howie/actions";
import { normalizeCalendar } from "./data/calendar";
import { normalizeBirthdays } from "./data/birthdays";
import { normalizeWeather } from "./data/weather";
import { normalizeSchoolItems } from "./data/schoolUpdates";
import { getUpcomingHolidays } from "./data/holidays";
import { useTakeout } from "./data/useTakeout";
import { useBedtimeSettings } from "./data/useBedtime";
import { useChecklistConfig } from "./data/useChecklist";
import { useLunchDecisions } from "./data/useLunch";
import { useSchoolLunchMenu } from "./data/useSchoolLunch";
import { ContextualSlot, RightColumnCards, OverlayCards } from "./cards/ContextualSlot";

const V2_AGENDA_DAYS = 7;
export { buildHowieActions };
export const WEEKDAY_MORNING_TASKS = [
  "Put on Glow Stick",
  "Pack waterbottles",
  "Pack glasses",
];
function VoiceOverlays({ workerSettings, handControllerListening }) {
  const liveCaption = useLiveCaption(workerSettings);
  const knowledgeFeedbackAck = useKnowledgeFeedbackAcknowledgement(liveCaption, workerSettings);
  void handControllerListening;

  return (
    <>
      <LiveCaption text={liveCaption.text} isWake={liveCaption.isWake} stage={liveCaption.stage} age={liveCaption.age} ts={liveCaption.ts} />
      <KnowledgeFeedbackOverlay ack={knowledgeFeedbackAck} />
    </>
  );
}

const PREVIEW_KNOWLEDGE_RESPONSE = {
  kind: "knowledge",
  query: "How big is the Sun?",
  title: "How big is the Sun?",
  summary: "The Sun is enormous: about 864,000 miles wide, which is roughly 109 Earths lined up side by side. It holds more than 99.8% of all the mass in our solar system.",
  sections: [
    {
      heading: "Scale",
      content: "If Earth were the size of a marble, the Sun would be about the size of a large exercise ball. Its gravity anchors the planets, asteroids, and comets in our solar system.",
    },
    {
      heading: "Why It Matters",
      content: "The Sun's size gives it enough pressure and heat at its core to fuse hydrogen into helium, releasing the light and warmth that make life on Earth possible.",
    },
  ],
  infographic: {
    items: [
      { label: "Diameter", value: "864,000 mi" },
      { label: "Earths across", value: "~109" },
      { label: "Image source", value: "NASA" },
    ],
  },
  imageUrl: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000922/GSFC_20171208_Archive_e000922~small.jpg",
  image: {
    url: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000922/GSFC_20171208_Archive_e000922~small.jpg",
    source: "NASA",
    mode: "retrieved",
    sourceUrl: "https://images.nasa.gov/",
    alt: "The Sun",
  },
  visual: {
    source: "NASA",
    mode: "retrieved",
    metadata: { retrievalSource: "NASA" },
  },
  retrieval: {
    source: "nasa",
    nasa: { sourceUrl: "https://images.nasa.gov/" },
  },
  timestamp: Date.now(),
};

const EMPEROR_PENGUIN_KNOWLEDGE_RESPONSE = {
  kind: "knowledge",
  query: "Tell me about emperor penguins.",
  title: "Emperor Penguin",
  type: "fauna",
  summary: "The emperor penguin is the tallest and heaviest living penguin. Native to Antarctica, it is adapted to extreme cold with dense feathers and a thick layer of fat. It breeds through the year's harshest months.",
  sections: [
    {
      heading: "Adaptation",
      content: "Emperor penguins thrive in one of Earth's harshest environments. Dense, waterproof feathers, a thick layer of fat, and huddling behavior help them conserve heat and withstand brutal Antarctic winds and temperatures.",
    },
  ],
  profile: {
    facts: [
      { label: "Species", value: "A. forsteri", icon: "paw" },
      { label: "Range", value: "Antarctica", icon: "globe" },
    ],
    maps: [{ scope: "world", label: "Antarctica", highlight: "Antarctica", lat: -82, lon: 0 }],
    relatedConcepts: ["Antarctica", "Birds", "Cold adaptation"],
  },
  infographics: [{
    title: "At a Glance",
    kind: "metrics",
    items: [
      { label: "Height", value: "100-130 cm", sublabel: "39-51 in", icon: "ruler" },
      { label: "Weight", value: "22-45 kg", sublabel: "49-99 lb", icon: "weight" },
      { label: "Penguin lineage", value: "60M+", sublabel: "years", icon: "dna" },
    ],
  }],
  imageUrl: "/home-center/knowledge-assets/emperor-penguin-reference-hero.png",
  image: {
    url: "/home-center/knowledge-assets/emperor-penguin-reference-hero.png",
    source: "Wikimedia Commons",
    mode: "pinned",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Emperor_penguins_in_Antarctica.jpg",
    focalPoint: { x: 0.64, y: 0.5 },
    cropHint: "right-subject",
    tone: "home-center-dark",
    alt: "Emperor penguins in Antarctica",
  },
  visualPlan: {
    visualFamily: "editorial-knowledge-v1",
    queryType: "fauna",
    subType: "fauna/polar-animal",
    compositionPattern: "species-closeup-with-environment",
    heroStrategy: "retrieved-single-subject",
    textSafeZone: "left",
    focalRegion: "right-center",
    tone: "home-center-dark",
    contrastLevel: "medium-high",
    motifStrategy: "snow-habitat-rings",
    supportingPanelStyle: "lifecycle-loop",
    mapStyle: "habitat-range",
    badgeStyle: "green-fauna",
    atAGlanceStyle: "lifecycle-loop",
    backgroundTreatment: "navy-glass-vignette",
    moduleStyles: {
      hero: "species-closeup-with-environment",
      facts: "compact-fact-rows",
      middle: "habitat-range",
      lower: "lifecycle-loop",
    },
  },
  imageSourceType: "known",
  timestamp: Date.now(),
};

const ADA_LOVELACE_KNOWLEDGE_RESPONSE = {
  kind: "knowledge",
  query: "Who was Ada Lovelace?",
  title: "Ada Lovelace",
  type: "person",
  summary: "Ada Lovelace was an English mathematician and writer best known for her work on Charles Babbage's Analytical Engine. Her notes described how a machine could manipulate symbols, which is why she is often called the first computer programmer.",
  sections: [
    {
      heading: "Legacy",
      content: "Ada Lovelace showed that computers could work with symbols and instructions, not just arithmetic, laying a foundation for modern software.",
    },
  ],
  profile: {
    facts: [
      { label: "Born date", value: "December 10, 1815", icon: "calendar" },
      { label: "Known For", value: "Analytical Engine notes; first computer program", icon: "code" },
    ],
    maps: [],
    relatedConcepts: ["Analytical Engine", "computer programming", "Charles Babbage"],
  },
  timeline: [
    { date: "December 10, 1815", label: "Born in London", description: "London, England; raised with a strong emphasis on mathematics." },
    { date: "1843", label: "Expanded the Analytical Engine", description: "Added notes to Menabrea's translation, including an algorithm and a vision of machines handling symbols." },
    { date: "Legacy", label: "Practical computing influence", description: "Modern software follows this idea: instructions transform information." },
  ],
  infographics: [{
    title: "At A Glance",
    kind: "metrics",
    description: "Three core ideas Lovelace helped move into computing history.",
    items: [
      { label: "Mathematics", value: "Machine reasoning", icon: "calculator" },
      { label: "Analytical Engine", value: "Symbol machine", icon: "cog" },
      { label: "First Programmer", value: "Computer algorithm", icon: "code" },
    ],
  }],
  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Ada_Lovelace_portrait.jpg",
  image: {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Ada_Lovelace_portrait.jpg",
    source: "Wikimedia Commons",
    mode: "pinned",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ada_Lovelace_portrait.jpg",
    focalPoint: { x: 0.58, y: 0.34 },
    cropHint: "right-subject",
    tone: "home-center-dark",
    alt: "Ada Lovelace portrait",
  },
  visualPlan: {
    visualFamily: "editorial-knowledge-v1",
    queryType: "person",
    subType: "person/historical-scientist",
    compositionPattern: "portrait-right-text-left",
    heroStrategy: "retrieved-single-subject",
    textSafeZone: "left",
    focalRegion: "right-top",
    tone: "home-center-dark",
    contrastLevel: "medium-high",
    motifStrategy: "technical-sketch",
    supportingPanelStyle: "vertical-timeline",
    mapStyle: "none",
    badgeStyle: "gold-person",
    atAGlanceStyle: "icon-metric-columns",
    backgroundTreatment: "navy-glass-vignette",
    moduleStyles: {
      hero: "portrait-editorial",
      facts: "compact-fact-rows",
      middle: "vertical-timeline",
      lower: "icon-metric-columns",
    },
  },
  imageSourceType: "known",
  timestamp: Date.now(),
};

const APOLLO_11_KNOWLEDGE_RESPONSE = {
  kind: "knowledge",
  query: "What happened during Apollo 11?",
  title: "Apollo 11 Moon Landing",
  type: "event",
  summary: "Apollo 11 was the 1969 NASA mission that first landed humans on the Moon. On July 20, 1969, Neil Armstrong and Buzz Aldrin walked on the lunar surface while Michael Collins orbited above in the command module.",
  sections: [
    {
      heading: "Result",
      content: "Apollo 11 proved that humans could travel to another world and return safely, opening the door to future exploration and inspiring generations around the globe.",
    },
  ],
  profile: {
    facts: [
      { label: "Dates", value: "July 16-24, 1969", icon: "calendar" },
      { label: "Crew", value: "3", icon: "crew" },
    ],
    maps: [
      { scope: "country", label: "Houston", highlight: "Houston, Texas", detail: "Mission Control", regionCode: "TX" },
      { scope: "country", label: "Cape Canaveral", highlight: "Cape Canaveral, Florida", detail: "Kennedy Space Center", regionCode: "FL" },
    ],
    relatedConcepts: ["NASA", "Moon mission", "Space exploration"],
  },
  timeline: [
    { date: "July 16, 1969", label: "Launch", description: "9:32 AM EDT" },
    { date: "July 20, 1969", label: "Lunar Landing", description: "4:17 PM EDT" },
    { date: "July 20, 1969", label: "Moonwalk", description: "10:56 PM EDT" },
    { date: "July 24, 1969", label: "Return", description: "11:50 AM EDT" },
  ],
  imageUrl: "/home-center/knowledge-assets/apollo-11-aldrin.jpg",
  image: {
    url: "/home-center/knowledge-assets/apollo-11-aldrin.jpg",
    source: "NASA",
    mode: "pinned",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Aldrin_Apollo_11.jpg",
    focalPoint: { x: 0.5, y: 0.5 },
    cropHint: "center-subject",
    tone: "home-center-dark",
    alt: "Buzz Aldrin on the Moon during Apollo 11",
  },
  visualPlan: {
    visualFamily: "editorial-knowledge-v1",
    queryType: "event",
    subType: "event/space-mission",
    compositionPattern: "archival-event-scene",
    heroStrategy: "retrieved-single-subject",
    textSafeZone: "left",
    focalRegion: "center-center",
    tone: "home-center-dark",
    contrastLevel: "medium-high",
    motifStrategy: "orbital",
    supportingPanelStyle: "horizontal-mission-timeline",
    mapStyle: "us-places-map",
    badgeStyle: "amber-event",
    atAGlanceStyle: "timeline-icons",
    backgroundTreatment: "navy-glass-vignette",
    moduleStyles: {
      hero: "archival-event-scene",
      facts: "compact-fact-rows",
      middle: "us-places-map",
      lower: "horizontal-mission-timeline",
    },
  },
  imageSourceType: "known",
  timestamp: Date.now(),
};

const COAST_REDWOOD_KNOWLEDGE_RESPONSE = {
  kind: "knowledge",
  query: "Tell me about coast redwoods.",
  title: "Coast Redwood",
  type: "flora",
  summary: "Coast redwoods are the tallest trees on Earth, thriving in the cool fog belt of coastal Northern California and southern Oregon. Their height, long lives, and dense forest communities make them one of the most dramatic examples of living architecture.",
  sections: [
    {
      heading: "Ecosystem Role",
      content: "A mature redwood forest stores immense carbon, creates shaded stream habitat, and captures coastal fog that helps sustain the understory through dry summers.",
    },
  ],
  profile: {
    facts: [
      { label: "Species", value: "Sequoia sempervirens", icon: "dna" },
      { label: "Height", value: "Up to 379 ft", icon: "ruler" },
    ],
    maps: [
      {
        scope: "world",
        label: "Native range",
        highlight: "Northern California and southern Oregon coast",
        detail: "Cool, fog-influenced forests",
        lat: 41.3,
        lon: -124.0,
      },
    ],
    relatedConcepts: ["old-growth forest", "fog drip", "carbon storage"],
  },
  infographics: [{
    title: "Growth Pattern",
    kind: "metrics",
    description: "Scale, longevity, and climate niche define the coast redwood.",
    items: [
      { label: "Height", value: "Up to 379 ft", icon: "ruler" },
      { label: "Age", value: "2,000+ yrs", icon: "calendar" },
      { label: "Climate", value: "Fog belt", icon: "cloud" },
    ],
  }],
  imageUrl: "/home-center/knowledge-assets/coast-redwood-hero.jpg",
  image: {
    url: "/home-center/knowledge-assets/coast-redwood-hero.jpg",
    source: "Wikimedia Commons",
    mode: "pinned",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Prairie_Creek_Redwoods_-_Coastal_Redwood_Forest.jpg",
    focalPoint: { x: 0.66, y: 0.46 },
    cropHint: "right-subject",
    tone: "home-center-dark",
    alt: "Coast redwood forest",
  },
  visualPlan: {
    visualFamily: "editorial-knowledge-v1",
    queryType: "flora",
    subType: "flora/tree",
    compositionPattern: "tall-subject-forest-depth",
    heroStrategy: "retrieved-single-subject",
    textSafeZone: "left",
    focalRegion: "right-center",
    tone: "home-center-dark",
    contrastLevel: "medium-high",
    motifStrategy: "growth-rings",
    supportingPanelStyle: "height-comparison",
    mapStyle: "range-glass",
    badgeStyle: "emerald-flora",
    atAGlanceStyle: "height-comparison",
    backgroundTreatment: "navy-glass-vignette",
    moduleStyles: {
      hero: "scenic-location",
      facts: "compact-fact-rows",
      middle: "range-glass",
      lower: "height-comparison",
    },
  },
  imageSourceType: "known",
  timestamp: Date.now(),
};

const INTERNET_KNOWLEDGE_RESPONSE = {
  kind: "knowledge",
  query: "What is the internet?",
  title: "The Internet",
  type: "concept",
  summary: "The Internet is a global network that lets connected devices exchange data using shared protocols.",
  sections: [
    {
      heading: "Key Idea",
      content: "No single machine is the Internet. It works because many independent networks agree on shared protocols for addressing, routing, and delivering data.",
    },
  ],
  profile: {
    facts: [
      { label: "Started", value: "1960s-1980s", icon: "calendar" },
      { label: "Core method", value: "Packet switching", icon: "network" },
      { label: "Scale", value: "Global network", icon: "globe" },
    ],
    maps: [],
    relatedConcepts: ["packet switching", "TCP/IP", "World Wide Web"],
  },
  infographics: [{
    title: "How It Works",
    kind: "process",
    description: "Data moves through routers as small packets, then servers respond.",
    items: [
      { label: "Devices", value: "Send data", icon: "devices" },
      { label: "Routers", value: "Find path", icon: "router" },
      { label: "Packets", value: "Small pieces", icon: "packets" },
      { label: "Servers", value: "Respond", icon: "servers" },
    ],
  }, {
    title: "At A Glance",
    kind: "metrics",
    description: "The Internet is bigger than the web.",
    items: [
      { label: "Global network", value: "Billions connected", icon: "globe" },
      { label: "Shared protocols", value: "TCP/IP rules", icon: "shield" },
      { label: "Many services", value: "Web, email, apps", icon: "services" },
    ],
  }],
  imageUrl: "/home-center/knowledge-assets/internet-layered-network-hero.png",
  image: {
    url: "/home-center/knowledge-assets/internet-layered-network-hero.png",
    source: "GPT Image 2",
    width: 1672,
    height: 941,
    focalPoint: { x: 0.66, y: 0.48 },
    cropHint: "left-text-safe",
    tone: "home-center-dark",
    mode: "pinned",
    assetMode: "pinned",
  },
  imageSourceType: "known",
  visualNeed: "useful",
  visualPlan: {
    visualFamily: "editorial-knowledge-v1",
    queryType: "concept",
    subType: "concept/network",
    compositionPattern: "concept-layered-diagram-like",
    heroStrategy: "retrieved-single-subject",
    textSafeZone: "left",
    focalRegion: "right-center",
    tone: "home-center-dark",
    contrastLevel: "high",
    motifStrategy: "node-mesh",
    supportingPanelStyle: "process-flow",
    mapStyle: "none",
    badgeStyle: "violet-concept",
    atAGlanceStyle: "icon-metric-columns",
    backgroundTreatment: "navy-glass-vignette",
    moduleStyles: {
      hero: "native-concept-hero",
      facts: "compact-fact-rows",
      middle: "process-flow",
      lower: "icon-metric-columns",
    },
  },
  timestamp: Date.now(),
};

const MADAGASCAR_KNOWLEDGE_RESPONSE = {
  kind: "knowledge",
  query: "Where is Madagascar?",
  title: "Madagascar",
  type: "location",
  summary: "Madagascar is a large island country in the Indian Ocean off the southeastern coast of Africa.",
  sections: [
    {
      heading: "Key Idea",
      content: "It sits east of Mozambique across the Mozambique Channel. Its long isolation helped create distinctive landscapes and species found nowhere else.",
    },
  ],
  profile: {
    facts: [
      { label: "Area", value: "587,041 sq km", icon: "map" },
      { label: "Capital", value: "Antananarivo", icon: "city" },
      { label: "Region", value: "Indian Ocean", icon: "globe" },
      { label: "Nearest mainland", value: "Southeast Africa", icon: "map" },
    ],
    maps: [
      {
        scope: "world",
        label: "Madagascar",
        highlight: "East of Mozambique",
        detail: "Indian Ocean island country",
        lat: -18.7669,
        lon: 46.8691,
      },
    ],
    relatedConcepts: ["Indian Ocean", "Mozambique Channel", "biodiversity"],
  },
  infographics: [{
    title: "At A Glance",
    kind: "metrics",
    description: "A world of its own: most wildlife here is found nowhere else on Earth.",
    visual: {
      url: "/home-center/knowledge-assets/madagascar-island-relief.svg",
      alt: "Teal relief map of Madagascar",
    },
    items: [
      { label: "Species", value: "200,000+", icon: "paw" },
      { label: "Endemic", value: "90%+", icon: "flora" },
      { label: "Unique biomes", value: "5", icon: "globe" },
    ],
  }],
  imageUrl: "/home-center/knowledge-assets/madagascar-baobabs.jpg",
  image: {
    url: "/home-center/knowledge-assets/madagascar-baobabs.jpg",
    source: "Wikimedia Commons",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Avenue_of_Baobabs,_Madagascar_(22558139260).jpg",
    credit: "Rod Waddington",
    license: "CC BY-SA 2.0",
    width: 4739,
    height: 3454,
    focalPoint: { x: 0.7, y: 0.46 },
    cropHint: "right-subject",
    tone: "home-center-dark",
    mode: "pinned",
    assetMode: "pinned",
    alt: "Avenue of the Baobabs in Madagascar",
  },
  imageSourceType: "known",
  visualNeed: "useful",
  visualPlan: {
    visualFamily: "editorial-knowledge-v1",
    queryType: "location",
    subType: "location/island",
    compositionPattern: "place-scenic-wide",
    heroStrategy: "retrieved-single-subject",
    textSafeZone: "left",
    focalRegion: "right-center",
    tone: "home-center-dark",
    contrastLevel: "medium",
    motifStrategy: "island-contour",
    supportingPanelStyle: "map-geography",
    mapStyle: "world-map-pin",
    badgeStyle: "blue-location",
    atAGlanceStyle: "island-shape-stats",
    backgroundTreatment: "navy-glass-vignette",
    moduleStyles: {
      hero: "scenic-location",
      facts: "compact-fact-rows",
      middle: "world-map-pin",
      lower: "island-shape-stats",
    },
  },
  timestamp: Date.now(),
};

const KNOWLEDGE_LOADING_RESPONSE = {
  kind: "knowledge",
  query: "Knowledge query in progress",
  title: "Loading",
  summary: "Loading knowledge answer...",
  sections: [],
  infographic: null,
  infographics: [],
  profile: null,
  imageUrl: null,
  image: null,
  imagePending: true,
  visual: {
    source: "none",
    mode: "none",
    metadata: { reason: "loading_knowledge_response" },
  },
  loading: true,
};

const PREVIEW_LLM_RESPONSE = {
  query: "What should we know before heading out?",
  title: "Heading Out",
  type: "concept",
  summary: "The beach is bright and calm in this v2 preview. The new Liquid Glass system keeps the family image present while preserving readable cards and clear source panels.",
  sections: [
    {
      heading: "Design System",
      content: "Version two uses translucent glass surfaces, thin highlights, and a sharp family-photo background instead of the flat black stage.",
    },
    {
      heading: "Voice Control",
      content: "Say Hey Homer, show version one to return to the original system, or Hey Homer, show version two to use Liquid Glass.",
    },
  ],
  infographic: {
    items: [
      { label: "Mode", value: "Liquid Glass" },
      { label: "Background", value: "Family beach" },
      { label: "Version", value: "Two" },
    ],
  },
  imageUrl: "/home-center/backgrounds/liquid-glass-family-bg-v2.jpg",
  timestamp: Date.now(),
};

const NO_OUTLINE_DASHBOARD_PREVIEW = {
  calendar: {
    events: [
      {
        id: "preview-cal-standup",
        day: "Today",
        time: "4:30",
        title: "Family check-in",
        sub: "Kitchen",
        start: "2026-05-17T16:30:00-07:00",
        end: "2026-05-17T17:00:00-07:00",
        calendar: "howell-family",
      },
      {
        id: "preview-cal-lunch",
        day: "Tomorrow",
        time: "8:15",
        title: "Pack field trip lunch",
        sub: "Lucy",
        start: "2026-05-18T08:15:00-07:00",
        end: "2026-05-18T08:30:00-07:00",
        calendar: "howell-family",
      },
      {
        id: "preview-cal-practice",
        day: "Tomorrow",
        time: "5:00",
        title: "Soccer practice",
        sub: "South field",
        start: "2026-05-18T17:00:00-07:00",
        end: "2026-05-18T18:00:00-07:00",
        calendar: "howell-family",
      },
    ],
    loading: false,
    error: null,
  },
  weather: {
    current: {
      temp: 68,
      condition: "Marine layer clearing",
      feelsLike: 67,
      wind: "9 mph W",
      humidity: 58,
      hi: 71,
      lo: 57,
      high: 71,
      low: 57,
      precipProb: 0.08,
    },
    forecast: [{ high: 71, low: 57, precipProb: 0.08, condition: "Marine layer clearing" }],
    loading: false,
    error: null,
  },
  birthdays: {
    birthdays: [
      { id: "preview-bd-grandma", name: "Grandma Sue", avatar: "\u{1F382}", date: "05-25", daysUntil: 8, giftStatus: "needed" },
      { id: "preview-bd-mike", name: "Uncle Mike", avatar: "\u{1F389}", date: "06-14", daysUntil: 28, giftStatus: "ordered" },
      { id: "preview-bd-lily", name: "Cousin Lily", avatar: "\u{1F388}", date: "07-02", daysUntil: 46, giftStatus: "unknown" },
    ],
    loading: false,
    error: null,
  },
  school: {
    updates: [
      {
        id: "preview-school-permission",
        kind: "action",
        title: "Field trip permission slip",
        summary: "Return the signed form before Tuesday morning.",
        dueDate: "2026-05-18T08:30:00-07:00",
        child: "Lucy",
        urgency: 0.82,
        extractionSource: "regex",
        sourceEmailId: "preview-school-permission",
      },
      {
        id: "preview-school-bookfair",
        kind: "event",
        title: "Book fair volunteer window",
        summary: "Library asked for help during the 2-4 PM slot.",
        eventDate: "2026-05-19T14:00:00-07:00",
        child: "Livy",
        urgency: 0.44,
        extractionSource: "regex",
        sourceEmailId: "preview-school-bookfair",
      },
    ],
    loading: false,
    error: null,
  },
};

export default function App() {
  const now = useTime();
  const { isMobile } = usePreviewMode();
  const [activeMember, setActiveMember] = useState("home");
  const { settings } = useSettings();
  const { designSystem } = useDesignSystem(settings.worker, settings.appearance?.designSystem);
  const { timers, expiredTimers, dismissTimer, dismissAll } = useTimers(settings.worker);
  const { page, calendarView, navigationTimestamp, goTo } = useNavigation(settings.worker);
  const llm = useLLMQuery(settings.worker);

  // URL params can force a specific page/view (used by TV preview)
  const urlParams = new URLSearchParams(window.location.search);
  const requestedPage = urlParams.get("page");
  const forceView = urlParams.get("view") || calendarView;
  const forceNow = parseForcedNow(urlParams.get("now"));
  const sectionOutlines = urlParams.get("sectionOutlines");
  const noOutlinePreview = designSystem === "v2" && sectionOutlines === "none";
  const appNow = forceNow ?? now;
  const previewResponse =
    requestedPage === "knowledge"
      ? (urlParams.get("knowledgeFixture") === "apollo-11"
        ? APOLLO_11_KNOWLEDGE_RESPONSE
        : urlParams.get("knowledgeFixture") === "emperor-penguin"
          ? EMPEROR_PENGUIN_KNOWLEDGE_RESPONSE
          : urlParams.get("knowledgeFixture") === "ada-lovelace"
            ? ADA_LOVELACE_KNOWLEDGE_RESPONSE
            : urlParams.get("knowledgeFixture") === "coast-redwood"
              ? COAST_REDWOOD_KNOWLEDGE_RESPONSE
              : urlParams.get("knowledgeFixture") === "internet"
                ? INTERNET_KNOWLEDGE_RESPONSE
                : urlParams.get("knowledgeFixture") === "madagascar"
                  ? MADAGASCAR_KNOWLEDGE_RESPONSE
            : PREVIEW_KNOWLEDGE_RESPONSE)
      : requestedPage === "llm-response"
        ? PREVIEW_LLM_RESPONSE
        : null;
  const activeLLMResponse = previewResponse || llm.latestResponse;
  const responsePage = activeLLMResponse?.kind === "knowledge" ? "knowledge" : "llm-response";
  const forcePage = activeLLMResponse ? responsePage : (requestedPage || page);
  const knowledgePageResponse =
    activeLLMResponse || (forcePage === "knowledge" ? KNOWLEDGE_LOADING_RESPONSE : null);
  const usesDashboardBackground = forcePage === "dashboard";

  const hc = useHandController(settings.worker, forcePage, goTo);

  const weather = useWeather(settings.weather);
  const calendar = useCalendar(settings.calendar, settings.worker);
  const photos = usePhotos(settings.photos, settings.worker);
  const bdays = useBirthdays(settings.worker);
  const school = useSchoolUpdates(settings.worker);
  const dashboardCalendar = noOutlinePreview ? NO_OUTLINE_DASHBOARD_PREVIEW.calendar : calendar;
  const dashboardWeather = noOutlinePreview ? NO_OUTLINE_DASHBOARD_PREVIEW.weather : weather;
  const dashboardBirthdays = noOutlinePreview ? NO_OUTLINE_DASHBOARD_PREVIEW.birthdays : bdays;
  const dashboardSchool = noOutlinePreview ? NO_OUTLINE_DASHBOARD_PREVIEW.school : school;
  const wakeRecord = useWakeRecord();
  const voiceOverlay = <VoiceOverlays workerSettings={settings.worker} handControllerListening={hc.listening} />;

  // Derived-state layer (see docs/home_center_state_model.md)
  const takeout = useTakeout(settings.worker);
  const bedtimeSettings = useBedtimeSettings(settings);
  const checklist = useChecklistConfig(settings);
  const lunchDecisions = useLunchDecisions(settings.worker);
  const schoolLunchMenu = useSchoolLunchMenu(settings.worker);

  const rawState = useMemo(() => {
    const schoolItems = normalizeSchoolItems(dashboardSchool);
    return {
      calendar: { events: normalizeCalendar(dashboardCalendar) },
      weather: { today: normalizeWeather(dashboardWeather.data ?? dashboardWeather) },
      birthdays: normalizeBirthdays(dashboardBirthdays),
      bedtime: bedtimeSettings,
      checklist,
      takeout: { today: takeout ?? null },
      lunchDecisions: lunchDecisions ?? {},
      schoolLunchMenu: schoolLunchMenu ?? [],
      schoolItems,
      schoolUpdates: schoolItems,
      settings: {},
    };
  }, [
    dashboardCalendar, dashboardWeather, dashboardBirthdays, bedtimeSettings, checklist,
    takeout, lunchDecisions, schoolLunchMenu, dashboardSchool,
  ]);
  const stateSnapshot = useMemo(
    () => createStateSnapshot(rawState, { now: appNow, user: { isPeter: true } }),
    [rawState, appNow],
  );
  const rawData = stateSnapshot.rawData;
  const derived = stateSnapshot.derivedState;
  const interventionCards = useMemo(
    () => runInterventionEngine(derived, { now: appNow }),
    [derived, appNow],
  );
  const cards = useClawAugmentedCards(interventionCards, settings.worker);
  const calendarConflictCard = findCard(cards, "CalendarConflictCard");
  const schoolUpdatesCard = findCard(cards, "SchoolUpdatesCard");

  useEffect(() => {
    if (usesDashboardBackground) {
      document.body.dataset.hcBackground = "dashboard";
    } else {
      document.body.dataset.hcBackground = "plain";
    }
  }, [usesDashboardBackground]);

  useEffect(() => {
    return () => {
      document.body.dataset.hcBackground = "plain";
    };
  }, []);

  // Auto-navigate to LLM response page when a new response arrives
  useEffect(() => {
    if (llm.latestResponse && forcePage !== responsePage) {
      goTo(responsePage);
    }
  }, [llm.latestResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  // Voice "go back" / "go home" lands as a dashboard navigation command.
  // Response pages are driven by latestResponse, so clear it when the nav
  // command is newer than the active response.
  useEffect(() => {
    if (!activeLLMResponse || page !== "dashboard") return;
    const responseTimestamp = Number(activeLLMResponse.timestamp || 0);
    if (navigationTimestamp > responseTimestamp) {
      llm.dismissResponse();
    }
  }, [activeLLMResponse, page, navigationTimestamp, llm.dismissResponse]);

  if (forcePage === "calendar" && !isMobile) {
    return (
      <>
        {voiceOverlay}
        <FullCalendarPage
          events={calendar.events}
          loading={calendar.loading}
          view={forceView}
          onViewChange={(v) => goTo(null, v)}
          onBack={() => goTo("dashboard")}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
          birthdays={bdays.birthdays}
        />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  if (forcePage === "weather" && !isMobile) {
    return (
      <>
        {voiceOverlay}
        <FullWeatherPage
          weatherData={weather.data}
          loading={weather.loading}
          error={weather.error}
          locationName={weather.locationName}
          onBack={() => goTo("dashboard")}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  if (forcePage === "photos" && !isMobile) {
    return (
      <>
        {voiceOverlay}
        <FullPhotosPage
          photos={photos.photos}
          loading={photos.loading}
          error={photos.error}
          onBack={() => goTo("dashboard")}
          columns={hc.photoColumns}
          scrollDir={hc.photoScrollDir}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  if (forcePage === "llm-response" && !isMobile) {
    return (
      <>
        {voiceOverlay}
        <FullLLMResponsePage
          response={activeLLMResponse}
          onBack={() => { llm.dismissResponse(); goTo("dashboard"); }}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  if (forcePage === "knowledge" && !isMobile) {
    return (
      <>
        {voiceOverlay}
        <FullKnowledgePage
          response={knowledgePageResponse}
          onBack={() => { llm.dismissResponse(); goTo("dashboard"); }}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  if (forcePage === "model-health") {
    return (
      <>
        {voiceOverlay}
        <FullModelHealthPage onBack={() => goTo("dashboard")} workerSettings={settings.worker} />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  if (forcePage === "history" && !isMobile) {
    return (
      <>
        {voiceOverlay}
        <FullHistoryPage
          history={llm.history}
          loading={llm.historyLoading}
          onBack={() => goTo("dashboard")}
          onSelect={(item) => {
            // When selecting a history item, set it as latest and navigate to response
            // For now, just show the summary since we don't store full sections in history
            goTo("dashboard");
          }}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  return (
    <>
      {voiceOverlay}
      <style>{`
        body { overflow: ${isMobile ? "auto" : "hidden"} }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: #FFFFFF15; border-radius: 3px }
      `}</style>
      <div
        className={`hc-app-shell${designSystem === "v2" && sectionOutlines === "none" ? " hc-v2-no-section-outlines" : ""}`}
        style={{
          width: "100%",
          minHeight: isMobile ? "100vh" : undefined,
          height: isMobile ? "auto" : "100vh",
          background: designSystem === "v2" ? "transparent" : "#000000",
          padding: isMobile ? "12px 12px 80px" : designSystem === "v2" ? "0px 30px 18px" : "0px 16px 16px",
          display: "flex",
          flexDirection: "column",
          overflow: isMobile ? "visible" : "hidden",
          fontFamily: "'Geist','Inter',system-ui,sans-serif",
          color: "#FFFFFF",
        }}
      >
        <Header now={appNow} isMobile={isMobile} onHistory={() => { llm.fetchHistory(); goTo("history"); }} handControllerConnected={hc.connected} lastGesture={hc.lastGesture} wakeRecord={wakeRecord} designSystem={designSystem} />
        <div className="hc-v2-version-chip" style={{ position: "fixed", right: 20, bottom: 18, zIndex: 80 }}>
          LIQUID GLASS · VERSION TWO
        </div>

        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <CalendarPanel events={dashboardCalendar.events} loading={dashboardCalendar.loading} error={dashboardCalendar.error} conflictCard={calendarConflictCard} />
            <WeatherPanel weatherData={dashboardWeather.data ?? dashboardWeather} loading={dashboardWeather.loading} error={dashboardWeather.error} />
            <BirthdaysPanel birthdays={dashboardBirthdays.birthdays} loading={dashboardBirthdays.loading} error={dashboardBirthdays.error} derived={derived} />
            <HolidaysPanel now={appNow} />
            <EventsPanel card={schoolUpdatesCard} />
            <ModelHealthPanel onExpand={() => goTo("model-health")} workerSettings={settings.worker} />
            <FactPanel />
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, marginTop: designSystem === "v2" ? 2 : 16, minHeight: 0 }}>
            {designSystem !== "v2" && <SideNav activeMember={activeMember} onSelect={setActiveMember} />}
            {activeMember !== "home" ? (
              <FamilyMemberPage member={activeMember} />
            ) : designSystem === "v2" ? (
              <V2HomeDashboard
                now={appNow}
                calendar={rawState.calendar}
                weather={dashboardWeather}
                birthdays={dashboardBirthdays}
                derived={derived}
              />
            ) : (
              <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0, marginLeft: 16 }}>
                {/* Left column: Calendar + Holidays */}
                <div style={{ width: 400, flexShrink: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <CalendarPanel events={dashboardCalendar.events} loading={dashboardCalendar.loading} error={dashboardCalendar.error} selected={hc.selectedPanelId === "calendar"} conflictCard={calendarConflictCard} />
                  </div>
                  <div style={{ height: 240, flexShrink: 0 }}>
                    <HolidaysPanel now={appNow} selected={hc.selectedPanelId === "holidays"} max={3} />
                  </div>
                </div>

                {/* Middle column */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
                  <div style={{ display: "flex", gap: 16, height: 270, flexShrink: 0 }}>
                    <div style={{ width: 340, flexShrink: 0, minHeight: 0 }}>
                      <BirthdaysPanel birthdays={dashboardBirthdays.birthdays} loading={dashboardBirthdays.loading} error={dashboardBirthdays.error} selected={hc.selectedPanelId === "birthdays"} derived={derived} />
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <WeatherPanel weatherData={dashboardWeather.data ?? dashboardWeather} loading={dashboardWeather.loading} error={dashboardWeather.error} selected={hc.selectedPanelId === "weather"} />
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <EventsPanel card={schoolUpdatesCard} selected={hc.selectedPanelId === "events"} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <ContextualSlot
                        derived={derived}
                        raw={rawData}
                        cards={cards}
                        selected={hc.selectedPanelId === "events"}
                      />
                    </div>
                  </div>
                </div>

                {/* Right column — Claw Suggestions (replaces Fun Fact when suggestions exist) */}
                <div style={{ width: 400, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
                  <RightColumnCards
                    derived={derived}
                    raw={rawData}
                    cards={cards}
                    selected={hc.selectedPanelId === "fact"}
                    fallback={<FactPanel selected={hc.selectedPanelId === "fact"} />}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      <OverlayCards derived={derived} raw={rawData} cards={cards} />
    </>
  );
}

function findCard(cards, type) {
  return (cards ?? []).find((card) => card.type === type) ?? null;
}

function parseForcedNow(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function V2HomeDashboard({ now, calendar, weather, birthdays, derived }) {
  const agenda = useMemo(() => buildAgenda(calendar?.events, now), [calendar?.events, now]);
  const showMorningTasks = shouldShowWeekdayMorningTasks(now);
  const current = normalizeV2Weather(weather?.data ?? weather);
  const birthdayItems = birthdays?.birthdays?.length ? birthdays.birthdays : NO_OUTLINE_DASHBOARD_PREVIEW.birthdays.birthdays;
  const holidays = useMemo(() => getUpcomingHolidays(now, { max: 2, daysAhead: 45 }), [now]);
  const actions = buildHowieActions(derived, now);
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const [hourMinute, meridiem] = time.split(" ");

  return (
    <div className="hc-v2-home-dashboard" style={v2ShellStyle}>
      <section style={v2AgendaStyle}>
        <V2SectionTitle icon={<CalendarDays size={24} />} label="Next 7 Days" meta={now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
        {showMorningTasks && <WeekdayMorningTaskList />}
        {agenda.days.map((day) => (
          <V2AgendaGroup key={day.key} title={day.title} items={day.items} />
        ))}
      </section>

      <section style={v2HeroStyle}>
        <div style={v2HeroTimeStyle}>
          <span style={v2HeroTimeNumberStyle}>{hourMinute}</span>
          <span style={v2HeroMeridiemStyle}>{meridiem}</span>
        </div>
        <div style={v2HeroDividerStyle} />
        <div style={v2WeatherHeroStyle}>
          <CloudSun size={56} color="#FFFFFF" />
          <div>
            <div style={v2TempStyle}>{current.temp}°F</div>
            <div style={v2WeatherSummaryStyle}>{current.condition}</div>
            <div style={v2WeatherMutedStyle}>Feels like {current.feelsLike}°F</div>
          </div>
          <div style={v2WeatherFactsStyle}>
            <V2Metric icon={<Wind size={15} />} text={current.wind} />
            <V2Metric icon={<Droplets size={15} />} text={`${current.humidity}%`} />
            <V2Metric icon={<Thermometer size={15} />} text={`H: ${current.hi}°`} />
            <V2Metric icon={<Thermometer size={15} />} text={`L: ${current.lo}°`} />
          </div>
        </div>
      </section>

      <div style={v2RightRailStyle}>
        <section style={v2NeedsPanelStyle}>
          <NeedsActionPanel actions={actions} />
        </section>
        <section style={v2HowiePanelStyle}>
          <HowieAssistantPanel />
        </section>
      </div>

      <section style={v2BottomTrayStyle}>
        <div style={v2BottomColumnStyle}>
          <V2SectionTitle icon={<Cake size={19} />} label="Birthdays" />
          <div style={v2BirthdayRowStyle}>
            {birthdayItems.slice(0, 3).map((birthday, index) => (
              <div key={birthday.id ?? birthday.name ?? index} style={v2BirthdayItemStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={v2ItemTitleStyle}>{birthday.name}</div>
                  <div style={v2MutedStyle}>{formatBirthdayDate(birthday, now)}</div>
                </div>
                <span style={v2PillStyle(birthday.giftStatus)}>{giftLabel(birthday.giftStatus)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={v2TrayDividerStyle} />
        <div style={v2BottomColumnStyle}>
          <V2SectionTitle icon={<PartyPopper size={19} />} label="Upcoming Holidays" />
          <div style={v2HolidayRowStyle}>
            {holidays.map((holiday) => (
              <div key={holiday.date} style={v2HolidayItemStyle}>
                <div style={v2DateTileStyle(holiday.color)}>
                  <span>{holiday.label.split(" ")[0].toUpperCase()}</span>
                  <strong>{holiday.label.split(" ")[1]}</strong>
                </div>
                <div>
                  <div style={v2ItemTitleStyle}>{holiday.name}</div>
                  <div style={v2MutedStyle}>{holiday.daysUntil === 1 ? "tomorrow" : `in ${holiday.daysUntil} days`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={v2FooterStyle}>
        <span style={v2MemberPillStyle}>Peter Howell</span>
        <span style={v2VersionPillStyle}>LIQUID GLASS · VERSION TWO</span>
      </div>
    </div>
  );
}

function WeekdayMorningTaskList() {
  return (
    <div style={v2MorningTasksStyle}>
      <div style={v2MorningTasksHeaderStyle}>
        <span>Before school</span>
        <em>7:50-8:30</em>
      </div>
      <div style={v2MorningTasksListStyle}>
        {WEEKDAY_MORNING_TASKS.map((task) => (
          <div key={task} style={v2MorningTaskItemStyle}>
            <CheckCircle2 size={18} color="#C7F9CC" strokeWidth={2.4} />
            <span>{task}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function V2SectionTitle({ icon, label, meta }) {
  return (
    <div style={v2SectionTitleStyle}>
      <span style={{ display: "inline-flex", color: "#FFFFFF" }}>{icon}</span>
      <span>{label}</span>
      {meta && <em style={v2SectionMetaStyle}>{meta}</em>}
    </div>
  );
}

function V2AgendaGroup({ title, items }) {
  return (
    <div style={v2AgendaGroupStyle}>
      <div style={v2AgendaGroupTitleStyle}>{title}</div>
      <div style={v2TimelineStyle}>
        {items.length ? items.map((item) => (
          <div key={item.id} style={v2AgendaItemStyle}>
            <span style={v2TimelineDotStyle} />
            <span style={v2AgendaTimeStyle}>{item.time}</span>
            <div style={{ minWidth: 0 }}>
              <div style={v2ItemTitleStyle}>{item.title}</div>
              {item.sub && <div style={v2MutedStyle}>{item.sub}</div>}
            </div>
            <span style={v2AgendaIconStyle}>{item.icon}</span>
          </div>
        )) : (
          <div style={v2AgendaEmptyStyle}>No events scheduled</div>
        )}
      </div>
    </div>
  );
}

function V2Metric({ icon, text }) {
  return (
    <div style={v2MetricStyle}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

export function NeedsActionPanel({ actions }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={v2NeedsHeaderStyle}>
        <div style={v2NeedsTitleStyle}>Needs Action</div>
        <span style={v2ActionCountStyle}>{actions.length}</span>
      </div>
      <div style={v2ActionListStyle} data-testid="needs-action-list">
        {actions.map((action) => (
          <button key={action.id} style={v2ActionItemStyle(action.tone)}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {action.meta && <div style={v2ActionMetaStyle}>{action.meta}</div>}
              <div style={v2ActionTitleStyle}>{action.title}</div>
              {action.detail && (
                <div style={v2SuggestedActionButtonStyle(action.tone)}>
                  <AudioLines size={14} strokeWidth={2.4} aria-hidden="true" />
                  <span style={v2ActionDetailTextStyle}>{action.detail}</span>
                </div>
              )}
            </div>
            <span style={v2ChevronStyle}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HowieAssistantPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={v2HowieHeaderStyle}>
        <span>Howie</span>
        <em>AI</em>
      </div>
      <div style={v2HowieGreetingStyle}>Hey Howell family! 👋<br />Here are a few things I can help with.</div>
      <div style={v2HowiePromptStyle}>
        <button style={v2HowieCommandStyle}><Send size={15} /> Send a message to Telegram</button>
        <button style={v2HowieCommandStyle}><Gift size={15} /> Create a grocery list</button>
        <button style={v2HowieCommandStyle}><CalendarDays size={15} /> What's on our schedule tomorrow?</button>
      </div>
    </div>
  );
}

export function buildAgenda(events, now) {
  const referenceAgenda = [
    { id: "ref-today-1", day: "Today", time: "4:30", title: "Family check-in", sub: "Kitchen", icon: "▣", sort: 1 },
    { id: "ref-today-2", day: "Today", time: "5:00", title: "Soccer practice", sub: "South field", icon: "♨", sort: 2 },
    { id: "ref-today-3", day: "Today", time: "7:00", title: "Dinner with Grandma Sue", sub: "At our place", icon: "♧", sort: 3 },
    { id: "ref-tomorrow-1", day: "Tomorrow", time: "8:15", title: "Pack field trip lunch", sub: "Lucy", icon: "▣", sort: 4 },
    { id: "ref-tomorrow-2", day: "Tomorrow", time: "3:30", title: "Piano lesson", sub: "Lucy", icon: "♫", sort: 5 },
    { id: "ref-tomorrow-3", day: "Tomorrow", time: "6:30", title: "Scout meeting", sub: "Community center", icon: "♧", sort: 6 },
    { id: "ref-day-after-1", day: "Wednesday", time: "9:00", title: "School assembly", sub: "Howell family", icon: "▣", sort: 7 },
    { id: "ref-day-after-2", day: "Wednesday", time: "5:45", title: "Dinner prep", sub: "Home", icon: "♧", sort: 8 },
    { id: "ref-thursday-1", day: "Thursday", time: "4:15", title: "Library pickup", sub: "Howell family", icon: "▣", sort: 9 },
    { id: "ref-friday-1", day: "Friday", time: "6:00", title: "Pizza night", sub: "Home", icon: "♧", sort: 10 },
    { id: "ref-saturday-1", day: "Saturday", time: "10:30", title: "Park meetup", sub: "Howell family", icon: "▣", sort: 11 },
    { id: "ref-sunday-1", day: "Sunday", time: "5:00", title: "Plan the week", sub: "Kitchen", icon: "♧", sort: 12 },
  ];
  if (new URLSearchParams(window.location.search).get("designSystem") === "v2") {
    return agendaGroups(referenceAgenda, now);
  }
  const src = Array.isArray(events) ? events : [];
  const normalized = src
    .map((event, index) => {
      const start = event.start ? new Date(event.start) : null;
      const day = event.day || dayLabel(start, now);
      return {
        id: event.id || `${event.title}-${index}`,
        day,
        offset: dayOffset(start, now),
        title: event.title || event.summary || "Calendar event",
        sub: event.sub || event.location || event.who || event.calendar || "",
        icon: event.icon || "▣",
        time: event.time || (start && Number.isFinite(start.getTime())
          ? start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "")
          : "All day"),
        sort: start?.getTime() ?? index,
      };
    })
    .filter((event) => event.offset >= 0 && event.offset < V2_AGENDA_DAYS)
    .sort((a, b) => a.sort - b.sort);
  return agendaGroups(normalized, now);
}

export function shouldShowWeekdayMorningTasks(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= 7 * 60 + 50 && minutes < 8 * 60 + 30;
}

function dayLabel(date, now) {
  if (!date || !Number.isFinite(date.getTime())) return "Today";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((target - today) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return target.toLocaleDateString("en-US", { weekday: "long" });
}

function dayOffset(date, now) {
  if (!date || !Number.isFinite(date.getTime())) return 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target - today) / 86_400_000);
}

function agendaGroups(events, now) {
  return {
    days: Array.from({ length: V2_AGENDA_DAYS }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const title = offset === 0
        ? "Today"
        : offset === 1
          ? "Tomorrow"
          : date.toLocaleDateString("en-US", { weekday: "long" });
      return {
        key: date.toISOString().slice(0, 10),
        title,
        items: events.filter((event) => {
          const eventOffset = event.offset ?? dayOffset(event.start ? new Date(event.start) : null, now);
          if (event.day && event.day === title) return true;
          return eventOffset === offset;
        }),
      };
    }),
  };
}

function normalizeV2Weather(source) {
  const current = source?.current ?? source ?? {};
  return {
    temp: current.temp ?? current.tempF ?? 68,
    condition: current.condition ?? current.summary ?? "Marine layer clearing",
    feelsLike: current.feelsLike ?? current.feelsLikeF ?? current.temp ?? 67,
    wind: current.wind ?? "9 mph W",
    humidity: current.humidity ?? 58,
    hi: current.hi ?? current.high ?? current.highF ?? 71,
    lo: current.lo ?? current.low ?? current.lowF ?? 57,
  };
}

function formatBirthdayDate(birthday, now) {
  if (Number.isFinite(Number(birthday.daysUntil))) {
    return `${birthday.date?.replace("-", "/") ?? ""} · ${birthday.daysUntil} days`;
  }
  const mmdd = birthday.date || "01-01";
  const [month, day] = mmdd.split("-").map(Number);
  if (!month || !day) return mmdd;
  const target = new Date(now.getFullYear(), month - 1, day);
  if (target < now) target.setFullYear(target.getFullYear() + 1);
  const days = Math.ceil((target - now) / 86_400_000);
  return `${mmdd.replace("-", "/")} · ${days} days`;
}

function giftLabel(status) {
  if (status === "ordered") return "Ordered";
  if (status === "ready") return "Gift ready";
  if (status === "needed") return "Order soon";
  return "Find ideas";
}

const v2ShellStyle = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "340px minmax(420px, 1fr) 340px",
  gridTemplateRows: "1fr 130px 30px",
  gap: 12,
  marginLeft: 0,
  padding: "0 0 0 0",
};

const v2GlassPanelStyle = {
  borderRadius: 26,
  background: "rgba(14, 24, 39, 0.82)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 12px 34px rgba(2,8,23,0.16)",
  contain: "layout paint style",
};

const v2AgendaStyle = {
  ...v2GlassPanelStyle,
  gridColumn: "1",
  gridRow: "1",
  padding: "22px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  overflowY: "auto",
  overflowX: "hidden",
};

const v2HeroStyle = {
  gridColumn: "2",
  gridRow: "1",
  alignSelf: "start",
  justifySelf: "center",
  marginTop: 22,
  marginLeft: 8,
  display: "flex",
  alignItems: "center",
  gap: 18,
  color: "#FFFFFF",
};

const v2RightRailStyle = {
  gridColumn: "3",
  gridRow: "1",
  display: "grid",
  gridTemplateRows: "minmax(0, 1.1fr) minmax(0, 0.92fr)",
  gap: 10,
  minHeight: 0,
};

const v2NeedsPanelStyle = {
  ...v2GlassPanelStyle,
  padding: "18px 20px",
  minHeight: 0,
  overflow: "hidden",
};

const v2HowiePanelStyle = {
  ...v2GlassPanelStyle,
  padding: "16px 20px",
  minHeight: 0,
  overflow: "hidden",
};

const v2BottomTrayStyle = {
  ...v2GlassPanelStyle,
  gridColumn: "1 / span 3",
  gridRow: "2",
  display: "grid",
  gridTemplateColumns: "1fr 1px 1fr",
  alignItems: "stretch",
  padding: "18px 22px",
  gap: 18,
  minWidth: 0,
};

const v2BottomColumnStyle = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const v2SectionTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#FFFFFF",
  fontFamily: "'Geist','Inter',system-ui,sans-serif",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 2.4,
  textTransform: "uppercase",
};

const v2SectionMetaStyle = {
  borderRadius: 999,
  padding: "4px 8px",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.62)",
  fontStyle: "normal",
  fontSize: 11,
  letterSpacing: 0,
  textTransform: "none",
};
const v2AgendaGroupStyle = { display: "flex", flexDirection: "column", gap: 7 };
const v2AgendaGroupTitleStyle = {
  fontFamily: "'JetBrains Mono',ui-monospace,monospace",
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,0.72)",
  textTransform: "uppercase",
  letterSpacing: 1.6,
};
const v2TimelineStyle = { display: "flex", flexDirection: "column", gap: 7 };
const v2AgendaItemStyle = {
  display: "grid",
  gridTemplateColumns: "10px 62px minmax(0,1fr) 18px",
  gap: 10,
  alignItems: "center",
  minHeight: 44,
  padding: "7px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.055)",
};
const v2AgendaEmptyStyle = {
  minHeight: 34,
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.045)",
  fontFamily: "'Geist','Inter',system-ui,sans-serif",
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.46)",
};
const v2MorningTasksStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 13px",
  borderRadius: 14,
  background: "rgba(34,197,94,0.16)",
  border: "1px solid rgba(199,249,204,0.32)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
};
const v2MorningTasksHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  fontFamily: "'JetBrains Mono',ui-monospace,monospace",
  fontSize: 11,
  fontWeight: 900,
  color: "#C7F9CC",
  textTransform: "uppercase",
  letterSpacing: 0,
};
const v2MorningTasksListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};
const v2MorningTaskItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 28,
  fontFamily: "'Geist','Inter',system-ui,sans-serif",
  fontSize: 16,
  fontWeight: 850,
  color: "#FFFFFF",
  lineHeight: 1.15,
};
const v2TimelineDotStyle = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "#FFFFFF",
};
const v2AgendaTimeStyle = {
  fontFamily: "'JetBrains Mono',ui-monospace,monospace",
  fontSize: 15,
  fontWeight: 800,
  color: "#FFFFFF",
};
const v2ItemTitleStyle = {
  fontFamily: "'Geist','Inter',system-ui,sans-serif",
  fontSize: 15,
  fontWeight: 800,
  color: "#FFFFFF",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const v2MutedStyle = {
  fontFamily: "'Geist','Inter',system-ui,sans-serif",
  fontSize: 12,
  fontWeight: 600,
  color: "rgba(255,255,255,0.56)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const v2AgendaIconStyle = {
  justifySelf: "end",
  color: "rgba(255,255,255,0.72)",
  fontSize: 15,
  lineHeight: 1,
};
const v2HeroTimeStyle = { display: "flex", alignItems: "baseline", gap: 10 };
const v2HeroTimeNumberStyle = {
  fontFamily: "'JetBrains Mono',ui-monospace,monospace",
  fontSize: 56,
  fontWeight: 700,
  letterSpacing: 0,
};
const v2HeroMeridiemStyle = { fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 20, fontWeight: 800 };
const v2HeroDividerStyle = { width: 1, height: 66, background: "rgba(255,255,255,0.22)" };
const v2WeatherHeroStyle = { display: "flex", alignItems: "center", gap: 12 };
const v2TempStyle = { fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 46, fontWeight: 800, lineHeight: 0.95 };
const v2WeatherSummaryStyle = { fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.72)", marginTop: 6 };
const v2WeatherMutedStyle = { fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.52)" };
const v2WeatherFactsStyle = { display: "grid", gridTemplateColumns: "1fr", gap: 4, marginLeft: 10 };
const v2MetricStyle = { display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.62)", fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 13, fontWeight: 700 };
const v2NeedsHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const v2NeedsTitleStyle = { fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 15, fontWeight: 900, color: "rgba(255,255,255,0.78)", textTransform: "uppercase", letterSpacing: 2.4 };
const v2HowieHeaderStyle = { display: "flex", alignItems: "center", gap: 8, fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 17, fontWeight: 850, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1.8 };
const v2ActionCountStyle = { width: 23, height: 23, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#EF4444", color: "#FFFFFF", fontSize: 12, fontWeight: 900 };
const v2ActionListStyle = { display: "flex", flexDirection: "column", gap: 8, marginTop: 10, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2 };
const v2ActionMetaStyle = { fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 10.5, fontWeight: 850, color: "rgba(255,255,255,0.58)", marginBottom: 3 };
const v2ActionTitleStyle = { fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 15.5, fontWeight: 850, color: "#FFFFFF", lineHeight: 1.12, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" };
const v2ActionDetailTextStyle = { minWidth: 0 };
const v2ChevronStyle = { color: "rgba(255,255,255,0.72)", fontSize: 28, lineHeight: 1 };
const v2HowiePromptStyle = { display: "flex", flexDirection: "column", gap: 6 };
const v2HowieGreetingStyle = { fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 12.5, lineHeight: 1.28, color: "rgba(255,255,255,0.72)", fontWeight: 650 };
const v2HowieCommandStyle = { minHeight: 28, borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.78)", display: "flex", alignItems: "center", gap: 9, padding: "0 13px", fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 11.5, fontWeight: 750, textAlign: "left" };
const v2BirthdayRowStyle = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 };
const v2BirthdayItemStyle = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 9, minWidth: 0 };
const v2HolidayRowStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 };
const v2HolidayItemStyle = { display: "grid", gridTemplateColumns: "54px minmax(0,1fr)", alignItems: "center", gap: 12, minWidth: 0 };
const v2TrayDividerStyle = { background: "rgba(255,255,255,0.16)" };
const v2FooterStyle = { gridColumn: "1 / span 3", gridRow: "3", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 0 };
const v2MemberPillStyle = { borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.62)", padding: "6px 14px", fontFamily: "'Geist','Inter',system-ui,sans-serif", fontSize: 12, fontWeight: 800 };
const v2VersionPillStyle = { borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#FFFFFF", padding: "7px 13px", fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 11, fontWeight: 900 };

function v2ActionItemStyle(tone) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minHeight: 68,
    border: 0,
    borderRadius: 12,
    background: v2ActionSurface(tone),
    padding: "8px 12px",
    textAlign: "left",
  };
}

function v2ActionSurface(tone) {
  if (tone === "urgent") return "rgba(239,68,68,0.2)";
  if (tone === "warning") return "rgba(234,179,8,0.2)";
  return "rgba(255,255,255,0.06)";
}

function v2SuggestedActionButtonStyle(tone) {
  return {
    display: "inline-grid",
    gridTemplateColumns: "auto minmax(0,1fr)",
    alignItems: "center",
    maxWidth: "100%",
    minHeight: 30,
    gap: 5,
    marginTop: 7,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "transparent",
    color: "#FFFFFF",
    padding: "6px 11px",
    fontFamily: "'Geist','Inter',system-ui,sans-serif",
    fontSize: 12.5,
    fontWeight: 700,
    lineHeight: 1.18,
  };
}

function v2PillStyle(status) {
  const color = status === "ordered" || status === "ready" ? "#22C55E" : status === "needed" ? "#F59E0B" : "#60A5FA";
  return {
    borderRadius: 999,
    background: `${color}26`,
    color,
    padding: "4px 8px",
    fontFamily: "'Geist','Inter',system-ui,sans-serif",
    fontSize: 11,
    fontWeight: 850,
    whiteSpace: "nowrap",
  };
}

function v2DateTileStyle(color) {
  return {
    width: 48,
    height: 50,
    borderRadius: 10,
    background: `${color}22`,
    color: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'JetBrains Mono',ui-monospace,monospace",
    fontSize: 11,
    fontWeight: 900,
  };
}
