import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Root() {
  const app = (
    <BrowserRouter>
      <App clerkEnabled={Boolean(clerkKey)} />
    </BrowserRouter>
  );

  if (!clerkKey) {
    return app;
  }

  return <ClerkProvider publishableKey={clerkKey}>{app}</ClerkProvider>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
