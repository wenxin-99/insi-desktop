/**
 * dashboard/ConsumptionChart — 🐟币消费趋势图表
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";

interface ConsumptionChartProps {
  stats: any;
  statsLoading: boolean;
}

export function ConsumptionChart({ stats, statsLoading }: ConsumptionChartProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> {t("pages.dashboard.consumptionTrend")}
        </CardTitle>
        <CardDescription>{t("pages.dashboard.consumptionTrendDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {statsLoading ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">{t("pages.dashboard.loading")}</p>
          </div>
        ) : stats?.consumptionTrend && stats.consumptionTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.consumptionTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip labelFormatter={(v) => `${t("pages.dashboard.date")}: ${v}`} formatter={(value: number) => [`${value.toFixed(2)} 🐟币`, ""]} />
              <Legend />
              <Line type="monotone" dataKey="consume" stroke="#ef4444" name={t("pages.dashboard.consume")} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="recharge" stroke="#22c55e" name={t("pages.dashboard.recharge")} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">{t("pages.dashboard.noData")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
