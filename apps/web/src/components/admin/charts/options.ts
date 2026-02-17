import type { EChartsOption } from "echarts";

type LineSeriesInput = {
  name: string;
  values: number[];
  color?: string;
  area?: boolean;
  yAxisIndex?: number;
};

type StackedBarSeriesInput = {
  name: string;
  values: number[];
  color?: string;
  stack?: string;
};

type FunnelStepInput = {
  name: string;
  value: number;
};

type HeatmapPointInput = {
  x: string;
  y: string;
  value: number;
};

const CHART_COLORS = [
  "#0f766e",
  "#0369a1",
  "#0ea5e9",
  "#14b8a6",
  "#84cc16",
  "#f59e0b",
  "#ef4444",
  "#6366f1"
] as const;

const BASE_TEXT_COLOR = "#475569";
const BASE_GRID = {
  left: 48,
  right: 24,
  top: 48,
  bottom: 40,
  containLabel: true
} as const;

const emptyGraphic = (message: string) => {
  return {
    type: "text",
    left: "center",
    top: "middle",
    style: {
      text: message,
      fill: BASE_TEXT_COLOR,
      fontSize: 13,
      fontWeight: 500
    }
  };
};

export const buildEmptyChartOption = (message = "No data for the selected filters."): EChartsOption => {
  return {
    animation: false,
    grid: BASE_GRID,
    xAxis: {
      show: false,
      type: "category",
      data: []
    },
    yAxis: {
      show: false,
      type: "value"
    },
    series: [],
    graphic: [emptyGraphic(message)]
  };
};

export const buildLineChartOption = ({
  categories,
  series,
  yAxes = 1,
  emptyMessage = "No time-series data available.",
  areaOpacity = 0.12
}: {
  categories: string[];
  series: LineSeriesInput[];
  yAxes?: number;
  emptyMessage?: string;
  areaOpacity?: number;
}): EChartsOption => {
  if (categories.length === 0 || series.length === 0) {
    return buildEmptyChartOption(emptyMessage);
  }

  return {
    color: [...CHART_COLORS],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" }
    },
    legend: {
      top: 8,
      textStyle: { color: BASE_TEXT_COLOR }
    },
    grid: BASE_GRID,
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: categories,
      axisLabel: {
        color: BASE_TEXT_COLOR
      }
    },
    yAxis: Array.from({ length: Math.max(1, yAxes) }, (_, index) => ({
      type: "value",
      position: index === 0 ? "left" : "right",
      alignTicks: index > 0,
      axisLabel: {
        color: BASE_TEXT_COLOR
      },
      splitLine: {
        lineStyle: {
          color: "#e2e8f0"
        }
      }
    })),
    series: series.map((entry) => ({
      type: "line",
      name: entry.name,
      data: entry.values,
      showSymbol: false,
      smooth: true,
      yAxisIndex: entry.yAxisIndex ?? 0,
      lineStyle: entry.color ? { color: entry.color, width: 2 } : { width: 2 },
      itemStyle: entry.color ? { color: entry.color } : undefined,
      areaStyle: entry.area
        ? entry.color
          ? { opacity: areaOpacity, color: entry.color }
          : { opacity: areaOpacity }
        : undefined
    })),
    graphic: []
  };
};

export const buildStackedBarOption = ({
  categories,
  series,
  emptyMessage = "No comparison data available."
}: {
  categories: string[];
  series: StackedBarSeriesInput[];
  emptyMessage?: string;
}): EChartsOption => {
  if (categories.length === 0 || series.length === 0) {
    return buildEmptyChartOption(emptyMessage);
  }

  return {
    color: [...CHART_COLORS],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" }
    },
    legend: {
      top: 8,
      textStyle: { color: BASE_TEXT_COLOR }
    },
    grid: BASE_GRID,
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: {
        color: BASE_TEXT_COLOR,
        interval: 0,
        rotate: categories.length > 7 ? 25 : 0
      }
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: BASE_TEXT_COLOR
      },
      splitLine: {
        lineStyle: {
          color: "#e2e8f0"
        }
      }
    },
    series: series.map((entry) => ({
      type: "bar",
      name: entry.name,
      data: entry.values,
      stack: entry.stack ?? "total",
      barMaxWidth: 36,
      itemStyle: entry.color ? { color: entry.color } : undefined,
      emphasis: {
        focus: "series"
      }
    })),
    graphic: []
  };
};

