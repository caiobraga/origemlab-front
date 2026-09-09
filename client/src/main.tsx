import { createRoot } from "react-dom/client";
import { redirectAuthLinkIfNeeded } from "./lib/authCallbackUrl";
import App from "./App";
import "./index.css";

// Links de email do Supabase caem na Site URL (/) — redireciona antes da Home.
redirectAuthLinkIfNeeded();

createRoot(document.getElementById("root")!).render(<App />);
