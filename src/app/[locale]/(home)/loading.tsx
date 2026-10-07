import LoadingScreen from "@/components/loading/LoadingScreen";

// Keep this boundary on the home page so detail routes retain their HTTP status.
export default function Loading() {
  return <LoadingScreen layout="content" />;
}
