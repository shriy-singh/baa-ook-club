import DataReport from "@/components/DataReport";

export const metadata = {
  title: "What this site knows about you · Baa-ook Club",
  description: "See, live, what your browser shares with Baa-ook Club, what the site keeps, and what goes to Google.",
};

export default function YourDataPage() {
  return <DataReport />;
}
