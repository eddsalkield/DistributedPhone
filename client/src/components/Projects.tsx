import * as React from "react";
import {Link} from "react-router-dom";

import * as obs from "@/obs";

import * as api from "../API";

import InCheckbox from "./InCheckbox";
import Loading from "./Loading";

import "./Projects.css";

interface Props {
    user: api.User;
}

interface State {
    projects: api.Project[] | undefined;
    enabled: Set<string> | undefined;
}

export default class Projects extends React.Component<Props, State> {
    private readonly subs: obs.Subscription[];

    constructor(props: Props) {
        super(props);
        this.state = {
            projects: undefined,
            enabled: undefined,
        };

        this.subs = [
            props.user.settings.subscribe((set) => {
                this.setState({enabled: new Set(set.projects)});
            }),
            props.user.projects.subscribe((p) => {
                this.setState({projects: Array.from(p.values())});
            }),
        ];
    }

    public componentDidMount() {
        for(const sub of this.subs) sub.start();
    }

    public componentWillUnmount() {
        for(const sub of this.subs) sub.stop();
    }

    private onSet = (name: string, value: boolean) => {
        const enabled = this.state.enabled!;
        if(value) {
            if(!enabled.has(name)) {
                this.props.user.setProjectOn(name);
            }
        } else {
            if(enabled.has(name)) {
                this.props.user.setProjectOff(name);
            }
        }
    }

    public render() {
        const {projects, enabled} = this.state;
        if(projects === undefined || enabled === undefined) {
            return <Loading />;
        }

        return <div className="Main Projects">
            <h2>Projects</h2>
            {projects.map((p) => <Project key={p.id} data={p} enabled={enabled.has(p.id)} onSet={this.onSet} />)}
        </div>;
    }
}

interface ProjProps {
    data: api.Project;
    enabled: boolean;
    onSet: (id: string, value: boolean) => void;
}

const loremipsum = process.env.NODE_ENV === 'development' ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' : '';

class Project extends React.Component<ProjProps> {
    private onChange = (name: string | undefined, value: boolean) => {
        this.props.onSet(this.props.data.id, value);
    }

    public render() {
        const p = this.props.data;
        return <div className="Projects-Project">
            <InCheckbox value={this.props.enabled} onChange={this.onChange}>
                <h4>{p.title}</h4>
            </InCheckbox>
            <Link to={`/project/${p.id}`}>Project stats</Link>
            <p>{p.description} {loremipsum}</p>
        </div>;
    }
}
