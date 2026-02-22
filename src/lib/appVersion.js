// src/lib/appVersion.js
import pkg from "../../package.json";

export const APP_VERSION = pkg?.version || "dev";

export const APP_COMMIT =
  process.env.VERCEL_GIT_COMMIT_SHA
    ? process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7)
    : "";