export const buildFunnelOption = ({
  steps,
  emptyMessage = "No funnel data available."
}: {
  steps: FunnelStepInput[];
  emptyMessage?: string;
}): EChartsOption => {
  if (steps.length === 0) {
    return buildEmptyChartOption(emptyMessage);
  }

  return {
    color: [...CHART_COLORS],
    tooltip: {
      trigger: "item"
    },
    series: [
      {
        name: "Funnel",
        type: "funnel",
        top: 24,
        left: "10%",
        width: "80%",
        minSize: "20%",
        maxSize: "100%",
        sort: "descending",
        gap: 4,
        label: {
          show: true,
          position: "inside",
          color: "#0f172a"
        },
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 2
        },
        data: steps.map((step) => ({
          name: step.name,
          value: step.value
        }))
      }
    ],
    graphic: []
  };
};

export const buildHeatmapOption = ({
  xLabels,
  yLabels,
  points,
  emptyMessage = "No matrix data available."
}: {
  xLabels: string[];
  yLabels: string[];
  points: HeatmapPointInput[];
  emptyMessage?: string;
}): EChartsOption => {
  if (xLabels.length === 0 || yLabels.length === 0 || points.length === 0) {
    return buildEmptyChartOption(emptyMessage);
  }

  const xIndex = new Map<string, number>();
  const yIndex = new Map<string, number>();

  xLabels.forEach((label, index) => {
    xIndex.set(label, index);
  });
  yLabels.forEach((label, index) => {
    yIndex.set(label, index);
  });

  const dataset = points
    .map((point) => {
      const mappedX = xIndex.get(point.x);
      const mappedY = yIndex.get(point.y);
      if (mappedX === undefined || mappedY === undefined) {
        return null;
      }

      return [mappedX, mappedY, point.value];
    })
    .filter((point): point is [number, number, number] => point !== null);

  if (dataset.length === 0) {
    return buildEmptyChartOption(emptyMessage);
  }

  const values = dataset.map((entry) => entry[2]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    tooltip: {
      position: "top"
    },
    grid: {
      top: 32,
      left: 84,
      right: 24,
      bottom: 60,
      containLabel: true
    },
    xAxis: {
      type: "category",
      data: xLabels,
      splitArea: {
        show: true
      },
      axisLabel: {
        color: BASE_TEXT_COLOR,
        rotate: xLabels.length > 7 ? 30 : 0
      }
    },
    yAxis: {
      type: "category",
      data: yLabels,
      splitArea: {
        show: true
      },
      axisLabel: {
        color: BASE_TEXT_COLOR
      }
    },
    visualMap: {
      min,
      max,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      textStyle: {
        color: BASE_TEXT_COLOR
      },
      inRange: {
        color: ["#eff6ff", "#0ea5e9"]
      }
    },
    series: [
      {
        type: "heatmap",
        data: dataset,
        label: {
          show: false
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: "rgba(2, 132, 199, 0.45)"
          }
        }
      }
    ],
    graphic: []
  };
};

export const buildSparklineOption = ({
  points,
  color = "#0f766e"
}: {
  points: number[];
  color?: string;
}): EChartsOption => {
  if (points.length === 0) {
    return buildEmptyChartOption("No trend");
  }

  return {
    animation: false,
    grid: {
      left: 0,
      right: 0,
      top: 8,
      bottom: 0
    },
    tooltip: {
      show: false
    },
    xAxis: {
      type: "category",
      show: false,
      data: points.map((_, index) => String(index))
    },
    yAxis: {
      type: "value",
      show: false
    },
    series: [
      {
        type: "line",
        data: points,
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 2,
          color
        },
        areaStyle: {
          opacity: 0.2,
          color
        }
      }
    ]
  };
};
