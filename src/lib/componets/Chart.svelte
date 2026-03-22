<script lang="ts">
	import * as echarts from 'echarts';
	import { chartPrefs, type ChartType } from '$lib/chartPrefs.svelte';

	let {
		option,
		height = '160px',
		onclick,
	}: {
		option: echarts.EChartsOption;
		height?: string;
		onclick?: (params: any) => void;
	} = $props();

	let el: HTMLDivElement | undefined = $state();
	let chart: echarts.ECharts | null = null;

	/** Patch series types based on global chart preference */
	function applyChartType(opt: echarts.EChartsOption, type: ChartType): echarts.EChartsOption {
		if (!opt.series) return opt;

		const series = Array.isArray(opt.series) ? opt.series : [opt.series];
		const patched = series.map((s: any) => {
			// Only override series that are switchable (line/bar/scatter)
			// Skip series with _fixed flag (non-switchable like marklines, averages)
			if (s._fixed) return s;
			const baseType = s._baseType || s.type;
			if (!['line', 'bar', 'scatter'].includes(baseType)) return s;

			const result = { ...s, type };

			// Adjust styles based on target type
			if (type === 'bar') {
				result.barMaxWidth = 8;
				result.itemStyle = { ...s.itemStyle, borderRadius: [2, 2, 0, 0] };
				// Remove areaStyle for bar charts
				delete result.areaStyle;
			} else if (type === 'scatter') {
				result.symbolSize = s.symbolSize || 6;
				delete result.areaStyle;
			} else if (type === 'line') {
				// Restore line defaults
				if (!s.areaStyle && s._hasArea) {
					result.areaStyle = s._areaStyle || {};
				}
			}

			return result;
		});

		return { ...opt, series: patched };
	}

	$effect(() => {
		if (!el) return;

		if (!chart) {
			chart = echarts.init(el, undefined, { renderer: 'canvas' });

			if (onclick) {
				chart.on('click', 'series', onclick);
			}
		}

		const finalOption = applyChartType(option, chartPrefs.type);
		chart.setOption(finalOption, true);

		return () => {
			chart?.dispose();
			chart = null;
		};
	});

	// Responsive resize
	$effect(() => {
		if (!el) return;
		const ro = new ResizeObserver(() => chart?.resize());
		ro.observe(el);
		return () => ro.disconnect();
	});
</script>

<div bind:this={el} class="w-full" style="height: {height};"></div>
