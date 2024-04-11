import ReactDOM from "react-dom/client";
import { StrictMode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

// ignore in prod
import { startMockAPI } from "./msw-mock-api.ts";
import { routes } from "./routes.tsx";

const rootDiv = document.getElementById("root");
if (!rootDiv) throw new Error("Root div not found");

const root = ReactDOM.createRoot(rootDiv);

function render() {
  const router = createBrowserRouter(routes, {
    future: {
      v7_normalizeFormMethod: true
    }
  });

  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}

if (process.env.MSW) {
  startMockAPI().then(render).catch(console.error);
} else {
  render();
}