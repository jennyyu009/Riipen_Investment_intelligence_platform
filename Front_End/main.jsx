import React from "react";
import { createRoot } from "react-dom/client";
import FounderIntakeForm from "./input.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FounderIntakeForm />
  </React.StrictMode>,
);
