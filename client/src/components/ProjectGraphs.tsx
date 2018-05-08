import * as React from "react";

import * as obs from "@/obs";

import * as api from "../API";

import Loading from "./Loading";
import {Chart, ChartConfiguration} from "./Chart";

import "./ProjectGraphs.css";

interface Props {
    user: api.User;
    project: string;
    refresh_period: number;
}
interface State {
    serial: number;
    error: string | null;
    project_data?: api.Project | null;
}

function flatLine(data: api.GraphPoint[]): api.GraphPoint[] {
	var d = new Date();
	// Update to current time only if falling behind
	if (d.getTime() > data[data.length-1].x) {
		data.push({
            x: d.getTime(),
            y: data[data.length-1].y,
        });
	}
    return data;
}

export default class ProjectGraphs extends React.Component<Props, State> {
    private subs: obs.Subscription[];

    private readonly chart1: ChartConfiguration = {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Registered Workers",
                    borderColor: "rgb(0, 0, 255)",
                    data: [],
                    showLine: true,
                    lineTension: 0.1
                },

                {
                    label: "Active Workers",
                    borderColor: "rgb(0, 255, 0)",
                    data: [],
                    showLine: true,
                    lineTension: 0.1,
                },
            ],
        },
        options: {
            scales: {
                xAxes: [{
                    type: "time",
                    //position: "bottom",
                    time: {
                        unit: "second",
                    }
                }],
            },
        },
    };

    private readonly chart2: ChartConfiguration = {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Tasks Completed",
                    borderColor: "rgb(0, 255, 0)",
                    data: [],
                    showLine: true,
                    lineTension: 0.1
                },
                {
                    label: "Tasks Refused",
                    borderColor: "rgb(0, 0, 255)",
                    data: [],
                    showLine: true,
                    lineTension: 0.1
                },
                {
                    label: "Tasks Failed",
                    borderColor: "rgb(255, 0, 0)",
                    data: [],
                    showLine: true,
                    lineTension: 0.1
                }
            ],
        },
        options: {
            scales: {
                xAxes: [{
                    type: "time",
                    //position: "bottom",
                    time: {
                        unit: "second",
                    },
                }],
            },
        },
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            serial: 0,
            error: null,
        };
        this.subs = [];
    }

    private reset() {
        for(const sub of this.subs) sub.stop();

        this.setState({
            error: null,
            project_data: undefined,
        });

        this.subs = [
            obs.refresh(() => {
                return this.props.user.requestGraphs(
                    `pname=${encodeURIComponent(this.props.project)}`
                    + `&prec=1`
                    + `&kind=standardGraphs`
                );
            }, this.props.refresh_period).subscribe((graphs) => {
                this.chart1.data!.datasets![0].data = flatLine(graphs.totalWorkers);
                this.chart1.data!.datasets![1].data = flatLine(graphs.activeWorkers);

                this.chart2.data!.datasets![0].data = flatLine(graphs.tasksCompleted);
                this.chart2.data!.datasets![1].data = flatLine(graphs.tasksRefused);
                this.chart2.data!.datasets![2].data = flatLine(graphs.tasksFailed);

                this.setState((st) => ({serial: st.serial + 1}));
            }, (e) => {
                this.setState({error: e.message});
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
        const {serial, error, project_data} = this.state;
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
            {error === null ? [
                <Chart options={this.chart1} serial={serial} />,
                <Chart options={this.chart2} serial={serial} />,
            ] : [
                <span className="ProjectGraphs-error">error</span>,
                <a onClick={() => this.reset()}>Retry</a>
            ]}
        </div>;
    }
}
