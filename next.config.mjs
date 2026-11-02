import path from "node:path";

/** @type {import('next').NextConfig} */
export default {
  outputFileTracingRoot: path.resolve("."),
  turbopack: { root: path.resolve(".") },
};
