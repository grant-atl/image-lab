import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./image-lab.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
