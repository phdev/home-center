import {
  CalendarDays,
  Lightbulb,
  MapPin,
  Network,
  PawPrint,
  Sprout,
  User,
} from "lucide-react";

export const KNOWLEDGE_TYPES = ["location", "person", "fauna", "flora", "event", "concept"];

export const knowledgeTypeConfig = {
  location: {
    label: "LOCATION",
    accent: "#4DE9E0",
    accentSoft: "rgba(77, 233, 224, 0.18)",
    icon: MapPin,
  },
  person: {
    label: "PERSON",
    accent: "#F6C96A",
    accentSoft: "rgba(246, 201, 106, 0.18)",
    icon: User,
  },
  fauna: {
    label: "FAUNA",
    accent: "#7BEA8C",
    accentSoft: "rgba(123, 234, 140, 0.18)",
    icon: PawPrint,
  },
  flora: {
    label: "FLORA",
    accent: "#E9A066",
    accentSoft: "rgba(233, 160, 102, 0.18)",
    icon: Sprout,
  },
  event: {
    label: "EVENT",
    accent: "#76B7FF",
    accentSoft: "rgba(118, 183, 255, 0.18)",
    icon: CalendarDays,
  },
  concept: {
    label: "CONCEPT",
    accent: "#B993FF",
    accentSoft: "rgba(185, 147, 255, 0.18)",
    icon: Network,
    fallbackIcon: Lightbulb,
  },
};

export function getKnowledgeTypeConfig(type) {
  return knowledgeTypeConfig[type] || knowledgeTypeConfig.concept;
}
