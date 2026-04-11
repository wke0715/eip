"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface TrendItem {
  date: string;
  approved: number;
  rejected: number;
}

export function DashboardChart({ trendData }: { trendData: TrendItem[] }) {
  const data = {
    labels: trendData.map((d) => d.date.slice(5)), // MM-DD
    datasets: [
      {
        label: "核准",
        data: trendData.map((d) => d.approved),
        borderColor: "#22c55e",
        backgroundColor: "#22c55e20",
        tension: 0.3,
      },
      {
        label: "退簽",
        data: trendData.map((d) => d.rejected),
        borderColor: "#ef4444",
        backgroundColor: "#ef444420",
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">近 30 天簽核趨勢</CardTitle>
      </CardHeader>
      <CardContent>
        {trendData.length > 0 ? (
          <div className="h-64">
            <Line data={data} options={options} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            尚無簽核資料
          </p>
        )}
      </CardContent>
    </Card>
  );
}
