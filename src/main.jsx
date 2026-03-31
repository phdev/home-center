import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import TVPreview from "./TVPreview";
import TVClipMountDesign from "./components/TVClipMountDesign";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

// Resolve route from pathname or ?route= param (GitHub Pages 404 redirect)
function getRoute() {
  const params = new URLSearchParams(window.location.search);
  const fromRedirect = params.get("route");
  if (fromRedirect) {
    // Clean up URL: replace ?route=tv-preview with /tv-preview
    const clean = base + "/" + fromRedirect;
    window.history.replaceState(null, "", clean);
    return "/" + fromRedirect;
  }
  return window.location.pathname.slice(base.length) || "/";
}

const route = getRoute();

function Root() {
  if (route === "/tv-preview" || route === "/tv-preview/") {
    return <TVPreview />;
  }
  if (route === "/tv-clip-mount" || route === "/tv-clip-mount/") {
    return <TVClipMountDesign />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
