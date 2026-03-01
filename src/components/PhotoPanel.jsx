import { ImageIcon } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { PHOTOS } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";

export function PhotoPanel({ t, photos, photosLoading, photosError }) {
  const items = photos && photos.length > 0 ? photos : PHOTOS;

  return (
    <Panel style={{ height: "100%" }}>
      <PanelHeader
        icon={<ImageIcon size={30} color="#FFFFFF" />}
        label="Family Photos"
        right={
          <span style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF44" }}>
            Google Photos
          </span>
        }
      />
      {photosLoading && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Loading photos…
        </div>
      )}
      {photosError && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: 8 }}>
          {photosError}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flex: 1 }}>
        {items.slice(0, 3).map((p, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 5,
              border: "1px solid #FFFFFF30",
              overflow: "hidden",
              background: "#00000000",
            }}
          >
            {p.url ? (
              <img
                src={p.url}
                alt={p.cap || ""}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
