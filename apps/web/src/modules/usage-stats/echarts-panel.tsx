import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface EChartsPanelProps {
  ariaLabel: string;
  option: EChartsOption;
}

export function EChartsPanel({ ariaLabel, option }: EChartsPanelProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) {
      return undefined;
    }

    const chart = echarts.init(element);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    chart.setOption(option);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [option]);

  return (
    <div
      aria-label={ariaLabel}
      ref={chartRef}
      role="img"
      style={{ height: 280, minHeight: 280, width: "100%" }}
    />
  );
}
