import * as React from "react";

import "./Chart.css";

import * as chartjs from "chart.js";

export type ChartData = chartjs.ChartData;
export type ChartConfiguration = chartjs.ChartConfiguration;

interface Props {
    options: ChartConfiguration;
    serial: any;
}

export class Chart extends React.Component<Props> {
    private canvas: HTMLCanvasElement | null;
    private chart: chartjs | null;
    private chart_opts: ChartConfiguration | null;
    private chart_serial: any = undefined;
    private chart_reset: boolean = false;
    private chart_update: boolean = false;

    constructor(props: Props) {
        super(props);
        this.canvas = null;
        this.chart = null;
        this.chart_opts = null;
    }

    public componentDidMount() {
        this.scheduleUpdate();
    }

    public componentWillUnmount() {
        delete this.canvas;
        this.scheduleUpdate();
    }

    public componentDidUpdate() {
        const {options, serial} = this.props;
        if(options !== this.chart_opts) {
            this.chart_opts = options;
            this.chart_reset = true;
        }
        if(serial !== this.chart_serial) {
            this.chart_serial = serial;
            this.chart_update = true;
        }
        this.scheduleUpdate();
    }

    public render() {
        return <div className="Chart"><canvas ref={(ref) => {
            this.canvas = ref;
            this.scheduleUpdate();
        }} /></div>;
    }

    private update_scheduled: boolean = false;
    private scheduleUpdate(): void {
        if(this.update_scheduled) return;
        this.update_scheduled = true;
        self.setTimeout(() => this._update(), 0);
    }

    private _update(): void {
        this.update_scheduled = false;
        if(this.chart !== null && (this.canvas === null || this.chart.canvas !== this.canvas || this.chart_reset)) {
            this.chart_reset = false;
            this.chart.destroy();
            this.chart = null;
        }
        if(this.canvas !== null && this.chart_opts !== null) {
            if(this.chart === null) {
                this.chart = new chartjs.Chart(this.canvas, this.chart_opts);
                this.chart_update = true;
            }
            if(this.chart_update) {
                this.chart_update = false;
                this.chart.update();
            }
        }
    }
}
