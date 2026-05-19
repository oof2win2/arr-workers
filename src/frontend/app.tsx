import { createRoot } from "react-dom/client";
import "./style.css";
import { useHashRouter } from "./components/useHashRouter";
import { Nav } from "./components/Nav";
import { ReviewPage } from "./pages/ReviewPage";
import { InstancesPage } from "./pages/InstancesPage";
import { ScansPage } from "./pages/ScansPage";
import { AuditPage } from "./pages/AuditPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const path = useHashRouter();
  const page = path === "/" || path === "" ? "review" : path.slice(1);

  return (
    <>
      <Nav page={page} />
      <div id="page-content" className="container">
        {page === "review" && <ReviewPage />}
        {page === "instances" && <InstancesPage />}
        {page === "scans" && <ScansPage />}
        {page === "audit" && <AuditPage />}
        {page === "settings" && <SettingsPage />}
      </div>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
