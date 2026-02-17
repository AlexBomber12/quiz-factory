"use client";

import type { EChartsOption } from "echarts";
import dynamic from "next/dynamic";
import type { CSSProperties, ComponentType } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false
}) as ComponentType<{
  option: EChartsOption;
  style?: CSSProperties;
  className?: string;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  showLoading?: boolean;
  opts?: Record<string, unknown>;
}>;

type AdminChartProps = {
  option: EChartsOption;
  height?: number;
  className?: string;
  showLoading?: boolean;
};

export default function AdminChart({
  option,
  height = 320,
  className,
  showLoading = false
}: AdminChartProps) {
  return (
    <ReactECharts
      className={className}
      lazyUpdate
      notMerge
      option={option}
      opts={{ renderer: "canvas" }}
      showLoading={showLoading}
      style={{ height, width: "100%" }}
    />
  );
}
