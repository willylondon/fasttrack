"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { buildHistorySeries } from "@/lib/fasting";

export default function HistoryChart({ chartData }: { chartData: ReturnType<typeof buildHistorySeries> }) {
  return (
            <Tabs defaultValue="hours" className="gap-5">
              <TabsList>
                <TabsTrigger value="hours">Actual hours</TabsTrigger>
                <TabsTrigger value="goal">Goal hours</TabsTrigger>
              </TabsList>
              <TabsContent value="hours">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="hours-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="#A1A1AA" tickLine={false} axisLine={false} />
                      <YAxis stroke="#A1A1AA" tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "18px",
                        }}
                      />
                      <Area type="monotone" dataKey="hours" stroke="#8B5CF6" fill="url(#hours-fill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              <TabsContent value="goal">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="goal-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="#A1A1AA" tickLine={false} axisLine={false} />
                      <YAxis stroke="#A1A1AA" tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "18px",
                        }}
                      />
                      <Area type="monotone" dataKey="goalHours" stroke="#22C55E" fill="url(#goal-fill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
  );
}
