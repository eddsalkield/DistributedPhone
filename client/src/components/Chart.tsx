import * as React from "react";

import "./Chart.css";

import * as chartjs from "chart.js";

export type ChartDataset = chartjs.ChartDataSets;
export type ChartOptions = chartjs.ChartOptions;
export type ChartPoint = chartjs.ChartPoint;

interface Props {
    type: string;
    options: ChartOptions;
    datasets: ChartDataset[];
}

export class Chart extends React.Component<Props> {
    private canvas: HTMLCanvasElement | null;
    private chart: chartjs.Chart | null;

    private upd: boolean = false;
    private upd_reset: boolean = false;

    constructor(props: Props) {
        super(props);
        this.canvas = null;
        this.chart = null;
    }

    public componentDidMount() {
        this.scheduleUpdate();
    }

    public componentWillUnmount() {
        this.destroy();
    }

    private destroy() {
        if(this.chart !== null) {
            this.chart.destroy();
            this.chart = null;
        }
        if(this.canvas !== null) {
            this.canvas.remove();
            this.canvas = null;
        }
    }

    public componentDidUpdate(prev_props: Props) {
        const {type, options, datasets} = this.props;
        if(type !== prev_props.type) {
            this.upd_reset = true;
        }
        if(options !== prev_props.options || datasets !== prev_props.datasets) {
            this.upd = true;
        }
        this.scheduleUpdate();
    }

    public render() {
        return <div className="Chart" ref={(ref) => {
            if(ref === null) {
                return;
            }
            if(this.canvas === null) {
                this.canvas = window.document.createElement("canvas");
            }
            ref.appendChild(this.canvas);
            this.scheduleUpdate();
        }} />;
    }

    private update_scheduled: boolean = false;
    private scheduleUpdate(): void {
        if(this.update_scheduled) return;
        this.update_scheduled = true;
        self.setTimeout(() => this._update(), 0);
    }

    private _update(): void {
        let chart = this.chart;
        const cfg = this.props;

        this.update_scheduled = false;
        if(chart !== null && (this.upd_reset || this.canvas === null || chart.canvas !== this.canvas)) {
            this.chart = null;
            chart.destroy();
            chart = null;
        }
        this.upd_reset = false;
        if(this.canvas !== null) {
            if(chart === null) {
                this.upd = false;
                this.chart = chart = new chartjs.Chart(this.canvas, {
                    type: cfg.type,
                    options: cfg.options,
                    data: {
                        datasets: cfg.datasets,
                    },
                });
            } else if(this.upd) {
                this.upd = false;
                (chart as any).options = cfg.options;
                chart.data.datasets = cfg.datasets;
                chart.update();
            }
        }
    }
}
