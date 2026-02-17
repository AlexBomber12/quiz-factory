import { describe, expect, it } from "vitest";

import {
  buildEmptyChartOption,
  buildFunnelOption,
  buildHeatmapOption,
  buildLineChartOption,
  buildSparklineOption,
  buildStackedBarOption
} from "./options";

describe("admin chart options", () => {
  it("builds an empty option with message", () => {
    const option = buildEmptyChartOption("Nothing here");
    expect(option.series).toEqual([]);
    expect(option.graphic).toBeDefined();
  });

  it("builds line chart option for series data", () => {
    const option = buildLineChartOption({
      categories: ["2026-01-01", "2026-01-02"],
      series: [
        {
          name: "sessions",
          values: [10, 20]
        }
      ]
    });

    expect(Array.isArray(option.series)).toBe(true);
    expect(Array.isArray(option.yAxis)).toBe(true);
  });

  it("returns empty option for missing stacked bar data", () => {
    const option = buildStackedBarOption({
      categories: [],
      series: []
    });
    expect(option.series).toEqual([]);
  });

  it("does not stack bar series unless stack is provided", () => {
    const option = buildStackedBarOption({
      categories: ["A", "B"],
      series: [
        { name: "Sessions", values: [10, 20] },
        { name: "Purchases", values: [2, 4] }
      ]
    });

    expect(Array.isArray(option.series)).toBe(true);
    const firstSeries = Array.isArray(option.series) ? option.series[0] : null;
    expect(firstSeries).toMatchObject({
      type: "bar"
    });
    expect(firstSeries && typeof firstSeries === "object" ? "stack" in firstSeries : false).toBe(false);
  });

  it("stacks bar series when stack is provided", () => {
    const option = buildStackedBarOption({
      categories: ["A", "B"],
      series: [
        { name: "Gross", values: [10, 20], stack: "revenue" },
        { name: "Refunds", values: [1, 2], stack: "revenue" }
      ]
    });

    expect(Array.isArray(option.series)).toBe(true);
    const firstSeries = Array.isArray(option.series) ? option.series[0] : null;
    expect(firstSeries).toMatchObject({
      type: "bar",
      stack: "revenue"
    });
  });

  it("builds funnel option for funnel steps", () => {
    const option = buildFunnelOption({
      steps: [
        { name: "views", value: 100 },
        { name: "starts", value: 50 }
      ]
    });

    expect(Array.isArray(option.series)).toBe(true);
  });

  it("builds heatmap option from points", () => {
    const option = buildHeatmapOption({
      xLabels: ["test-a"],
      yLabels: ["tenant-a"],
      points: [{ x: "test-a", y: "tenant-a", value: 42 }]
    });

    expect(Array.isArray(option.series)).toBe(true);
    expect(option.visualMap).toBeDefined();
  });

  it("builds sparkline option", () => {
    const option = buildSparklineOption({
      points: [1, 2, 3, 4]
    });

    expect(Array.isArray(option.series)).toBe(true);
  });
});
