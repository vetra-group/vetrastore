import LoadingScreen from "@/components/loading/LoadingScreen";

// Draft previews stay outside this boundary so auth redirects and 404s resolve first.
export default function Loading() {
  return <main id="main-content"><LoadingScreen variant="admin" /></main>;
}
