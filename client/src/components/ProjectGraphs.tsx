import * as React from "react";

import * as obs from "@/obs";

import * as api from "../API";

import {Chart, ChartDataset, ChartOptions, ChartPoint} from "./Chart";
import Loading from "./Loading";

import "./ProjectGraphs.css";

interface ChartConfig {
    type: string;
    options: ChartOptions;
    datasets: ChartDataset[];
}

interface Graphs {
    [name: string]: ChartPoint[];
}

interface Props {
    user: api.User;
    project: string;
    refresh_period: number;
}

interface StandardCharts {
    worker_chart: ChartConfig;
    task_chart: ChartConfig;
}

interface State extends Partial<StandardCharts> {
    error: string | null;
    project_data?: api.Project | null;
    custom_charts: Array<[string, ChartConfig]>;
}

function flatLine(data: ChartPoint[], now: number) {
	if(data.length > 0 && now > data[data.length-1].x!) {
		data.push({
            x: now,
            y: data[data.length-1].y,
        });
	}
}

function makeStandardGraphs(data: Graphs): StandardCharts {
    const now = new Date().getTime();

    const opts: ChartOptions = {
        animation: {
            duration: 0,
        },
        responsiveAnimationDuration: 0,
        scales: {
            xAxes: [{
                type: "time",
                time: {
                    unit: "minute",
                    min: new Date(now - 5 * 60 * 1000).toISOString(),
                    max: new Date(now).toISOString(),
                },
                ticks: {
                    autoSkip: true,
                },
            }],
            yAxes: [{
                type: "linear",
                ticks: {
                    autoSkip: true,
                    min: 0,
                },
            }],
        },
    };

    for(const k of Object.keys(data)) {
        flatLine(data[k], now);
    }

    return {
        worker_chart: {
            type: "scatter",
            options: opts,
            datasets: [{
                label: "Registered Workers",
                borderColor: "rgb(0, 0, 255)",
                data: data.totalWorkers,
                showLine: true,
                lineTension: 0,
            }, {
                label: "Active Workers",
                borderColor: "rgb(0, 255, 0)",
                data: data.activeWorkers,
                showLine: true,
                lineTension: 0,
            }],
        },
        task_chart: {
            type: "scatter",
            options: opts,
            datasets: [{
                label: "Tasks Completed",
                borderColor: "rgb(0, 255, 0)",
                data: data.tasksCompleted,
                showLine: true,
                lineTension: 0,
            }, {
                label: "Tasks Refused",
                borderColor: "rgb(0, 0, 255)",
                data: data.tasksRefused,
                showLine: true,
                lineTension: 0,
            }, {
                label: "Tasks Failed",
                borderColor: "rgb(255, 0, 0)",
                data: data.tasksFailed,
                showLine: true,
                lineTension: 0,
            }],
        },
    };
}

export default class ProjectGraphs extends React.Component<Props, State> {
    private subs: obs.Subscription[];

    constructor(props: Props) {
        super(props);
        this.state = {
            error: null,
            project_data: undefined,
            custom_charts: [],
        };
        this.subs = [];
    }

    private reset() {
        for(const sub of this.subs) sub.stop();

        this.setState({
            error: null,
            project_data: undefined,
            custom_charts: [],
        });

        this.subs = [
            obs.refresh(() => {
                return this.props.user.requestGraphs(
                    `pname=${encodeURIComponent(this.props.project)}`
                    + `&prec=1`
                    + `&kind=standardGraphs`
                );
            }, this.props.refresh_period).subscribe((graphs) => {
                this.setState(makeStandardGraphs(graphs));
            }, (e) => {
                this.setState({
                    error: e.message,
                    worker_chart: undefined,
                    task_chart: undefined,
                });
                // Handle error here
            }),
            obs.refresh(() => {
                return this.props.user.requestGraphs(
                    `pname=${encodeURIComponent(this.props.project)}`
                    + `&prec=1`
                    + `&kind=customGraphs`
                );
            }, this.props.refresh_period).subscribe((graphs) => {
                this.setState({
                    custom_charts: Object.keys(graphs).map((k): [string, ChartConfig] => {
                        const v = graphs[k];
                        return [k, {
                            type: v["type"],
                            options: v["options"],
                            datasets: v["data"]["datasets"],
                        }];
                    }),
                });
            }, (e) => {
                this.setState({
                    error: e.message,
                });
                // Handle error here
            }),
            this.props.user.projects.subscribe((p) => {
                const pd = p.get(this.props.project);
                this.setState({project_data: pd === undefined ? null : pd});
            }),
        ];
        for(const sub of this.subs) sub.start();
    }

    public componentDidMount() {
        this.reset();
    }

    public componentWillUnmount() {
        for(const sub of this.subs) sub.stop();
    }

    public componentDidUpdate(prev_props: Props) {
        const props = this.props;
        if(
            props.user !== prev_props.user ||
            props.project !== prev_props.project
        ) {
            this.reset();
        }
    }

    public render() {
        const {worker_chart, task_chart, error, project_data, custom_charts} = this.state;
        if(project_data === undefined) {
            return <Loading />;
        }

        if(project_data === null) {
            return <div className="Main ProjectGraphs">
                <span className="ProjectGraphs-error">Project not found</span>
            </div>;
        }

        return <div className="Main ProjectGraphs">
            <h2>{project_data.title}</h2>
            <p>{project_data.description}</p>
            {error === null ? <React.Fragment>
                {worker_chart && <Chart key="standard-worker" {...worker_chart} />}
                {task_chart && <Chart key="standard-task" {...task_chart} />}
                {custom_charts.map(([name, config]) => {
                    return <Chart key={"custom-" + name} {...config} />;
                })}
            </React.Fragment> : <React.Fragment>
                <span className="ProjectGraphs-error">error</span>
                <a onClick={() => this.reset()}>Retry</a>
            </React.Fragment>}
        </div>;
    }
}
