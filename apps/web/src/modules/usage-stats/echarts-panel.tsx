import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface EChartsPanelProps {
  ariaLabel: string;
  highlightedSeriesName?: string | null;
  option: EChartsOption;
}

export function EChartsPanel({
  ariaLabel,
  highlightedSeriesName,
  option
}: EChartsPanelProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const highlightedSeriesNameRef = useRef<string | null>(null);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) {
      return undefined;
    }

    const chart = echarts.init(element);
    chartInstanceRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartInstanceRef.current?.setOption(option, { replaceMerge: ["series"] });
  }, [option]);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) {
      return;
    }

    if (highlightedSeriesNameRef.current) {
      chart.dispatchAction({
        seriesName: highlightedSeriesNameRef.current,
        type: "downplay"
      });
    }

    if (highlightedSeriesName) {
      chart.dispatchAction({
        seriesName: highlightedSeriesName,
        type: "highlight"
      });
    }

    highlightedSeriesNameRef.current = highlightedSeriesName ?? null;
  }, [highlightedSeriesName]);

  return (
    <div
      aria-label={ariaLabel}
      ref={chartRef}
      role="img"
      style={{ height: 280, minHeight: 280, width: "100%" }}
    />
  );
}
